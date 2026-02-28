'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Film, Key, Play, Square,
  AlertTriangle, CheckCircle, Cpu,
  FileVideo, X, Zap,
} from 'lucide-react';
import { useHazardDetector } from '../hooks/useHazardDetector';

export type SignedTelemetry = {
  hazardType: string;
  lat: number;
  lon: number;
  timestamp: string;
  confidence: number;
  signature: string;
  bbox?: { x: number; y: number; width: number; height: number };
};

// ─────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────

const C = {
  bg:      '#0C1016',
  panel:   '#141920',
  elevated:'#181E27',
  border:  'rgba(255,255,255,0.07)',
  borderMd:'rgba(255,255,255,0.11)',
  text:    '#DDE3ED',
  textSec: '#7C8799',
  textMut: '#3D4655',
  accent:  '#1D4ED8',
  accentBrt:'#3B82F6',
  green:   '#0EA472',
  red:     '#E5484D',
  yellow:  '#E9A23B',
};

// ─────────────────────────────────────────────
// DropZone
// ─────────────────────────────────────────────

interface DropZoneProps {
  accept:     string;
  onFile:     (f: File) => void;
  label:      string;
  sublabel?:  string;
  icon:       React.ReactNode;
  file?:      File | null;
  compact?:   boolean;
}

function DropZone({ accept, onFile, label, sublabel, icon, file, compact }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }, [onFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={{
        borderRadius: 4,
        padding: compact ? '10px 14px' : '18px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      <div style={{
        width: compact ? 32 : 40,
        height: compact ? 32 : 40,
        borderRadius: 6,
        background: file
          ? 'rgba(14,164,114,0.12)'
          : dragOver
          ? 'rgba(59,130,246,0.12)'
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${file ? 'rgba(14,164,114,0.3)' : dragOver ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s',
        color: file ? C.green : dragOver ? C.accentBrt : C.textMut,
      }}>
        {file ? <CheckCircle size={compact ? 14 : 18} /> : icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.76rem', color: C.text, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
          {file ? file.name : label}
        </div>
        {file ? (
          <div style={{ fontSize: '0.66rem', color: C.textSec, fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
            {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'unknown'}
          </div>
        ) : (
          <div style={{ fontSize: '0.66rem', color: C.textMut, fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
            {sublabel ?? 'Drag & drop or click to browse'}
          </div>
        )}
      </div>

      {file && (
        <div style={{
          fontSize: '0.6rem', padding: '2px 6px', borderRadius: 3,
          background: 'rgba(14,164,114,0.12)', color: C.green,
          fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
          flexShrink: 0,
        }}>
          READY
        </div>
      )}

      {!file && (
        <div style={{ color: C.textMut, flexShrink: 0 }}>
          <Upload size={13} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Detection stat badge
// ─────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 2, padding: '8px 14px',
      background: `${color}10`,
      border: `1px solid ${color}28`,
      borderRadius: 4, flex: 1,
    }}>
      <span style={{ fontSize: '1rem', fontWeight: 600, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: '0.6rem', color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif' }}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// VideoUploader — ALL original logic preserved
// ─────────────────────────────────────────────

export function VideoUploader() {
  const [videoFile,       setVideoFile]       = useState<File | null>(null);
  const [isProcessing,    setIsProcessing]    = useState(false);
  const [telemetryBatch,  setTelemetryBatch]  = useState<SignedTelemetry[]>([]);
  const [privateKeyLoaded, setPrivateKeyLoaded] = useState(false);
  const [detectionCount,  setDetectionCount]  = useState(0);
  const [currentDetection, setCurrentDetection] = useState<SignedTelemetry | null>(null);
  const [totalSent,       setTotalSent]       = useState(0);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { processFrame, loadPrivateKey } = useHazardDetector();

  const simulatedGPS = { lat: 37.7749, lon: -122.4194 };

  // ── All original handlers preserved ───────
  const handleVideoFile = (file: File) => {
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    if (videoRef.current) videoRef.current.src = url;
  };

  const handleKeyFile = async (file: File) => {
    const text = await file.text();
    await loadPrivateKey(text);
    setPrivateKeyLoaded(true);
  };

  const extractFrame = (video: HTMLVideoElement): ArrayBuffer => {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 640;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, 640, 640);
    return ctx.getImageData(0, 0, 640, 640).data.buffer;
  };

  const drawDetections = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    const ctx    = canvas.getContext('2d')!;
    canvas.width  = video.clientWidth;
    canvas.height = video.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentDetection?.bbox) {
      const { x, y, width, height } = currentDetection.bbox;
      const scaleX = canvas.width / 320;
      const scaleY = canvas.height / 320;
      const x1 = x * scaleX, y1 = y * scaleY;
      const w  = width * scaleX, h = height * scaleY;

      // Glowing box for dark theme
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = 'rgba(59,130,246,0.6)';
      ctx.shadowBlur  = 8;
      ctx.strokeRect(x1, y1, w, h);
      ctx.shadowBlur  = 0;

      // Corner marks
      const cs = 8;
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth   = 2;
      [
        [x1, y1, x1+cs, y1, x1, y1+cs],
        [x1+w-cs, y1, x1+w, y1, x1+w, y1+cs],
        [x1, y1+h-cs, x1, y1+h, x1+cs, y1+h],
        [x1+w-cs, y1+h, x1+w, y1+h, x1+w, y1+h-cs],
      ].forEach(([ax, ay, bx, by, cx, cy]) => {
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke();
      });

      // Label
      const label = `POTHOLE  ${(currentDetection.confidence * 100).toFixed(0)}%`;
      ctx.font = '9px JetBrains Mono, monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(14,17,23,0.88)';
      ctx.fillRect(x1, y1 - 18, tw + 10, 16);
      ctx.fillStyle = '#3B82F6';
      ctx.fillText(label, x1 + 5, y1 - 7);
    }
  };

  const startProcessing = () => {
    if (!videoRef.current) return;
    setIsProcessing(true);
    setDetectionCount(0);
    videoRef.current.play();
    intervalRef.current = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused) {
        const frameBuffer = extractFrame(videoRef.current);
        const result      = await processFrame(frameBuffer, simulatedGPS);
        if (result) {
          setTelemetryBatch(prev => [...prev, result]);
          setDetectionCount(prev => prev + 1);
          setCurrentDetection(result);
          setTimeout(() => setCurrentDetection(null), 100);
        }
      }
    }, 200);
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    videoRef.current?.pause();
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => { drawDetections(); }, [currentDetection]);

  // Batch send — original logic preserved
  useEffect(() => {
    if (!isProcessing) return;
    const batchInterval = setInterval(async () => {
      if (telemetryBatch.length > 0) {
        for (const telemetry of telemetryBatch) {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/telemetry`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(telemetry),
            });
            if (!response.ok) console.error('Failed to send telemetry:', await response.text());
            else setTotalSent(p => p + 1);
          } catch (error) {
            console.error('Network error:', error);
          }
        }
        setTelemetryBatch([]);
      }
    }, 5000);
    return () => clearInterval(batchInterval);
  }, [isProcessing, telemetryBatch]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Page header ───────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Film size={15} style={{ color: C.accentBrt }} />
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: C.text, letterSpacing: '-0.01em', fontFamily: 'Inter, sans-serif' }}>
              Sentinel Eye
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: C.textMut, fontFamily: 'Inter, sans-serif', margin: 0 }}>
            ONNX-powered real-time pothole detection · edge telemetry signing
          </p>
        </div>

        {isProcessing && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 4,
            background: 'rgba(229,72,77,0.1)',
            border: '1px solid rgba(229,72,77,0.25)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} className="pulse" />
            <span style={{ fontSize: '0.68rem', color: C.red, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              SCANNING
            </span>
          </div>
        )}
      </div>

      {/* ── Upload section ────────────────── */}
      <div style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 14px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Upload size={11} style={{ color: C.textMut }} />
          <span style={{ fontSize: '0.68rem', color: C.textMut, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
            Input Files
          </span>
        </div>

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DropZone
            accept="video/*"
            onFile={handleVideoFile}
            label="Drop video file here"
            sublabel="MP4, MOV, AVI — Drag & drop or click to browse"
            icon={<FileVideo size={18} />}
            file={videoFile}
          />
          <DropZone
            accept=".pem"
            onFile={handleKeyFile}
            label="Drop private key (.pem)"
            sublabel="Optional — test mode enabled without key"
            icon={<Key size={16} />}
            file={null}
            compact
          />
          {privateKeyLoaded && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 3,
              background: 'rgba(14,164,114,0.08)',
              border: '1px solid rgba(14,164,114,0.2)',
            }}>
              <CheckCircle size={11} style={{ color: C.green }} />
              <span style={{ fontSize: '0.68rem', color: C.green, fontFamily: 'JetBrains Mono, monospace' }}>
                Private key loaded · signing enabled
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Video + detection ─────────────── */}
      {videoFile && (
        <>
          <div style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            overflow: 'hidden',
          }}>
            {/* Video toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px',
              borderBottom: `1px solid ${C.border}`,
            }}>
              <Film size={11} style={{ color: C.textMut }} />
              <span style={{ fontSize: '0.68rem', color: C.textMut, fontFamily: 'JetBrains Mono, monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {videoFile.name}
              </span>
              <button
                onClick={() => { setVideoFile(null); stopProcessing(); }}
                style={{
                  background: 'none', border: 'none',
                  color: C.textMut, cursor: 'pointer', display: 'flex', padding: 2,
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = C.red}
                onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = C.textMut}
              >
                <X size={12} />
              </button>
            </div>

            {/* Video canvas */}
            <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

              {/* LIVE badge */}
              {isProcessing && (
                <div style={{
                  position: 'absolute', top: 10, left: 10,
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px', borderRadius: 3,
                  background: 'rgba(12,16,22,0.88)',
                  border: '1px solid rgba(229,72,77,0.35)',
                  backdropFilter: 'blur(6px)',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} className="pulse" />
                  <span style={{ fontSize: '0.62rem', color: C.red, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, letterSpacing: '0.08em' }}>
                    LIVE
                  </span>
                </div>
              )}

              {/* Detection counter */}
              {isProcessing && (
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  padding: '4px 8px', borderRadius: 3,
                  background: 'rgba(12,16,22,0.88)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(6px)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Zap size={9} style={{ color: C.yellow }} />
                    <span style={{ fontSize: '0.65rem', color: C.text, fontFamily: 'JetBrains Mono, monospace' }}>
                      {detectionCount} detections
                    </span>
                  </div>
                </div>
              )}

              {/* Telemetry log overlay */}
              {isProcessing && telemetryBatch.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(12,16,22,0.92)',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  padding: '6px 10px',
                  backdropFilter: 'blur(6px)',
                }}>
                  {telemetryBatch.slice(-3).map((t, i) => (
                    <div key={i} className="log-line" style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: '0.62rem', color: C.textSec,
                      fontFamily: 'JetBrains Mono, monospace',
                      marginBottom: i < 2 ? 2 : 0,
                    }}>
                      <span style={{ color: C.textMut }}>›</span>
                      <span style={{ color: C.red }}>{t.hazardType}</span>
                      <span style={{ color: C.textMut }}>@</span>
                      <span>{t.lat.toFixed(4)},{t.lon.toFixed(4)}</span>
                      <span style={{ color: C.textMut }}>│</span>
                      <span style={{ color: C.accentBrt }}>conf: {(t.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Stats row ─────────────────── */}
          {isProcessing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <StatBadge label="Detections" value={detectionCount} color={C.red}       />
              <StatBadge label="Transmitted" value={totalSent}     color={C.green}     />
              <StatBadge label="Queued"      value={telemetryBatch.length} color={C.yellow} />
              <StatBadge label="FPS"         value="5"             color={C.accentBrt} />
            </div>
          )}

          {/* ── Controls ──────────────────── */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={startProcessing}
              disabled={isProcessing}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 4,
                border: 'none',
                background: isProcessing ? 'rgba(29,78,216,0.3)' : C.accent,
                color: isProcessing ? 'rgba(255,255,255,0.4)' : '#fff',
                fontSize: '0.76rem', fontWeight: 500,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isProcessing) (e.currentTarget as HTMLElement).style.background = '#1e40af';
              }}
              onMouseLeave={(e) => {
                if (!isProcessing) (e.currentTarget as HTMLElement).style.background = C.accent;
              }}
            >
              <Play size={13} />
              Start Detection
            </button>

            <button
              onClick={stopProcessing}
              disabled={!isProcessing}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 4,
                border: `1px solid ${isProcessing ? 'rgba(229,72,77,0.4)' : C.border}`,
                background: isProcessing ? 'rgba(229,72,77,0.1)' : 'rgba(255,255,255,0.03)',
                color: isProcessing ? C.red : C.textMut,
                fontSize: '0.76rem', fontWeight: 500,
                cursor: !isProcessing ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              <Square size={13} />
              Stop
            </button>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 3,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${C.border}`,
              }}>
                <Cpu size={10} style={{ color: C.textMut }} />
                <span style={{ fontSize: '0.66rem', color: C.textMut, fontFamily: 'JetBrains Mono, monospace' }}>
                  ONNX · 5fps · edge-signed
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
