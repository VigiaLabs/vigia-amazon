# Engineering the RoadIntelligence IDE: a serverless brain that verifies road hazards, pays for truth, and shows its reasoning

*How we built the cloud that turns cryptographically-signed road events into a verified hazard map, a reward ledger, and a live multi-agent workspace, and the five design decisions behind it.*

A crowdsourced road-intelligence network has one problem that dwarfs all the others: how do you trust a submission? Anyone can POST a fake pothole. A compromised device can replay an old event. A spoofed camera frame can invent a hazard that was never there. And the moment you attach a reward to a submission, you have handed every bad actor a financial reason to lie. The VIGIA cloud — the RoadIntelligence IDE and the serverless backend behind it — is our answer to that problem: a system that verifies before it believes, pays only for verified truth, and shows an operator exactly how each decision was reached.

This is the overview. It links out to five deep dives, each on one decision that shaped the system. The code is open at [github.com/VigiaLabs/vigia-amazon](https://github.com/VigiaLabs/vigia-amazon).

## What the cloud does

In one sentence: it receives cryptographically-attested road-hazard events from Raspberry Pi edge nodes over MQTT and from the mobile app over HTTPS, verifies each one through a probabilistic vision-language and Bedrock agent pipeline, credits off-chain `$VIGIA` rewards to the contributing wallet, and exposes the resulting verified hazard map, ledger, maintenance queue, and payout flows to a frontend "IDE" for road intelligence.

Everything is serverless — Lambda behind API Gateway and IoT Core, DynamoDB, S3, Bedrock — so there is no always-on server and no idle cost. The shape is a pipeline: **ingest → verify → reward → analyse → surface.** A signed event enters through one of two authenticated doors, a stream carries it to an orchestrator that decides whether it is real, a verified event triggers an atomic reward and an on-chain settlement, and a set of intelligence agents turn the accumulated map into maintenance and planning decisions that the IDE renders with their reasoning attached.

## The five decisions worth reading about

Rather than one long article, we pulled out the five choices that were genuinely non-obvious, the ones where we picked the harder path for a reason. Each is a standalone post.

**Episode 1: Trust nothing you didn't verify.** Two ingestion doors, two cryptographic schemes. Every Pi event carries a hardware ECDSA signature over a 96-byte struct we reconstruct and re-hash byte-for-byte before we'll believe it; every mobile event is Ed25519-verified against a device registry; and both are protected against replay. *[Read Episode 1 →](https://ridingbluewaves.hashnode.dev/trust-nothing-you-didnt-verify)*

**Episode 2: Why the expensive AI only sees 2% of events.** Running a vision-language model on every submission would make cost scale with fraud attempts. So 98% of events are scored deterministically from the edge model's confidence, and only the ambiguous 2% go to Nova Lite and a Bedrock ReAct agent — with a spoofed frame costing the submitter their stake. *[Read Episode 2 →](https://ridingbluewaves.hashnode.dev/why-the-expensive-ai-only-sees-2-percent-of-events)*

**Episode 3: Paying a reward is a database transaction.** The instant money is attached to data, double-payment and replay become attacks. A reward credit is a single three-item DynamoDB transaction — a cooldown lock, a balance increment, and a hash-chained ledger entry — so paying twice for one hazard is structurally impossible, not just unlikely. *[Read Episode 3 →](https://ridingbluewaves.hashnode.dev/paying-a-reward-is-a-database-transaction)*

**Episode 4: Verification is decoupled from ingestion by a stream.** The door that accepts an event and the brain that judges it never call each other directly. A DynamoDB stream and an EventBridge pipe sit between them, filtered so the orchestrator only ever sees new events and the maintenance planner only ever sees verified ones. *[Read Episode 4 →](https://ridingbluewaves.hashnode.dev/verification-decoupled-from-ingestion-by-a-stream)*

**Episode 5: An IDE that shows its work.** The product is not a dashboard of numbers; it is a workspace where a Bedrock agent and a set of specialist intelligence functions reason over the verified map — and stream every step of that reasoning to the operator. Why we made the agent's trace a first-class, visible artifact. *[Read Episode 5 →](https://ridingbluewaves.hashnode.dev/an-ide-that-shows-its-work)*

## The thread running through all five

Looking back, the same instinct shows up in every one of these decisions. In a system where the input is adversarial and the output is money, correctness has to be structural, not aspirational. Verify with cryptography rather than trust a source. Spend the expensive model only where cheap determinism runs out, so an attacker cannot inflate your bill by attacking you. Make double-payment impossible with a transaction, not improbable with a check. Decouple the components with a stream so a slow judge never blocks the door. And when the system makes a judgement, show the reasoning, because an intelligence tool the operator cannot audit is one they cannot trust.

None of these are exotic on their own. The interesting part was deciding, for a cloud whose whole job is to separate real road hazards from profitable lies, where to place a cryptographic check, where to spend a model call, and where to let a database transaction do the work that a race condition would otherwise undo.

The full system is open at [github.com/VigiaLabs/vigia-amazon](https://github.com/VigiaLabs/vigia-amazon). This is part of an ongoing build series.

---

## 🎓 CS Fundamentals — study companion

*This backend is a distributed-systems syllabus: **System Design**, **DBMS**, **Computer Networks**, and **Security/Cryptography**. This overview frames them; the episodes go deep. Read before any systems-design or backend interview.*

### System Design

- **Serverless architecture.** All compute is Lambda (functions) behind API Gateway / IoT Core — no always-on servers, pay-per-invocation, auto-scaling, zero idle cost. The tradeoff: cold starts, statelessness, and vendor coupling. Serverless suits **spiky, event-driven** workloads (exactly this).
- **Event-driven / pipeline architecture.** The system is a chain: **ingest → verify → reward → analyse → surface**, where each stage is triggered by an event (an MQTT message, a stream record) rather than a direct call. Loose coupling = independent scaling and failure isolation.
- **The core thesis: adversarial input, financial output.** When users can lie and the output is money, **correctness must be structural** (cryptography, transactions, filters), not aspirational (checks, hope). Every episode is one instance of that.

### DBMS / Networks / Security (preview)
- **DBMS:** an atomic 3-item transaction makes double-payment impossible (Ep 3); DynamoDB streams (CDC) decouple stages (Ep 4).
- **CN:** two ingestion channels — MQTT over TLS from the Pi, HTTPS from the phone (Ep 1).
- **Security:** hardware ECDSA + software Ed25519 verification, replay defence, least-privilege IAM (Ep 1, 4).

### ⚖️ This vs That — the architecture decisions, and the roads not taken

| Decision | Alternatives | Why this choice |
|---|---|---|
| **Serverless (Lambda + managed services)** | A container/VM fleet (ECS/EC2) | A crowdsourced feed is spiky and unpredictable; paying for always-on servers wastes money at idle and caps you at peak. Serverless scales to zero and to spikes automatically — ideal for event-driven ingestion. |
| **Verify-then-trust** | Trust the client, validate loosely | The input is adversarial and the output is money; a loosely-validated submission is a paid exploit. Cryptographic verification is the only safe default. |
| **Event-driven pipeline** | One synchronous request handler doing everything | A monolithic handler couples slow verification to fast ingestion and can't scale stages independently. Events + streams decouple them. |

**The one to defend:** *structural correctness vs defensive checks.* The senior instinct in an adversarial, money-handling system is to make bad outcomes **unreachable states** — a signature that must verify, a transaction that can't double-commit, a filter that can't loop — rather than a pile of `if` checks you hope cover every case.
