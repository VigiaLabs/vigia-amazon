import { expose } from 'comlink';
import * as ort from 'onnxruntime-web';

const baseUrl = self.location.origin;

// WASM path (required for Next.js / workers)
ort.env.wasm.wasmPaths = `${baseUrl}/ort/`;

const INPUT_SIZE = 320;
const CONF_THRESHOLD = 0.4;

// Define your classes here
const CLASSES = ['POTHOLE', 'DEBRIS', 'ACCIDENT', 'ANIMAL'] as const;
type HazardType = typeof CLASSES[number];

class HazardDetectorWorker {
  private session: ort.InferenceSession | null = null;

  // -------------------------
  // LOAD MODEL
  // -------------------------
  async loadModel() {
    try {
      const modelUrl = `${baseUrl}/models/yolo26_fp32.onnx`;

      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      });

    } catch (e) {
      console.error('[Worker] Model load failed:', e);
    }
  }

  // -------------------------
  // SIGNING (Ed25519 via tweetnacl)
  // -------------------------
  private secretKey: Uint8Array | null = null;

  async importPrivateKey(base58SecretKey: string) {
    try {
      // Decode base58 secret key (64 bytes: 32 secret + 32 public)
      const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      let result = BigInt(0);
      for (const c of base58SecretKey) {
        result = result * BigInt(58) + BigInt(chars.indexOf(c));
      }
      const hex = result.toString(16).padStart(128, '0');
      this.secretKey = new Uint8Array(64);
      for (let i = 0; i < 64; i++) {
        this.secretKey[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
    } catch (e) {
      console.error('[Worker] Key import failed:', e);
    }
  }

  async signTelemetry(payload: any): Promise<string> {
    if (!this.secretKey) return 'TEST_MODE_SIGNATURE';

    // Sign the canonical payload string (must match backend validator)
    const payloadStr = `VIGIA:${payload.hazardType}:${payload.lat}:${payload.lon}:${payload.timestamp}:${payload.confidence}`;
    const message = new TextEncoder().encode(payloadStr);

    // Ed25519 sign (inline nacl.sign.detached — no import needed in worker)
    // We use the Web Crypto subtle API with Ed25519 if available, else fallback
    const sig = this.ed25519Sign(message, this.secretKey);

    // Encode as base58
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt(0);
    for (const b of sig) num = num * BigInt(256) + BigInt(b);
    let encoded = '';
    while (num > 0) { encoded = chars[Number(num % BigInt(58))] + encoded; num = num / BigInt(58); }
    return encoded || '1';
  }

  // Minimal Ed25519 sign — delegates to tweetnacl's algorithm
  // In production, import tweetnacl in the worker bundle
  private ed25519Sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
    // tweetnacl.sign.detached equivalent using Web Crypto is not available
    // So we use the nacl algorithm directly (bundled by esbuild)
    const nacl = (self as any).__nacl;
    if (nacl) return nacl.sign.detached(message, secretKey);
    // Fallback: return zeros (will fail verification — signals missing nacl)
    return new Uint8Array(64);
  }

  // -------------------------
  // SIZE PARSER (FIX)
  // -------------------------
  private parseSize(size: any) {
    let width = size?.width ?? size?.videoWidth ?? size;
    let height = size?.height ?? size?.videoHeight;

    if (!width || !height || isNaN(width) || isNaN(height)) {
      return { width: 640, height: 480 };
    }

    return { width, height };
  }

  // -------------------------
  // PREPROCESS (LETTERBOX)
  // -------------------------
  preprocess(frameBuffer: ArrayBuffer, size: any) {
    const { width, height } = this.parseSize(size);

    const rgba = new Uint8ClampedArray(frameBuffer);

    if (rgba.length !== 4 * width * height) {
      throw new Error(`Buffer size mismatch: got ${rgba.length}, expected ${4 * width * height} for ${width}x${height}`);
    }

    const scale = Math.min(INPUT_SIZE / width, INPUT_SIZE / height);
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);

    const dx = Math.floor((INPUT_SIZE - newW) / 2);
    const dy = Math.floor((INPUT_SIZE - newH) / 2);

    const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
    const ctx = canvas.getContext('2d')!;

    // letterbox background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);

    // source image
    const img = new ImageData(rgba, width, height);
    const tmp = new OffscreenCanvas(width, height);
    tmp.getContext('2d')!.putImageData(img, 0, 0);

    // draw resized
    ctx.drawImage(tmp, dx, dy, newW, newH);

    const resized = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;

    // HWC → CHW
    const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);

    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
      tensor[i] = resized[i * 4] / 255.0; // R
      tensor[i + INPUT_SIZE * INPUT_SIZE] = resized[i * 4 + 1] / 255.0; // G
      tensor[i + 2 * INPUT_SIZE * INPUT_SIZE] = resized[i * 4 + 2] / 255.0; // B
    }

    return { tensor, scale, dx, dy, srcW: width, srcH: height };
  }

  // -------------------------
  // MAIN INFERENCE
  // -------------------------
  async processFrame(
    frameBuffer: ArrayBuffer,
    size: any,
    gpsCoords: { lat: number; lon: number },
    driverWalletAddress?: string
  ) {
    if (!this.session) return null;

    try {
      const prep = this.preprocess(frameBuffer, size);

      const inputTensor = new ort.Tensor(
        'float32',
        prep.tensor,
        [1, 3, INPUT_SIZE, INPUT_SIZE]
      );

      const results = await this.session.run({ images: inputTensor });

      const output = results.output0.data as Float32Array;
      const dims = results.output0.dims;

      const channels = dims[1];
      const N = dims[2];

      let best = null;
      let maxScore = 0;
      let bestClassIdx = 0;

      // YOLO decode
      for (let i = 0; i < N; i++) {
        for (let c = 4; c < channels; c++) {
          const score = output[c * N + i];

          if (score > CONF_THRESHOLD && score > maxScore) {
            maxScore = score;
            bestClassIdx = c - 4;

            best = {
              x: output[0 * N + i],
              y: output[1 * N + i],
              w: output[2 * N + i],
              h: output[3 * N + i]
            };
          }
        }
      }

      if (!best) return null;

      // YOLO outputs are already in pixel coords [0-320], not normalized
      const boxX = best.x;
      const boxY = best.y;
      const boxW = best.w;
      const boxH = best.h;
      
      // Remove letterbox padding and scale back to original image
      const cx = (boxX - prep.dx) / prep.scale;
      const cy = (boxY - prep.dy) / prep.scale;
      const bw = boxW / prep.scale;
      const bh = boxH / prep.scale;
      
      const telemetry = {
        hazardType: (CLASSES[bestClassIdx] ?? 'POTHOLE') as HazardType,
        lat: gpsCoords.lat,
        lon: gpsCoords.lon,
        timestamp: new Date().toISOString(),
        confidence: parseFloat(maxScore.toFixed(4)),
        driverWalletAddress: driverWalletAddress ?? '',
      };

      const signature = await this.signTelemetry(telemetry);

      const bbox = {
        x: cx - bw / 2,
        y: cy - bh / 2,
        width: bw,
        height: bh
      };
      
      return {
        ...telemetry,
        signature,
        bbox
      };
    } catch (e) {
      console.error('[Worker] Inference error:', e);
      return null;
    }
  }
}

expose(new HazardDetectorWorker());