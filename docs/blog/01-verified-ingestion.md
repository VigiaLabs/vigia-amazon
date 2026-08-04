# Episode 1: Trust nothing you didn't verify

*Two ingestion doors, two cryptographic schemes — hardware ECDSA from the Pi, Ed25519 from the phone — and why the cloud reconstructs a 96-byte struct byte-for-byte before it believes a single hazard.*

The first question a crowdsourced hazard network has to answer is not "where is the pothole" but "should I believe the device that told me about it." Every event that enters the VIGIA cloud is a claim from a device we do not physically control, on a network we do not own, and — because verified events earn rewards — with a financial incentive to lie. So the entry point is built on a simple rule: the cloud believes nothing it has not cryptographically verified itself. This post is about the two doors that rule created.

This is Episode 1 of 5 in the Engineering RoadIntelligence IDE series. The full system overview is in the master post.

## Two sources, two threat models, two schemes

Events arrive from two places, and they are not equally trustworthy, so they are not verified the same way.

The **Raspberry Pi edge node** publishes over MQTT to AWS IoT Core, and it carries a signature from a dedicated hardware security chip, an ATECC608A. That chip holds a private key that never leaves it, and it signs with ECDSA over the P-256 curve. This is the strong path: the signature proves the event came from a specific, provisioned piece of hardware.

The **mobile app** submits over HTTPS, and it signs with Ed25519 — the same wallet key from the app's own key hierarchy. This is a softer guarantee (a phone is a general-purpose device, not a secure element), so it is backed by a registry: the submitting device must be known and not blacklisted before the signature even matters.

Using one scheme for both would have meant either weakening the hardware path down to what a phone can do, or demanding hardware guarantees a phone cannot give. Matching the scheme to the source is what lets each path be as strong as its hardware actually allows.

## Verifying the Pi means rebuilding the message it signed

The interesting part of the hardware path is that a signature is only meaningful if you know *exactly* what bytes were signed. The ATECC608A did not sign the friendly decoded event; it signed a hash of a tightly packed 96-byte structure — device id, microcontroller timestamp, a sequence number, a quaternion, accelerometer and IMU-calibration values, latitude and longitude, altitude, speed, course, GPS-fix state, and HDOP — laid out in a fixed order with fixed widths.

So the cloud does not take the payload's word for anything. The attestation function decodes the MsgPack message, **reconstructs that 96-byte struct field by field**, computes its SHA-256, and compares that to the hash embedded in the payload. Only if the hash matches does it run the ECDSA P-256 verification against the reconstructed hash. If a single field was tampered with in transit, the reconstructed hash won't match and the event is rejected before the signature check even runs. The verification is not "does this signature look valid" — it is "does this signature correspond to a message I have independently rebuilt from the raw fields."

## Replay is a separate attack, so it gets a separate defence

A valid signature proves authenticity, but it does nothing about replay: an attacker who captures a genuinely-signed event can resend it. So both paths carry an anti-replay defence, and both push it down into the database where it can be enforced atomically.

The Pi path uses a **monotonic sequence watermark.** Each device's registry row records the last sequence number it successfully attested, and the write is a conditional DynamoDB update — accepted only if the incoming sequence is greater than the stored one (or the device is brand new). A replayed event carries an old sequence number, fails the condition, and is dropped. The mobile path uses a **freshness window** instead: the signed message includes a timestamp, and a submission more than ten minutes old is refused. Same goal, two mechanisms suited to the two sources.

One more thing rides along on the mobile path: if a submission includes a camera frame, the SHA-256 of that frame is folded into the signed message. So the signature covers not just the claim but the specific image behind it — you cannot keep a valid signature and swap the photo.

## Verify first, then dedup by place

Only after an event survives all of that does it become a hazard. The verified event is indexed into an H3 geospatial cell (resolution 10) and checked against recent hazards in the same cell, so twenty devices reporting the same pothole in the same hour update one hazard rather than creating twenty. But that deduplication runs *after* verification, never before — the system never lets an unverified event influence the map, even to merge.

## Takeaway

The entry point's whole job is to be adversarial about its input. Match the cryptographic scheme to what each source's hardware can actually prove; verify a hardware signature by rebuilding the exact bytes it signed rather than trusting the decoded form; treat replay as its own attack and stop it with an atomic database condition; and bind the evidence, down to the image hash, into the thing being signed. Everything downstream — the reward, the map, the agent reasoning — is only as trustworthy as this gate, so this gate assumes everyone is lying until the cryptography says otherwise.

The code is open at [github.com/VigiaLabs/vigia-amazon](https://github.com/VigiaLabs/vigia-amazon).

*Engineering RoadIntelligence IDE · Episode 1 of 5 — Next: Episode 2, Why the expensive AI only sees 2% of events.*

---

## 🎓 CS Fundamentals — study companion

*This is the **Cryptography & Security** episode, with **Computer Networks** alongside. Public-key crypto, hashing, replay defence, and hardware key storage are high-value interview topics — and rarely explained this concretely.*

### Cryptography & Security

- **Symmetric vs asymmetric crypto.** *Symmetric* (AES, HMAC): both sides share one secret key — fast, but you must distribute the secret. *Asymmetric* (RSA, ECDSA, Ed25519): a keypair; the **private** key signs, the **public** key verifies, and the private key never leaves its owner. SAGE— sorry, VIGIA — uses asymmetric so the cloud can verify a device without ever holding its secret.
- **Digital signatures.** Sign = encrypt a *hash* of the message with the private key; verify = check it with the public key. This proves **authenticity** (who sent it) and **integrity** (it wasn't altered). Two curves here: **ECDSA over P-256** (from the Pi's ATECC608A hardware chip) and **Ed25519** (from the phone). Both are elliptic-curve schemes; Ed25519 is faster and has fewer footguns, ECDSA is what the hardware secure element supports.
- **Cryptographic hashing (SHA-256).** A one-way function mapping any input to a fixed 256-bit digest: deterministic, collision-resistant, avalanche effect. The cloud **reconstructs the exact 96-byte struct and re-hashes it**, then checks the signature against that hash — so a single flipped bit changes the hash and fails verification. *You must sign/verify over the exact same bytes.*
- **Hardware security module / secure element.** The ATECC608A is a **tamper-resistant chip** whose private key is generated inside and never extractable. This is why the Pi path is the "strong" one — the key can't be stolen even from a compromised host. (The phone's key is software-wrapped — softer, hence the extra device-registry check.)
- **Replay attacks & their defences.** A valid signature doesn't stop an attacker *resending* a captured-but-genuine message. Two classic defences, both used here: a **monotonic sequence number** (nonce) enforced by a conditional DB write — an old sequence is rejected; and a **timestamp freshness window** (±10 min) — a stale message is refused. Nonce = "number used once."
- **Binding evidence into the signature.** Folding the frame's SHA-256 into the signed message means you can't keep a valid signature and swap the photo — the signature covers the *specific* image. This is how you prevent content substitution.

**Interview Q&A.**
1. *Symmetric vs asymmetric encryption — when each?* → Symmetric for bulk speed with a shared secret (TLS session); asymmetric for identity/signatures/key-exchange without sharing a secret.
2. *How does a digital signature work?* → Sign a hash with the private key; verify with the public key; gives authenticity + integrity (+ non-repudiation).
3. *What properties does a cryptographic hash need?* → One-way (preimage resistance), collision resistance, deterministic, avalanche.
4. *What is a replay attack and how do you prevent it?* → Resending a valid captured message; prevent with nonces/sequence numbers or timestamp windows (or both).
5. *Why store keys in a secure element vs software?* → Non-extractable, tamper-resistant; survives a compromised host — the strongest identity guarantee available on a device.
6. *How would you stop someone swapping the image behind a signed claim?* → Include the image's hash in the signed payload.

### Computer Networks

- **MQTT vs HTTPS.** The Pi publishes over **MQTT** — a lightweight **pub/sub** protocol for constrained/IoT devices: a client publishes to a *topic*, brokers fan out to subscribers, low overhead, works on flaky links, supports QoS levels. The phone uses **HTTPS** — request/response over TLS. Choosing per device: MQTT for always-on telemetry from tiny devices, HTTPS for app-initiated requests.
- **TLS.** Both channels run over **TLS**: asymmetric handshake to agree a symmetric session key, then symmetric encryption for speed — plus server (and here, device) authentication. This is the canonical "asymmetric to bootstrap, symmetric to run" pattern.
- **Topic-scoped authorization.** Each Pi's IoT policy restricts it to its own `${clientId}` topic — a device can publish only as itself. Network-layer least privilege.

**Interview Q&A.**
1. *MQTT vs HTTP — when do you pick MQTT?* → Pub/sub telemetry from many constrained devices, unreliable networks, low overhead, server-push; HTTP for request/response app traffic.
2. *How does TLS combine symmetric and asymmetric crypto?* → Asymmetric handshake authenticates + exchanges a key; symmetric encrypts the bulk session (performance).

### ⚖️ This vs That — the architecture decisions, and the roads not taken

| Decision | Alternatives | Why this choice |
|---|---|---|
| **Asymmetric verification (ECDSA / Ed25519)** | Symmetric HMAC with a shared key | A shared secret must be distributed and stored on every device — a huge attack surface, and impossible with a non-extractable hardware key. Asymmetric lets the cloud verify without holding any secret. |
| **Reconstruct-and-rehash the struct** | Trust the decoded payload's fields | A signature only means something over exact bytes; verifying the decoded form lets a tampered field slip through. Rebuild the signed bytes and check the hash first. |
| **Per-source scheme (hardware ECDSA vs software Ed25519 + registry)** | One scheme for both | A hardware chip and a general-purpose phone offer different guarantees; matching the scheme (and adding a registry for the softer path) makes each as strong as its hardware allows. |
| **Sequence watermark (Pi) + timestamp window (phone)** | No replay defence; or one mechanism for both | Replay is a separate attack from forgery; the Pi's monotonic counter and the phone's freshness window each suit their source. |

**The one to defend:** *asymmetric vs symmetric, driven by key storage.* The clean answer connects crypto to hardware: **you can't do symmetric HMAC with a key that hardware refuses to export, so non-extractable secure-element keys force an asymmetric design — which is also strictly safer (no shared secret to leak).** The platform constraint points at the correct cryptography.
