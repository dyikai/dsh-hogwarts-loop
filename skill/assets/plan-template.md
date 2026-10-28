# <Milestone/Project> — Implementation Plan & Checkpoints

> Status: living document — checkpoints are ticked as work lands; each passing
> checkpoint is stamped with date + commit hash.
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

## 5. Deviation registry

Every departure from the spec, logged. Reconciled into the spec/contract at
closeout.

| # | Deviation | Reason | Scope | CP |
|---|-----------|--------|-------|----|
| D1 | <what> | <why> | <blast radius> | CP<N> |

---

## 6. Update discipline

1. Tick items as they land; stamp the CP row ✅ + date + commit hash on pass.
2. A gate failure or unresolved P1/P2 blocks the next dependent CP.
3. Implementation decisions that diverge from the spec go in §5, always.
4. Each passing CP is one commit (code + this doc's update) for traceability.

## 7. Version history

- v1.0 (<date>): initial plan.
