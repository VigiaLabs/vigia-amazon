# Episode 5: An IDE that shows its work

*Why the analytical layer is a workspace of specialist agents rather than a dashboard of numbers, and why every step of the agent's reasoning is streamed to the operator as a first-class artifact.*

The first four episodes were about getting truth into the system: verify the source, spend the model wisely, pay for real hazards atomically, and route it all through a stream. This one is about what the truth is *for*. A verified map of road hazards is only valuable if someone can turn it into decisions — which road to fix first, what it will cost, how to route around it, where the network is blind. That is the job of the RoadIntelligence IDE, and the decision worth writing about is that it does not just show you the answers. It shows you the reasoning.

This is Episode 5 of 5 in the Engineering RoadIntelligence IDE series. The full system overview is in the master post.

## Why an "IDE" and not a dashboard

A dashboard presents conclusions: here is the hazard map, here is the maintenance backlog, here is the spend. It is a read-only surface, and for a network making public-infrastructure decisions, a read-only surface is not enough — an operator needs to interrogate *why* a road was ranked urgent, not just *that* it was.

So the frontend is built as a workspace, an IDE, sitting on top of a set of specialist intelligence functions rather than a single query API. There is a Bedrock router that dispatches a question to the right specialist; a network-intelligence function that reasons about coverage and blind spots; a maintenance-logistics function that turns verified hazards into a prioritised queue; an urban-planner that runs a multi-step plan — land cost, zone regulations, path geometry — as a Step Functions state machine; and an economic-metrics function that quantifies impact. The map is the input to a room full of analysts, not the output of a report.

## The reasoning is the product, so it is streamed

The design choice that shaped the whole frontend is that an agent's reasoning is a first-class, visible artifact, not an implementation detail hidden behind its answer.

When the verification agent from Episode 2 evaluates a hazard, it works in the ReAct style — it calls a tool to query nearby hazards, observes the result, calls a tool to compute a score, and reasons toward a verdict. Every one of those steps is written to a traces table and **streamed to the IDE live**, so an operator watching a hazard get verified sees the agent think: the tools it invoked, what they returned, and how it reached VERIFIED. The same is true of the intelligence agents — a network analysis or a maintenance decision arrives with its trace, not just its conclusion.

We treated the trace the way an IDE treats a debugger. A developer does not trust a program because it printed an answer; they step through it. An operator should not trust "fix this road next" because a model said so; they should be able to watch the model get there. Making the trace a streamed, queryable object — addressable per hazard, subscribable in real time — is what turns the agent from an oracle into a tool you can audit.

## Why visible reasoning matters more here than usual

There is a reason this mattered enough to build the whole frontend around it. The output of this system is not a movie recommendation; it is a claim about public infrastructure that may direct real maintenance money and real routing decisions. An unexplained agent verdict in that setting is worse than useless — it is a liability, because no one can defend a decision they cannot reconstruct.

Visible reasoning also closes the loop with everything upstream. Episode 1 verified the event cryptographically, Episode 3 recorded the reward in a tamper-evident ledger, and here the *judgement* is made inspectable too. The through-line is that every consequential step in the system — the signature, the payment, the decision — leaves an auditable trail. The IDE is where that principle meets a human: it is the surface on which the network's reasoning becomes something an operator can follow, question, and stand behind.

## Takeaway

The analytical layer could have been a dashboard that hands you conclusions. Building it as an IDE — a workspace over specialist agents, with each agent's reasoning streamed live and stored per hazard — was a bet that in an infrastructure-intelligence product, the reasoning is as much the deliverable as the result. A verified hazard map tells you what is true; an agent whose every step you can watch tells you why it decided what to do about it, and that is the difference between a system an operator reads and one an operator can trust.

The code is open at [github.com/VigiaLabs/vigia-amazon](https://github.com/VigiaLabs/vigia-amazon).

*Engineering RoadIntelligence IDE · Episode 5 of 5 — Previous: Episode 4. Back to the series overview.*

---

## 🧰 The transparency stack, from zero — and what we chose it over

- **An "IDE" that shows its work over a black-box dashboard.** The frontend surfaces the full provenance chain of every hazard: which device attested it, how it was verified (ONNX fast path vs the 2% VLM), why a reward was credited, and where it sits in the maintenance queue. Transparency is treated as a product feature — the same instinct as VIGIASearch's cited answers — because a decision-support tool that can't show its evidence can't be trusted.
- It reads the **verified hazard map, the rewards ledger, and the maintenance queue** the backend exposes, and drives **Stripe** fiat-payout flows for redemption.

## 🚢 From demo to production

- Real **observability** behind the UI — **X-Ray** traces, CloudWatch dashboards, structured logs — so "show its work" is backed by real telemetry, not a mock.
- **Role-based access** and **audit logs** for the operators who act on recommendations.
- **Reconciliation views** that make the off-chain/on-chain/Stripe money trail legible end to end.

---

## 🎓 CS Fundamentals — study companion

*This finale is **System Design** (agent orchestration, workflow state machines, streaming) plus **Product/HCI design** (transparency & explainability) and an **observability** callback. "Design an agentic / explainable AI system" is an increasingly common interview prompt.*

### System Design — agent orchestration & workflows

- **Router / dispatcher pattern.** A Bedrock **router** sends each question to the right specialist function (network intelligence, maintenance logistics, urban planner, economic metrics). This is the **API gateway / dispatcher** pattern applied to agents — one entry point fanning out to specialists.
- **Workflow orchestration with a state machine.** The urban planner runs a multi-step plan (land cost → zone rules → path geometry) as a **Step Functions state machine**. A state machine makes a multi-step workflow **explicit, resumable, observable, and retryable per step** — vs burying the steps in imperative code where a failure is opaque. Know the term "orchestration (state machine) vs choreography (events)."
- **Streaming results (SSE).** Agent reasoning is streamed to the IDE live (Server-Sent Events / a stream), rather than making the user wait for the final answer. Streaming = incremental delivery over a long-lived connection; the same reason ChatGPT types token-by-token.

### Product / HCI design — explainability

- **Transparency as a first-class feature.** The IDE streams *every reasoning step* (ReAct: tool call → observation → thought → verdict), not just the conclusion. For a system directing public-infrastructure money, an unexplained verdict is a liability — an operator must be able to reconstruct and defend it. This is **explainable AI (XAI)** and good product design: show your work.
- **"IDE, not dashboard."** A dashboard shows conclusions (read-only); an IDE is a *workspace* you interrogate. The design choice reflects the user's real job — investigate and justify, not just glance.

### Observability (callback)
- **Traces as first-class objects.** Reasoning steps are written to a traces table, addressable per hazard and subscribable live. This is **distributed tracing / structured logging** applied to agent decisions — the same instinct as OpenTelemetry spans: make every consequential step inspectable. (The three pillars again: metrics, logs, **traces**.)

**Interview Q&A.**
1. *Orchestration vs choreography for a multi-step workflow?* → Central state machine (Step Functions) controls the steps (visible, resumable) vs services reacting to each other's events (decoupled, harder to trace). Trade control for coupling.
2. *Why stream an LLM/agent's output (SSE)?* → Perceived latency (first token fast), progressive disclosure, ability to cancel; needs a long-lived connection.
3. *What is explainable AI and why does it matter here?* → Surfacing the reasoning behind a decision; essential when decisions carry real-world (money/safety/legal) consequences and must be audited.
4. *How would you make an AI system's decisions auditable?* → Persist the reasoning trace per decision as a queryable/streamable object (structured traces), tie it to the input and the verdict.

### ⚖️ This vs That — the architecture decisions, and the roads not taken

| Decision | Alternatives | Why this choice |
|---|---|---|
| **IDE that streams reasoning** | A read-only dashboard of conclusions | Operators direct real maintenance money; they must interrogate *why*, not just see *what*. A workspace with visible reasoning is auditable; a dashboard isn't. |
| **Step Functions state machine (urban planner)** | Steps inline in one Lambda | Inline multi-step logic is opaque and non-resumable; a state machine makes each step observable, retryable, and restartable from failure. |
| **Reasoning traces as first-class, per-hazard objects** | Log to stdout / hide behind the answer | Hidden reasoning can't be audited or debugged; a queryable/streamable trace turns the agent from an oracle into a tool you can trust. |
| **Router → specialist functions** | One giant do-everything agent | A monolithic agent is hard to scale, secure, and reason about; specialists with a router are modular and independently improvable. |

**The one to defend:** *visible reasoning vs a black-box answer.* In an AI product whose decisions carry real consequences, **the reasoning is as much the deliverable as the result** — making the agent's trace a first-class, streamed, auditable artifact is what lets a human trust and defend the decision. Transparency isn't a nice-to-have; it's the feature that makes the system usable at all.
