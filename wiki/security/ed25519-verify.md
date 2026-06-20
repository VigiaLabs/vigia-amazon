---
title: "Ed25519 Mobile Verify"
type: security
tags: [#security, ingestion]
source: packages/backend/src/validator/index.ts
related: ["[[validator-fn]]", "[[register-device-fn]]", "[[wallet-ownership-proof]]", "[[vigia-device-registry]]", "[[mobile-ingest-flow]]"]
updated: 2026-06-20
---

# Ed25519 Mobile Verify

Mobile app (Android/iOS) signs telemetry with a Solana wallet Ed25519 keypair. Lambda verifies using `tweetnacl`.

**Library:** `tweetnacl` (v1.0.3) — constant-time, audited JS implementation

## Message Formats

| Context | Format |
|---|---|
| Device registration | `VIGIA-REGISTER:<device_address>` |
| Hazard telemetry | `VIGIA:<type>:<lat>:<lon>:<ts>:<conf>[:<frame_sha256>]` |
| Balance query / payout | `VIGIA-BALANCE:<wallet>:<tsMs>` |

## Verification Code (validator/index.ts:70)

```ts
const msg     = new TextEncoder().encode(message);
const sigB    = bs58.decode(sig_base58);         // 64 bytes
const pubB    = bs58.decode(wallet_address);     // 32 bytes
const ok      = nacl.sign.detached.verify(msg, sigB, pubB);
```

The signed message bytes are reconstructed server-side from wire values. Any field tampering → verify fails.

## Frame SHA-256 Binding

When `frame_base64` is present, the validator computes `SHA-256(frame bytes)` and appends it to the signed message (`:<sha256>`). This prevents MITM frame swap attacks.

## Links

- [[validator-fn]] — telemetry verify
- [[register-device-fn]] — registration verify
- [[rewards-balance-fn]], [[stripe-payout-fn]] — balance/payout verify via [[wallet-ownership-proof]]
- [[wallet-ownership-proof]] — describes the VIGIA-BALANCE proof pattern
- [[vigia-device-registry]] — blacklist check after verify passes
- [[mobile-ingest-flow]] — end-to-end flow
