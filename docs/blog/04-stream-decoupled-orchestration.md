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

---

## 🎓 CS Fundamentals — study companion

*This is the **distributed-systems / System Design** episode — event-driven architecture, change-data-capture, message queues, dead-letter queues, and least-privilege security. These are the backbone of modern backend interviews.*

### System Design — event-driven architecture

- **Decoupling via a message bus.** The ingest function and the verifier never call each other; a change to the hazard row *is* the message. This is **event-driven architecture (EDA)**: producers emit events, consumers react, neither holds a reference to the other. Benefits: independent scaling, failure isolation, elasticity; cost: eventual consistency and harder end-to-end tracing.
- **Change Data Capture (CDC).** A **DynamoDB Stream** emits every row change (INSERT/MODIFY/REMOVE) as an event — this is CDC: turning a database's write log into a stream other systems consume. (Same idea as Postgres logical replication, Debezium, MySQL binlog.) The database becomes the source of events *for free*.
- **Async fan-out & buffering.** The stream → EventBridge pipe delivers in batches, absorbing bursts (**backpressure**) so a spike at the front door doesn't overwhelm the verifier. The door just persists a `PENDING` fact and returns fast; the slow work happens off the request path.
- **Dead-letter queues (DLQ).** Events that repeatedly fail land in a DLQ instead of blocking the pipeline or being lost — poison-message isolation. A must-know reliability pattern.
- **The idempotency requirement returns.** Stream/queue delivery is **at-least-once**, so consumers can see duplicates → they must be idempotent (which the reward transaction already is, Ep 3). *At-least-once + idempotent consumer = effectively-once*, the standard way to get exactly-once semantics you can't truly have.

### System Design — the filter that prevents an infinite loop

- **The self-triggering loop.** The orchestrator *reads* hazard changes and *writes* hazard status. Its own write is another change event → it re-triggers itself → infinite loop. This is a classic **feedback loop / event storm** in EDA.
- **Declarative event filtering.** The fix: the orchestrator's pipe is filtered to **INSERT only** (new hazards), so its own MODIFY writes are never delivered back. A second consumer (maintenance) filters to **MODIFY where status=VERIFIED**. Each consumer subscribes to exactly the events it wants — routing decided declaratively at the bus, not by defensive `if` checks in every consumer. **Content-based routing / message filtering** (an Enterprise Integration Pattern).

### Security — least privilege

- **Principle of least privilege (PoLP).** Each Lambda's IAM role grants only the specific tables/buckets/models it touches; a compromised function can't reach the rest. At the edge, each device's policy scopes it to its own topic. Minimising the **blast radius** of any single compromise is a core security-design principle.

**Interview Q&A.**
1. *What is event-driven architecture and its tradeoffs?* → Producers/consumers coupled only by events; +scaling/isolation, −eventual consistency, harder tracing/ordering.
2. *What is Change Data Capture?* → Streaming a DB's change log as events (DynamoDB Streams, binlog, WAL); decouples readers from the write path.
3. *How do you get exactly-once processing?* → You can't truly; use at-least-once delivery + idempotent consumers (+ dedup keys) = effectively-once.
4. *What is a dead-letter queue for?* → Isolating repeatedly-failing (poison) messages so they don't block or vanish.
5. *A consumer that reads and writes the same stream loops forever — fix it?* → Filter the subscription (e.g., INSERT-only) so its own writes aren't redelivered; content-based routing at the bus.
6. *Explain least privilege and blast radius.* → Grant the minimum permissions; a breach of one component can't touch others.

### ⚖️ This vs That — the architecture decisions, and the roads not taken

| Decision | Alternatives | Why this choice |
|---|---|---|
| **Decouple via DB stream (CDC)** | Ingest calls the verifier directly (sync or async) | A direct call ties the door's latency/availability to the slow verifier and can't buffer bursts. A stream gives buffering, retries, a DLQ, and independent scaling for free. |
| **Declarative pipe filters (INSERT-only, VERIFIED-only)** | A guard clause inside each consumer (`if event is my own, skip`) | Guard clauses are easy to forget and run per event; a filter at the bus is authoritative and stops the loop structurally. Each consumer gets exactly its slice. |
| **Fast persist-and-return at the door** | Verify synchronously in the request | Synchronous verification (S3 + VLM + agent) would make ingestion latency hostage to the slowest judgement and back up under load. |
| **Per-function least-privilege IAM** | One broad shared role | A shared role means one compromised function exposes everything; scoped roles shrink the blast radius. |

**The one to defend:** *stream decoupling + declarative filtering.* The subtle senior point: when a component both reads and writes an event stream, **the subscription filter is the boundary that separates a pipeline from an infinite loop** — you break the cycle declaratively at the bus, not with defensive code in every consumer. And decoupling via CDC means the front door never waits on the AI.
