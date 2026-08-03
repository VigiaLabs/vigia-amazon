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
