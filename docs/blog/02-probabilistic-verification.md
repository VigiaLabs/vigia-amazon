# Episode 2: Why the expensive AI only sees 2% of events

*Probabilistic verification — a deterministic fast path for 98% of events, a vision-language model and a Bedrock agent for the ambiguous 2%, and why running the model on everything would let an attacker inflate your cloud bill.*

The naive design for verifying road hazards is to run a vision-language model on every submission: look at the frame, decide if the pothole is real, done. It is also the design that quietly bankrupts you. A VLM call is expensive, and in a system where anyone can submit, "every event" is a number an attacker controls — flood the endpoint with garbage and you are paying Bedrock to look at all of it. So VIGIA verifies probabilistically: cheap determinism for the clear cases, the expensive model only where it earns its cost. This post is about that split.

This is Episode 2 of 5 in the Engineering RoadIntelligence IDE series. The full system overview is in the master post.

## The fast path: trust the edge model for the clear cases

Every hazard that reaches the orchestrator has already been through the cryptographic gate from Episode 1, so we know it came from a real, authenticated device. That device is not a dumb sensor — it ran a quantized ONNX detector at the edge before it ever transmitted, and its confidence score rides along with the event.

For the vast majority of events, that score is decisive. If the edge confidence is at or above the threshold, the hazard is marked VERIFIED deterministically; if it is clearly below, it is rejected. No model call, no image fetch, no reasoning — a comparison. This is the 98% path, and it costs effectively nothing per event. The key realisation was that a hardware-attested edge model's confidence is already a strong signal; re-deriving it in the cloud on every event would be paying twice for the same judgement.

## The slow path: a VLM and an agent for the ambiguous 2%

The remaining slice — the ambiguous middle, sampled probabilistically — is where the expensive machinery lives, and it is a genuine pipeline rather than a single call. The frame is pulled from S3 and passed to Amazon Nova Lite as a vision-language model, which returns its own confidence and a written rationale. Then one of three things happens:

- If the VLM's confidence is very low — below 0.1 — the frame is judged a spoof, and the event is not merely rejected. It triggers an asynchronous slash: the submitter's on-chain stake is cut and the device is blacklisted. Faking a hazard is not free; it is expensive to the faker.
- Otherwise, the event goes to a Bedrock **ReAct agent** with two tools — one to query existing nearby hazards, one to compute a score — and the agent reasons about whether the submission is consistent with what the network already knows. A score at or above the bar promotes the hazard to VERIFIED.
- A verified event then credits the reward (Episode 3) and is submitted to the chain for settlement.

The 2% is not just a cost lever; it is a **probabilistic audit.** You do not need to deeply inspect every submission to keep contributors honest — you need every submission to have a real chance of being the one that gets inspected, with a painful penalty if it turns out to be fake. Random deep checks plus slashing produce honesty far more cheaply than exhaustive checks would.

## Why probabilistic instead of "VLM everything" or "VLM nothing"

The two tempting extremes both fail. VLM-nothing (trust the edge score alone) is cheap but has no deterrent against a device that lies about its own confidence. VLM-everything is a strong deterrent but makes your cloud cost scale linearly with the number of events an attacker chooses to send — a denial-of-wallet vulnerability dressed up as thoroughness.

Probabilistic verification takes the useful middle. Per-event cost stays low and, crucially, *predictable* — it does not explode when submission volume spikes, because only a bounded fraction ever reaches the model. And the deterrent survives, because the expected cost of cheating (chance of audit × the slash) stays high even though the average cost of verifying stays low. We optimised for the cost curve under adversarial load, not the cost of the happy path.

## Takeaway

Verification is where the money is decided, so it is exactly where cost has to be bounded against an adversary who controls your input volume. The answer was to let a hardware-attested edge model resolve the clear 98% for free, spend the vision-language model and the reasoning agent only on a probabilistic 2%, and make that small sample bite — a spoofed frame costs the submitter their stake. Cheap where the answer is obvious, expensive only where it is not, and structured so that flooding the system with lies raises the attacker's cost, not ours.

The code is open at [github.com/VigiaLabs/vigia-amazon](https://github.com/VigiaLabs/vigia-amazon).

*Engineering RoadIntelligence IDE · Episode 2 of 5 — Previous: Episode 1. Next: Episode 3, Paying a reward is a database transaction.*

---

## 🎓 CS Fundamentals — study companion

*This episode blends **System Design** (cost under adversarial load), **Security** (economic security — staking/slashing, denial-of-wallet), **Statistics** (sampling/probabilistic auditing), and **ML systems** (VLMs, ReAct agents).*

### System Design — cost under an adversary

- **Denial-of-Wallet (DoW).** In serverless, an attacker who can trigger expensive work can inflate *your* bill instead of taking you offline — the pay-per-use analogue of DDoS. Running a VLM on every submission means cost scales with fraud volume, which the attacker controls. The 2%/98% split **bounds** per-event cost so flooding raises the attacker's cost, not yours.
- **Tiered processing (cheap-fast / expensive-slow).** 98% resolved by a cheap deterministic threshold on the edge model's confidence; 2% escalated to the pricey VLM + agent. This is the same pattern as a CDN cache (cheap hit / expensive origin) or a fast-path/slow-path CPU — spend the expensive resource only where the cheap one runs out.

### Security — economic / crypto-economic

- **Staking & slashing.** Contributors put up a stake; a submission judged a spoof (VLM confidence < 0.1) triggers a **slash** — the stake is cut and the device blacklisted. This makes cheating *costly*, aligning incentives without needing to inspect every event. It's the same mechanism proof-of-stake blockchains use to punish misbehaviour.
- **Probabilistic auditing / random inspection.** You don't need to deeply check every submission to keep people honest — you need every submission to have a real *chance* of a deep check, with a painful penalty if it fails. Expected cost of cheating = P(audit) × penalty. Same logic as tax audits and QA sampling.

### Statistics
- **Sampling.** Inspecting a random 2% and extrapolating (plus deterrence) is statistical sampling — bounded cost, high confidence in aggregate, without a census.

### Machine Learning (systems)
- **VLM + ReAct agent.** A Vision-Language Model scores the frame with a rationale; a **ReAct** (Reason + Act) agent then loops *thought → tool call → observation → thought* (here: query nearby hazards, compute a score) to reach a verdict. ReAct is the dominant pattern for tool-using LLM agents — worth knowing by name.

**Interview Q&A.**
1. *What is Denial-of-Wallet and how do you defend against it?* → Attacker triggers expensive pay-per-use work to inflate your bill; defend by bounding/capping expensive work, rate-limiting, and making the cheap path handle the bulk.
2. *How do you keep contributors honest without checking every submission?* → Random deep audits + a penalty (slashing/staking); expected cheating cost = P(caught) × penalty.
3. *Design a verification system whose cost doesn't explode under attack.* → Deterministic cheap path for the clear majority, sampled expensive path for the ambiguous minority, economic penalty for detected fraud.
4. *What is the ReAct agent pattern?* → Interleave reasoning with tool calls and observations until the agent reaches an answer.

### ⚖️ This vs That — the architecture decisions, and the roads not taken

| Decision | Alternatives | Why this choice |
|---|---|---|
| **Probabilistic verification (2% VLM)** | VLM every event; or trust the edge score for all | "VLM everything" is a denial-of-wallet vulnerability (cost scales with attacker volume). "Trust everything" has no deterrent against a lying device. Sampling + slashing gets the deterrent at bounded cost. |
| **Deterministic fast path for 98%** | Re-run a cloud model on every event | The hardware-attested edge confidence is already a strong signal; re-deriving it per event pays twice for one judgement. |
| **Slash + blacklist on spoof** | Just reject the bad event | Rejection alone leaves cheating free to retry. A stake penalty makes fraud *expensive*, which is what actually deters it. |

**The one to defend:** *bounded/probabilistic cost vs exhaustive verification.* The mature answer optimises the **cost curve under adversarial load**, not the happy path: let cheap determinism handle the obvious, spend the expensive model on a random sample, and make detected fraud costly — so the attacker's expected cost stays high while your average cost stays low and *predictable*.
