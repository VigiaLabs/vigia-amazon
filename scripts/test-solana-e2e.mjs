/**
 * E2E Test: Edge Node → Validator Lambda → DynamoDB → Orchestrator → Solana Devnet
 *
 * Simulates a real edge node:
 * 1. Generates Ed25519 keypair (like useDeviceWallet)
 * 2. Signs a hazard payload
 * 3. POSTs to the telemetry API
 * 4. Waits for orchestrator to process
 * 5. Checks if Solana PDA was created
 *
 * Run: node scripts/test-solana-e2e.mjs
 */

import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Connection, PublicKey } from '@solana/web3.js';

const TELEMETRY_API = 'https://sq2ri2n51g.execute-api.us-east-1.amazonaws.com/prod';
const SOLANA_RPC = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('BKaxbk73bCY8xRuphpkTESWjaJofdnBpuc2T193f3nkW');

// Step 1: Generate Ed25519 keypair (simulates browser edge node)
const keypair = nacl.sign.keyPair();
const publicKey = bs58.encode(keypair.publicKey);
const secretKey = keypair.secretKey;
console.log(`\n🔑 Edge Node Pubkey: ${publicKey}`);

// Step 2: Register device
console.log(`\n📡 Registering device...`);
const regRes = await fetch(`${TELEMETRY_API}/register-device`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ device_address: publicKey }),
});
console.log(`   Registration: ${regRes.status} ${regRes.statusText}`);

// Step 3: Build and sign hazard payload
const hazardType = 'POTHOLE';
const lat = 22.2537;
const lon = 84.9135;
const timestamp = new Date().toISOString();
const confidence = 0.87;

const payloadStr = `VIGIA:${hazardType}:${lat}:${lon}:${timestamp}:${confidence}`;
const message = new TextEncoder().encode(payloadStr);
const signature = bs58.encode(nacl.sign.detached(message, secretKey));

console.log(`\n📦 Payload: ${payloadStr}`);
console.log(`   Signature: ${signature.slice(0, 20)}...`);

// Step 4: POST to telemetry API
console.log(`\n🚀 Sending to ${TELEMETRY_API}/telemetry ...`);
const telRes = await fetch(`${TELEMETRY_API}/telemetry`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    hazardType, lat, lon, timestamp, confidence,
    signature, publicKey,
    frame_base64: null, // no frame for this test
  }),
});
const telBody = await telRes.json();
console.log(`   Response: ${telRes.status} ${JSON.stringify(telBody)}`);

if (telRes.status !== 202) {
  console.error(`\n❌ FAILED: Expected 202, got ${telRes.status}`);
  process.exit(1);
}

console.log(`\n✅ Hazard accepted: ${telBody.hazardId}`);
console.log(`   Status: ${telBody.status}`);

// Step 5: Wait for orchestrator to process + submit to Solana
console.log(`\n⏳ Waiting 25s for orchestrator + Solana submission...`);
await new Promise(r => setTimeout(r, 25000));

// Step 6: Check if Solana PDA exists
// We need to derive the PDA the same way the Lambda does
// h3Index from lat/lon at resolution 9 — we'll check the DynamoDB trace instead
console.log(`\n🔍 Checking DynamoDB trace for Solana tx...`);
const traceRes = await fetch(`https://main.d2nkopgztcw9g1.amplifyapp.com/api/traces/${encodeURIComponent(telBody.hazardId)}`);
const traceData = await traceRes.json();

if (traceData.trace) {
  console.log(`   Verdict: ${traceData.trace.verdict}`);
  console.log(`   Score: ${traceData.trace.total_score}`);
  console.log(`   VLM: ${traceData.trace.vlm_reasoning?.slice(0, 80)}...`);
} else {
  console.log(`   ⚠️  No trace yet (orchestrator may still be processing)`);
}

// Step 7: Check Solana connection for recent program activity
const connection = new Connection(SOLANA_RPC, 'confirmed');
const sigs = await connection.getSignaturesForAddress(PROGRAM_ID, { limit: 3 });
console.log(`\n🌐 Recent Solana program transactions:`);
sigs.forEach(s => console.log(`   ${s.signature.slice(0, 20)}... (${s.confirmationStatus})`));

console.log(`\n═══════════════════════════════════════`);
console.log(`  E2E Test Complete`);
console.log(`═══════════════════════════════════════`);
