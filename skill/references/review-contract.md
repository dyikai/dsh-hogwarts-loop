# Review contract — findings, evidence, and convergence

This is the canonical home for the vocabulary that turns a suspicion into a
closed finding, the evidence a blocking finding must carry, and the
checkpoint-wide stop rule. `reviewer.md` owns review technique and the P1/P2/P3
impact definitions; `loop.md` owns the handoff edges; `implementer.md` owns repair
execution; `planner.md` owns planning and adjudication. They reference this file
instead of restating these rules.

## Three independent axes

A finding records **severity**, **evidence status**, and **disposition**. They
answer different questions and must never be collapsed into one field or into a
single "fixed/pass" flag.

| Axis | Values | Question it answers |
| --- | --- | --- |
| Severity | `P1`, `P2`, `P3` | How bad is it if the claim is true? |
| Evidence status | `candidate`, `confirmed`, `refuted`, `needs-evidence` | What is actually established right now? |
| Disposition | `fix-required`, `waived-P2`, `carry-P3`, `closed-refuted`, `closed-fixed`, `routed-out-of-scope`, `blocked-needs-evidence` | What happens to it next? |

**Severity** is impact, independent of proof state:

- **P1 — blocking correctness.** A real defect with a concrete failure scenario
  (specific inputs/state → wrong output, crash, security exposure, data loss).
  Must be fixed to pass. **A confirmed P1 is never waived.**
- **P2 — blocking should-fix.** A spec violation, a missing required test, a
  contract mismatch, a tautological assertion, or missing required evidence.
  Fixed to pass unless explicitly waived in writing.
- **P3 — non-blocking.** Style, wording, future-proofing, an observation for a
  later checkpoint. Recorded and carried; it does not block, and it does not
  trigger an automatic cosmetic repair round.

**Evidence status** is what the record knows, not what the reporter believes:

- `candidate` — independently reported (the reporter is not the author under
  review) with a claimed causal chain, but not yet validated. A P1/P2 candidate
  is blocking until it is confirmed or refuted.
- `confirmed` — a **non-origin validator** independently re-derived the cause
  from the reviewed snapshot. A complete deterministic code/data-flow causal
  chain plus the guard check is valid confirmation; **do not require execution
  for every static finding**. Where only execution can settle it, confirmation
  requires a pre-fix failing repro through the real integration entrypoint (red
  evidence on the reviewed snapshot), not a post-fix run.
- `refuted` — an independent check shows the claimed failure cannot occur as
  described (an existing guard, a wrong entrypoint, an insensitive oracle, a
  counterexample). Close it with the refuting reason. Refutation is bounded to
  the scenario checked; it is not a claim that no related bug exists.
- `needs-evidence` — the claim cannot be settled with the evidence available.
  It must name an owner, the next concrete evidence step, and an explicit route:
  **blocking** (the checkpoint cannot pass) or **risk-accepted under the plan's
  named risk owner**. Edge E may authorize **evidence collection only** — never
  an unconfirmed repair. `needs-evidence` is never an approval and never a silent
  pass.

**Disposition** is the recorded outcome: `fix-required` for confirmed P1/P2;
`waived-P2` only with an attributable waiver; `carry-P3`; `closed-refuted` with
reason; `closed-fixed` only after independent re-review and post-fix evidence
(when the repro route was required, the unchanged test's red-before/green-after
evidence and both stamps); `routed-out-of-scope` with the owning
checkpoint/role; `blocked-needs-evidence` while required evidence is open. A
confirmed P1 cannot receive `waived-P2`, `carry-P3`, or any approving route.
Harry's fix report proposes a disposition; it cannot self-close a finding.

### Required finding record

Every P1/P2 candidate, every security candidate, and every finding carried across
rounds carries:

- **Stable ID** — assigned once when first reported, never renumbered or reused.
  Later rounds reference the same ID; duplicate postings of the same defect are
  not new findings.
- **Source snapshot** — the exact reviewed tree state (commit/stamp) the claim
  was formed against.
- **Provenance** — `pre-existing`, `cp-introduced`, or `repair-introduced`.
- **Trigger / input** — the specific input, state, or configuration that reaches
  the defect.
- **Location** — `file:line` (or the exact surface and frame for a UI finding).
- **Causal chain** — the step-by-step path from trigger to wrong consequence.
- **Existing guard / counterexample checked** — the guard that might prevent it,
  or the counterexample that refutes it. "No guard found" is a claim to check,
  not a default.
- **Validation owner and evidence** — who independently confirmed it (static
  re-derivation or pre-fix repro) and, separately, who re-reviewed the fix and
  inspected the post-fix evidence that allows closure.
- **Closure reason** — why it is closed (fixed/verified, refuted, waived with
  attribution, carried, or routed).

P3s may use a shorter record but still need an ID and disposition.

## Validation before relay (between D and E)

The reviewer reports; the orchestrator does not relay a repair order on the
reporter's authority alone. After the review report (**D**) and before the
findings relay (**E**), Albus runs **one batch validation** of every blocking
(P1/P2) candidate and every security candidate. Do not assign one agent per
finding: the batch is a single bounded check, not a second full review.

- The validator must not be the candidate's origin. Albus is the default;
  when Albus originated the claim, or a specialist did, another non-origin
  reviewer validates it.
- The validator first tries to settle the candidate from the record: a complete
  deterministic code/data-flow causal chain, independently re-derived with the
  guard/counterexample checked, **confirms** it without execution. Static proof
  is valid for code findings, not only for documentary ones.
- If the batch marks the candidate `needs-evidence`, edge E may authorize
  **evidence collection only**, never repair. If execution is truly required,
  Harry runs the unchanged pre-fix test on the reviewed snapshot and returns the
  raw red output and pre-fix stamp; the non-origin validator inspects the oracle
  and real integration entrypoint and then confirms or refutes. This bounded
  handoff is not a second full review and is not a repair, but its **substantive
  evidence report consumes one review/response cycle**, exactly like a fix
  (`Counting`). Batch evidence requests for all candidates into that one report;
  informational progress notes or tool logs do not each count.
- Security candidates are always inside the batch, and a named sensitive surface
  requires the scoped security review described in `reviewer.md` — the batch
  does not let the loop skip that lens by treating security as one more reading.
- Each candidate gets `confirmed`, `refuted`, or `needs-evidence`, with the
  evidence name and reason. The batch result is recorded in the plan's review
  ledger.
- `needs-evidence` records an owner, the next evidence step, and the explicit
  blocking/risk route. If required verification remains unresolved, the
  checkpoint cannot silently approve just because no P1/P2 was confirmed — a
  zero-confirmed-findings report with open required evidence is still blocked.
- Refuted candidates are closed and not sent for repair. P3s are recorded, not
  turned into automatic cleanup work.

Only after confirmation does edge E relay a repair order for the blocking
findings; open evidence routes remain on their explicit route. **Closure is a
separate stage**: after Harry's fix report (F), an independent re-review inspects
the fixed state and post-fix evidence. F proposes a disposition; it does not
self-close.

## Prove or refute — the staged evidence standard

A suspicion becomes a finding by construction, not by insistence. Evidence has
two stages: **confirmation** (before repair) and **closure** (after repair).

1. The reviewer reports a `candidate` with the causal chain, trigger/input,
   guard/counterexample checked, and reviewed snapshot. The reviewer does not
   build or run anything.
2. A non-origin validator tries to confirm it from the record. A complete
   deterministic code/data-flow chain, re-derived by that validator with the
   guard checked, is sufficient. **Static code proof is valid; do not demand an
   executable test for every deterministic finding.**
3. If only execution can settle it, the reviewer returns a **prove-or-refute
   request** naming:
   - the finding ID and the reviewed snapshot;
   - the exact input/state, and the real integration entrypoint (not a private
     test seam or a direct call that bypasses the wiring);
   - the oracle: the specific observable that fails for this reason;
   - the expected failure and the test to write;
   - the bounded scenario being settled.
   Edge E then authorizes **evidence collection only**, not repair.
4. Harry runs the unchanged test on the reviewed snapshot and captures **red
   before repair**, with raw output and the pre-fix source stamp. The evidence
   returns to the non-origin validator, which checks that it fails for the
   claimed reason — not an unrelated setup error, and not via a private seam
   while the shipping path remains untested. If the test cannot fail, say why
   (insensitive oracle, wrong entrypoint, already-guarded path); the finding is
   refuted, narrowed, or remains `needs-evidence`. Proposing a replacement
   scenario is a **new substantive evidence response** and counts as the next
   cycle; it is not a free retry, and requests for multiple candidates are
   batched into one response. A failed repro refutes only that scenario, not
   every possible bug.
5. Only after confirmation does E authorize repair. Harry fixes without changing
   the repro test and returns **green after repair** with raw output and the
   fixed stamp. On a static route, the post-fix evidence is the fixed-state
   source and gate evidence; no test is required solely because the finding was
   in code. Harry's F report is a proposal/evidence record, not a self-closing
   act.
6. Closure requires independent re-review of the fix and its post-fix evidence.
   When the repro route was required, the same test must be red-before and
   green-after with both stamps. When the static route was used, re-derive the
   fixed tree and audit the gate; a test is not mandatory.
7. **Never reset, checkout, stash, or otherwise restore the tree to manufacture a
   pre-fix state.** Red is observed before the repair on the actual reviewed
   state. If that evidence was missed, report the gap honestly; do not rewrite
   history or use unsafe restoration to fake it.
8. An old green suite, a model vote, or "all tests pass" is not proof of an
   unexercised path. Conversely, a new failing test is not proof of a defect
   until its oracle and entrypoint are shown to be real.

## Re-review: stable IDs and novelty

The novelty-based incremental review in `reviewer.md` still applies: re-review
the repair increment and affected adjacent logic, not the whole checkpoint by
default. On top of that:

- Reuse the stable ID for the same defect. Do not post a duplicate finding when
  the same premise persists; update its evidence status or disposition.
- Reopen a closed finding only when a premise changed or new evidence appears
  (including a repair-created regression). Record what changed.
- When a confirmed P1/P2 establishes a **class of bug**, check the same class
  within the checkpoint's scope. Instances outside the scope are recorded and
  explicitly routed to the owning checkpoint/role — not silently expanded into
  this checkpoint and not silently dropped.
- Every unresolved candidate is accounted for before approval: confirmed with a
  disposition, refuted with a reason, or needs-evidence with an explicit route.
  "Nothing else found" is not an accounting of the candidates already open.

## Checkpoint convergence cap

This cap is separate from the same-root Harry/Voldemort attempt limits in
`SKILL.md`. It bounds **automatic review churn** for one checkpoint; it is not a
permission to approve, and it does not replace the escalation rules.

### Counting

One **review/response cycle** completes when a review report (D) is delivered and
a **substantive Harry response** to it is returned — the fix/contest/no-change
report (F), or the bounded pre-repair evidence report authorized through E. Each
substantive response counts once, regardless of label:

| Harry's substantive response | Cycles |
| --- | --- |
| fix | 1 |
| contest / documented no-change | 1 |
| pre-fix evidence-only report | 1 |
| replacement-scenario / `needs-evidence` update | 1 |
| informational progress note or tool log with no new evidence or decision | 0 |

A pre-fix evidence response and the later repair response are therefore **two
cycles**. Batch evidence requests for multiple candidates into one response.
Relabeling an evidence-only report as "not a cycle" or splitting one substantive
report into several responses does not evade the count. An APPROVE ends the
checkpoint and does not count as unresolved; a cycle that produces only P3s still
counts if the checkpoint does not approve.

### The stop rule

After **three completed review/response cycles** with blocking findings still
unresolved, **stop the automatic next iteration**. This includes three
unresolved evidence-only responses with no code change; there is no separate
evidence-only allowance. For example: D1 → evidence-only report → still
needs-evidence; D2 → replacement-scenario report → still needs-evidence; D3 →
third evidence-only report → the third cycle stops automatic work. Do not
dispatch a fourth review/response cycle by default, and do not treat another
review round as progress. Albus records an explicit reassessment decision in the
plan:

- what is actually unresolved (by stable ID and evidence status);
- whether the approach, checkpoint scope, or reviewer/lens is wrong;
- whether reviewer churn (the same premises re-argued) is consuming the budget;
- the chosen next move: restructure/narrow the checkpoint, change the lens,
  return to planning, stop and report, or authorize a **bounded continuation**.

A bounded continuation requires explicit authorization from the user or the
human owner named in the plan, a named approach change (not "try again"), a
remaining cycle budget, and a stop condition. **Counters are preserved** — the
cap is not reset by a new round, a re-scoped checkpoint name, a reviewer swap, a
new finding, or an escalation. Splitting or renaming the same unresolved work to
get a fresh three-cycle allowance is the auto-reset loophole and is forbidden.
Only a plan decision that genuinely closes this checkpoint and opens a new,
independently gated checkpoint gives a new checkpoint counter; the unresolved
findings and memos must carry into it.

The cap stops automatic work, not scrutiny or safety gates. Before any decision
or stop, all currently open and newly discovered findings are triaged and
routed. A newly discovered serious issue is never dropped to hit the cap.

### Precedence with same-root escalation

The same-root limits are per problem, attempt-based, and defined in `SKILL.md`
(three Harry attempts, at most two Voldemort attempts). The convergence cap is
per checkpoint, cycle-based. They can trigger independently:

- A same-root threshold may escalate **before** the cap: if the third Harry
  attempt on that root fails, the normal once-only Voldemort escalation applies
  even if fewer than three review/response cycles have completed.
- If the cap triggers while an escalation is eligible, do not start a fourth
  automatic cycle; the explicit reassessment may use the once-only Voldemort
  escalation as its bounded move, with both counters preserved. The escalation
  does not authorize additional review cycles beyond its own attempts.
- If both limits would authorize an action, the **stricter limit wins**: never a
  fourth Harry, never a third Voldemort, never an automatic review/response
  cycle past the cap. Only the explicit human-authorized continuation can extend
  the checkpoint, and it cannot extend the escalation attempt limits.
- **Never escalate merely because review churn hit the cap.** Escalation needs
  same-root failure evidence; churn without a failed root is an approach/scope
  problem for the reassessment, not a Voldemort dispatch.
- The cap decision does not reset same-root attempt counters, and escalation
  does not reset the checkpoint cycle counter. Newly discovered serious issues
  still get triaged and routed at any point.

## Approval gate

A checkpoint can pass only when:

- all confirmed P1 and P2 findings are closed after independent re-review with
  post-fix evidence (`closed-fixed`), or carry an explicit, attributed P2 waiver;
- no blocking `needs-evidence` record remains open (required verification was
  either completed or explicitly risk-accepted by the plan's named risk owner —
  and a required human approval cannot be replaced by an agent consensus);
- every candidate has an accounting and every security candidate has its scoped
  lens result;
- the full gate is green on the exact state being committed;
- the convergence cap is not being bypassed by an unrecorded new cycle.

A zero-confirmed-findings report that leaves required verification unresolved is
**not** an approval. A confirmed P1 is **never** waived. P2 waivers must be
explicit, attributed, scoped, and visible in the plan; they are not inferred from
silence. P3s are carried, not auto-fixed.

## Feedback

The lightweight outcome metrics and the synthetic seed corpus are defined in
`evaluation.md`. They inform future iterations; they are not evidence that this
checkpoint is correct and do not convert accepted fixes into ground truth.
