# Episode 3: Paying a reward is a database transaction

*Why crediting a reward is a single three-item DynamoDB transaction, why the ledger is hash-chained, and how double-payment became structurally impossible rather than merely unlikely.*

The moment you attach money to data, every soft spot in your write path becomes an attack. A retry that credits twice, two concurrent workers that both think a hazard is unrewarded, a ledger row someone can quietly edit after the fact — none of these matter in a system that only stores facts, and all of them are exploits in a system that pays out. VIGIA credits `$VIGIA` for verified hazards, so the reward write had to be built as if correctness under concurrency were a security property, because here it is. This post is about the transaction that makes paying twice impossible.

This is Episode 3 of 5 in the Engineering RoadIntelligence IDE series. The full system overview is in the master post.

## The race you have to design against

A verified hazard triggers a reward credit. The obvious implementation is check-then-act: look up whether this wallet was already rewarded for this location recently, and if not, add to its balance and write a ledger entry.

That design has a hole you can drive a truck through. The events that trigger rewards arrive off a stream, and streams retry and can deliver the same record more than once; verification can also run more than once for the same hazard. So two invocations can execute the "check" at the same time, both see "not yet rewarded," and both proceed to "add to balance." The wallet is paid twice for one pothole. No amount of careful ordering fixes this, because the gap between the check and the write is where the race lives.

## One transaction, three items, all-or-nothing

So the credit is not a check followed by writes. It is a single DynamoDB `TransactWrite` of three items that either all commit together or all fail together:

1. **A cooldown lock.** A `PUT` into a cooldown table keyed by `reward#<wallet>#<geohash>`, with a condition that the key does not already exist, and a 30-day time-to-live. This is the dedup: if this wallet already earned for this location in the window, the key exists, the condition fails, and the *entire transaction* is cancelled.
2. **The balance increment.** An `ADD` to the wallet's pending balance and lifetime total.
3. **The ledger entry.** A `PUT` of an immutable record of the credit.

Because all three are one transaction, there is no window between them. If two invocations race, exactly one wins the conditional `PUT` on the cooldown lock and the other's whole transaction is rejected — we catch the cancellation and simply skip. Double-payment is not caught by a check; it is made impossible by the database refusing to commit the second write. The balance can never move without a ledger entry, and a reward can never be credited twice for the same location in the cooldown window, because those outcomes are not reachable states.

## Why the ledger is hash-chained

The third item is worth its own paragraph. Each ledger entry stores a SHA-256 hash computed over its own contents and the previous entry's hash — the same structure a blockchain uses. That makes the ledger tamper-evident: you cannot alter or delete a past credit without recomputing every hash after it, and the break is detectable by anyone who walks the chain.

For a reward ledger this matters more than it first appears. The balance in the wallet table is a running total; the ledger is the *auditable history* that the total is supposed to reflect. Hash-chaining means the history cannot be quietly rewritten to justify a balance that was tampered with directly. The number and the story behind the number are cryptographically bound.

## Off-chain speed, on-chain settlement

Credits land off-chain first, in DynamoDB, because a contributor should see their balance move immediately and we should not pay a blockchain fee on every single pothole. Verified hazards are then submitted to a Solana program for on-chain settlement, and the wallet's accumulated balance can ultimately be paid out to real money through Stripe Connect — gated, like every wallet operation, by an ownership proof the holder signs. The design keeps the hot path fast and cheap while still anchoring the network's record where it cannot be unilaterally rewritten, and it is the same off-chain-credit, on-chain-settle split that lets the token economy insulate a payout from per-event chain costs.

## Takeaway

When the output is money, "we check for duplicates" is not good enough, because the check has a gap and the gap is the exploit. Collapsing the credit into one atomic three-item transaction — a conditional cooldown lock, the balance move, and a hash-chained ledger entry — turns double-payment from a race you hope you win into a state the database will not enter. Correctness stopped being something we asserted in code review and became something the transaction guarantees.

The code is open at [github.com/VigiaLabs/vigia-amazon](https://github.com/VigiaLabs/vigia-amazon).

*Engineering RoadIntelligence IDE · Episode 3 of 5 — Previous: Episode 2. Next: Episode 4, Verification is decoupled from ingestion by a stream.*

---

## 🎓 CS Fundamentals — study companion

*This is **the DBMS episode** — ACID, transactions, isolation, concurrency control, idempotency, and hash chains. Transactions and race conditions are among the most-asked backend interview topics; this post is a perfect worked example.*

### DBMS — transactions & concurrency

- **ACID.** **A**tomicity (all-or-nothing), **C**onsistency (invariants hold), **I**solation (concurrent txns don't interfere), **D**urability (committed = survives crash). The reward credit is one **atomic** 3-item transaction: the cooldown lock, the balance increment, and the ledger entry all commit together or none do — you can never have a balance move without a ledger record.
- **The race condition (why a transaction, not a check).** *Check-then-act* — "is this wallet already rewarded? no → add balance" — has a **time-of-check-to-time-of-use (TOCTOU)** gap. Two concurrent workers both read "not rewarded," both credit → double-pay. Streams retry and can deliver duplicates, so this *will* happen. The fix is to remove the gap by making it one atomic conditional transaction.
- **Optimistic concurrency control & conditional writes.** The cooldown `PUT` has a condition `attribute_not_exists(key)`. Exactly one concurrent writer wins; the other's whole transaction is cancelled (caught and skipped). This is **optimistic concurrency** — don't lock upfront, just fail the commit if someone beat you — and it's how you get correctness without a global lock. (Contrast: *pessimistic* locking.)
- **Idempotency.** Because retries are expected (at-least-once delivery), the operation must be **idempotent** — applying it twice = applying it once. The cooldown key is the **idempotency key**: the second attempt is a no-op. Every payment/webhook system needs this.
- **Isolation levels (context).** Interviewers love these: *read uncommitted → read committed → repeatable read → serializable*, trading concurrency for anomaly-freedom (dirty reads, non-repeatable reads, phantoms). A single atomic transaction with a uniqueness condition gives serializable-like safety for this operation.
- **TTL / soft state.** The cooldown key has a 30-day time-to-live — the DB auto-expires it. TTL is a clean way to bound the size of "recently done" state.

### DBMS — integrity & auditing

- **Hash-chained ledger (tamper-evidence).** Each ledger entry stores `SHA-256(entry ‖ previous_hash)` — a **hash chain** (the core of a blockchain / a Merkle-log). You can't alter a past entry without recomputing every hash after it, so tampering is detectable. It cryptographically binds the *history* to the running *balance*.
- **Off-chain vs on-chain (write-back caching analogy).** Credits land off-chain (DynamoDB) instantly for UX and cost, then settle on-chain (Solana). This is a **write-behind / two-tier** pattern: fast authoritative-enough store in front, durable/immutable store behind.

**Interview Q&A.**
1. *What does ACID stand for and why does each letter matter?* → (as above); tie atomicity to "balance move + ledger entry can't half-happen."
2. *You have a check-then-act race crediting a wallet twice. Fix it.* → Make it one atomic transaction with a uniqueness condition (conditional write); catch the cancellation. Discuss TOCTOU.
3. *Optimistic vs pessimistic concurrency control?* → Fail-on-conflict at commit (version/condition) vs lock-upfront; optimistic wins under low contention and avoids deadlocks.
4. *What is idempotency and how do you implement it?* → Same effect on repeat; use an idempotency key stored uniquely so retries no-op — essential with at-least-once delivery.
5. *Name the SQL isolation levels and an anomaly each prevents.* → RU/RC/RR/Serializable vs dirty/non-repeatable/phantom reads.
6. *How do you make an audit log tamper-evident?* → Hash-chain entries (each includes the prior hash) / Merkle tree; any edit breaks the chain.

### ⚖️ This vs That — the architecture decisions, and the roads not taken

| Decision | Alternatives | Why this choice |
|---|---|---|
| **One atomic 3-item transaction** | Check-then-act (read, then write balance + ledger) | Check-then-act has a TOCTOU gap that concurrent/duplicate events exploit → double-pay. A single conditional transaction makes the second write *unreachable*. |
| **Conditional write (optimistic)** | A distributed lock around the credit | A lock adds latency, a coordination service, and deadlock/expiry risk. A conditional write gives the same safety with none of that, under this low-contention pattern. |
| **Cooldown key as idempotency key + TTL** | Dedup by scanning recent ledger entries | Scanning is slow and racy; a unique key with TTL is O(1), self-expiring, and atomic within the transaction. |
| **Hash-chained ledger** | Plain append-only table | A plain table can be edited silently; hash-chaining makes any tampering detectable and binds history to balance. |
| **Off-chain credit, on-chain settle** | Pay a chain fee on every reward | Per-event on-chain writes are slow and costly; off-chain-first keeps the hot path fast, on-chain anchors the record. |

**The one to defend:** *atomic transaction vs "we check for duplicates."* The junior answer adds a check; the senior answer names **TOCTOU** and makes double-payment an **unreachable state** via one atomic conditional write with an idempotency key — correctness guaranteed by the database, not by hoping the check always runs first.
