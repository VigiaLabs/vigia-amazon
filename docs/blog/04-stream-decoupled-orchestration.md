# Episode 4: Verification is decoupled from ingestion by a stream

*Why the door that accepts an event and the brain that judges it never call each other, how a filtered DynamoDB stream sits between them, and why one filter is the difference between a pipeline and an infinite loop.*

There are two obvious ways to wire "accept a hazard" to "verify a hazard." Call the verifier synchronously from the ingest handler, or fire off an async invocation. Both couple the door to the brain: the door's latency, reliability, and scaling become hostage to the verifier's. VIGIA does neither. Ingestion and verification communicate only through the database itself — a change to a hazard's row is the message. This post is about why that indirection was worth it, and about the small filter that keeps it from eating itself.

This is Episode 4 of 5 in the Engineering RoadIntelligence IDE series. The full system overview is in the master post.

## The door's only job is to persist a fact

When an event clears the cryptographic gate, the ingest function does something deliberately minimal: it writes the hazard to the table with a `PENDING` status and returns. It does not verify anything, it does not call an agent, it does not wait. The submitter gets a fast, cheap acknowledgement that the event was accepted, and the expensive judgement happens later, out of the request path.

This matters because the verification path from Episode 2 can be slow — an S3 fetch, a vision-language model, a reasoning agent. If the mobile POST or the IoT rule had to wait for all that, ingestion latency would be governed by the slowest verification, and a burst of submissions would back up at the front door. Separating "accept the fact" from "judge the fact" lets each run at its own pace.

## The stream is the message bus

The link between them is a DynamoDB stream on the hazards table, fed into an EventBridge pipe that delivers new rows to the orchestrator in batches, asynchronously, with a dead-letter queue for anything that fails. The orchestrator is a stream consumer, not an endpoint anyone calls. It wakes up when hazards appear, judges them, and writes their status back — VERIFIED or REJECTED — as an update to the same row.

Using the database's own change stream as the bus buys a lot for free: buffering under load, automatic batching, retries, and a DLQ where poison events land instead of blocking the line. The ingest side and the verify side can scale, fail, and be redeployed independently, because neither holds a reference to the other. The only contract between them is the shape of a row.

## The filter that stops the loop

Here is the subtle part, and it is the kind of thing that is invisible until it takes the system down. The orchestrator both *reads* hazard changes and *writes* hazard changes — it consumes new hazards and then updates their status. A change stream reports every change, including the orchestrator's own status writes. So without care, the orchestrator's write of `VERIFIED` produces a stream event that wakes the orchestrator, which processes it and writes again, forever.

The fix is a declarative filter on the pipe: the orchestrator's pipe is filtered to **INSERT events only.** A brand-new hazard is an INSERT and gets processed; the orchestrator's own status change is a MODIFY and is never delivered back to it. The loop is broken structurally, at the pipe, not by a guard clause the orchestrator has to remember to run on every event.

That same filtering is what lets a second consumer exist cleanly. Maintenance planning should react only when a hazard becomes real, so its pipe is filtered to **MODIFY events where the new status is VERIFIED.** The maintenance planner never sees a pending or rejected hazard; it is woken precisely by the transition it cares about. Two consumers, one stream, each handed exactly the slice of events that is its business — decided by declarative filters, not by every function re-checking what it should ignore.

## Least privilege falls out of the same shape

Because the pieces are decoupled and single-purpose, it is natural to scope each one tightly, and we did. Every Lambda's IAM role grants only the specific tables, buckets, and model resources it actually touches — the attestation function cannot read the ledger, the maintenance planner cannot write balances. And at the very edge, the IoT device policy scopes each Pi to its own client-id topic, so a compromised node can publish as itself and nothing else. Loose coupling between components and tight coupling between each component and its permissions are the same design instinct pointed at two different seams.

## Takeaway

Putting a filtered stream between ingestion and verification meant the front door never waits on the AI, the two halves scale and fail independently, and back-pressure is absorbed by the bus instead of the request path. The lesson that stuck was the filter: when a component both reads and writes the same stream, the boundary that decides which events it sees is not a nicety, it is what separates a working pipeline from one that loops until it falls over. Let the stream carry the events, and let declarative filters — not defensive code in every consumer — decide who is allowed to hear which ones.

The code is open at [github.com/VigiaLabs/vigia-amazon](https://github.com/VigiaLabs/vigia-amazon).

*Engineering RoadIntelligence IDE · Episode 4 of 5 — Previous: Episode 3. Next: Episode 5, An IDE that shows its work.*
