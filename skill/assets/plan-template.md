# <Milestone/Project> — Implementation Plan & Checkpoints

> Status: working plan — checkpoints are ticked as work lands; each passing
> checkpoint is stamped with date + commit hash in its chosen storage.
> Storage/retention: <session memory | one task-scoped temporary root outside the
> workspace (default) | user-approved durable repo doc>. Temporary execution
> plans, progress lists and review reports are **not committed by default** and
> are not hidden behind `.gitignore`; only an approved maintained roadmap/design
> document is durable. This file is a product template, not a per-run commit.
> Upstream: <the design/spec/roadmap this executes>
> UI truth: <Figma link(s), per screen/flow — presence enables Argus's closeout
> UI walkthrough; write "none" to route UI verification to manual acceptance>
> Downstream: <closeout doc>, <contract/spec reconciliation>
> Working branch: <branch> (off <base> <hash>)
> Gate economy: <cheap | expensive> — full gate measured at <N min>; milestone
> gate (unaffordable suites, e.g. UI/e2e): <commands, or "none">, run at
> <closeout + riskiest CPs>
> Discipline: per-checkpoint "implement → review → fix" loop; a checkpoint
> advances only when Severus (the reviewer) APPROVES and the gate is green.
> Review findings, batch validation and the three-cycle convergence cap:
> `references/review-contract.md`. Feedback and synthetic seeds:
> `references/evaluation.md`.
> Cast: <parent session id>; Harry <childId>; Severus <childId>.
> Reuse these children across CPs and repair rounds; an inactive child is not a
> replacement trigger. Record other roles' childIds when first dispatched.

---

## 1. Checkpoint map

Group the spec's steps into checkpoints. Show dependencies.

```
CP0 ──┐
CP1 ──┼─→ CP3 ─→ CP4 ─→ ...
CP2 ──┘
```

| CP  | Name | Covers (spec steps) | Depends on | Status |
|-----|------|---------------------|------------|--------|
| CP0 | <name> | <steps> | — | ⬜ |
| CP1 | <name> | <steps> | — | ⬜ |
| ... | | | | |

Legend: ⬜ not started / 🔄 in progress / ✅ passed (date + `hash`) / ◐ partial

---

## 2. Checkpoint detail

> One subsection per checkpoint. Cite the spec; don't repeat it.

### CP<N> — <name>

- [ ] <deliverable / task item>
- [ ] <unit test item>
- [ ] <controlled-break migration item, if any>

**Reviewer memos (carried in from earlier CPs):**
- <constraint Severus flagged in an earlier CP that this one must honor>

**Gate:** fast: <touched targets + this CP's tests + static checks> · full:
<whole-workspace commands + assertions that must pass>
**Acceptance mapping:** <which top-level acceptance items this CP satisfies>
**Ablation policy:** `references/ablation.md` defaults, or <predeclared overrides + reasons>.
**Measurement baseline:** <checkpoint-start / last validated survivor stamp>.
**Risk plan:** <named boundary> → <evidence/oracle> → <owner> → <budget/stop>;
human approval: <named human approver, or "not required by policy — reason">;
rollback/owner: <rollback steps + owner>.
**Security triage:** <named sensitive surfaces, or "none named">; scoped
security review: <Alastor / not required — reason>.
**Review cycles:** <0>/3; cap decision: <none | explicit reassessment record:
approach/scope/reviewer churn, bounded human authorization or stop>.
**Finding ledger (blocking):** <ID | severity | evidence status | provenance |
validation owner/evidence | disposition | closure reason>.
**Complexity report:** <baseline → tree; production lines/files; named mechanisms;
high-cost flags; exclusions; triggered / not triggered>.
**Experiments (when triggered):** <artifact link: ID, one removal/substitution,
variant stamp/patch, command/raw result, behavior/cost change, keep/revert/reason>.
**Validated survivor / next repair baseline:** <stamp + final gate evidence>.

---

## 3. Acceptance mapping

| # | Requirement | CP | Verification | Status |
|---|-------------|----|--------------|--------|
| 1 | <req> | CP<N> | test / headless / UI walkthrough / **manual** | ⬜ |

> Mark anything the environment can't execute as **manual / user acceptance** —
> with the exact steps to run it — rather than claiming it passed.

---

## 4. Controlled-break / migration tracking (if applicable)

| # | Break | Affected sites | CP | Status |
|---|-------|----------------|----|--------|
| B1 | <api change> | <call sites> | CP<N> | ⬜ |

---

## 5. Review feedback

Lightweight outcomes only (`references/evaluation.md`); not a benchmark and not
a claim that accepted fixes are ground truth.

| CP | Cycles (cap 3) | Confirmed findings (P1/P2/P3) | Refuted | Needs-evidence / route | Escaped defects | Cost (if measured) |
|----|----------------|-------------------------------|---------|------------------------|-----------------|--------------------|
| CP<N> | <n> | <counts> | <counts> | <owner/route> | <what escaped> | <time/tokens or "unavailable"> |

Cap events: <none | CP-N reassessment record; preserved counters; authorized
budget/stop or stop-and-report>.

---

## 6. Deviation registry

Every departure from the spec, logged. Reconciled into the spec/contract at
closeout.

| # | Deviation | Reason | Scope | CP |
|---|-----------|--------|-------|----|
| D1 | <what> | <why> | <blast radius> | CP<N> |

---

## 7. Update discipline

1. Tick items as they land; stamp the CP row ✅ + date + commit hash on pass.
2. A gate failure, an unresolved confirmed P1/P2, or a blocking `needs-evidence`
   record blocks the next dependent CP. A confirmed P1 is never waived.
3. Implementation decisions that diverge from the spec go in §6, always.
4. A P2 waiver is written with its attribution, scope and reason in the finding
   ledger; it is not inferred from silence. P3s are carried, not auto-fixed.
5. Each completed review/response cycle increments the CP counter; at three
   without resolution, write the cap decision and stop the automatic next cycle.
   Preserve both the cycle and same-root escalation counters; no reset loophole.
6. The approval gate is `references/review-contract.md`: every candidate
   accounted for, gate green on the exact state, risk/human-approval fields
   satisfied, findings ledger current.
7. Before advancing or replying, Albus completes `references/loop.md` temporary-
   artifact cleanup and checks the workspace; preserve user files and staging.
8. Record the lightweight feedback row (§5) at pass or closeout; never claim a
   model score that was not actually run.
9. Each passing CP commits code/tests (and an approved durable doc update if one
   exists); the working plan is updated in place and is **not committed by
   default**. Do not use `.gitignore` to hide a temporary plan or report.

## 8. Version history

- v1.0 (<date>): initial plan.
