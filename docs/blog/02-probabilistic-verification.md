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
