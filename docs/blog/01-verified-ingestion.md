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
