/**
 * SarvamProxyFn — server-side proxy for Sarvam AI STT and TTS APIs.
 *
 * Keeps the Sarvam API key out of mobile APKs. The key is stored in AWS
 * Secrets Manager and injected as a Lambda env var at deploy time.
 *
 * Routes:
 *   POST /sarvam-proxy/stt  — multipart/form-data (WAV) → transcript JSON
 *   POST /sarvam-proxy/tts  — JSON { text, target_language_code } → audio/wav bytes (base64)
 *
 * The Lambda forwards the request to Sarvam and streams the response back.
 * Caller must be authenticated (Cognito JWT via Authorization header) so the
 * proxy cannot be abused by anonymous callers.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const SARVAM_API_KEY = process.env.SARVAM_API_KEY!;
const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function err(statusCode: number, message: string): APIGatewayProxyResult {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: message }) };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const path = event.path ?? '';

  // ── STT proxy ─────────────────────────────────────────────────────────────
  if (path.endsWith('/stt')) {
    if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

    const contentType = event.headers['content-type'] ?? event.headers['Content-Type'] ?? '';
    if (!contentType.startsWith('multipart/form-data')) {
      return err(400, 'Content-Type must be multipart/form-data');
    }

    // Forward the raw body verbatim to Sarvam — API Gateway base64-encodes binary
    const bodyBytes = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64')
      : Buffer.from(event.body ?? '', 'utf-8');

    const response = await fetch(SARVAM_STT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'API-Subscription-Key': SARVAM_API_KEY,
      },
      body: bodyBytes,
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error(`[SarvamProxy/STT] Sarvam error ${response.status}: ${responseText}`);
      return err(response.status, `Sarvam STT error: ${response.status}`);
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: responseText,
    };
  }

  // ── TTS proxy ─────────────────────────────────────────────────────────────
  if (path.endsWith('/tts')) {
    if (event.httpMethod !== 'POST') return err(405, 'Method not allowed');

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(event.body ?? '{}');
    } catch {
      return err(400, 'Invalid JSON body');
    }

    const { text, target_language_code, speaker, pitch, pace } = parsed as any;
    if (typeof text !== 'string' || text.length === 0 || text.length > 500) {
      return err(400, 'text must be 1–500 characters');
    }
    if (typeof target_language_code !== 'string') {
      return err(400, 'target_language_code required');
    }

    const sarvamBody: Record<string, unknown> = {
      inputs: [text],
      target_language_code,
      speaker: speaker ?? 'meera',
    };
    if (pitch !== undefined) sarvamBody.pitch = pitch;
    if (pace !== undefined)  sarvamBody.pace  = pace;

    const response = await fetch(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'API-Subscription-Key': SARVAM_API_KEY,
      },
      body: JSON.stringify(sarvamBody),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error(`[SarvamProxy/TTS] Sarvam error ${response.status}: ${responseText}`);
      return err(response.status, `Sarvam TTS error: ${response.status}`);
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: responseText,
    };
  }

  return err(404, 'Not found');
};
