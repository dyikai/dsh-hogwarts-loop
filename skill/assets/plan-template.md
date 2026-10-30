# <Project> — working checkpoint plan

> Storage: session memory or a task-scoped temporary root outside the workspace.
> Keep the active plan and carry-forward state through later CPs; before deleting
> its root at run end, transfer needed handoff/resume state to a surviving location.
> Do not commit a filled execution plan/progress/review report by default or hide
> it behind `.gitignore`. A user-approved maintained roadmap/design doc is the
> exception; this shipped template is a product asset.
>
> Source of truth: <spec/design/roadmap>
> Branch/base: <branch + hash>
> UI truth: <Figma links, or none → manual acceptance>
> Gate economy: <cheap | expensive>; full gate cost: <measured time>
> Milestone gates: <unaffordable suites + scheduled CPs/closeout, or none>
> Cast: <parent; persistent Harry/Severus childIds; specialists only when used>
>
> Rules: `references/review-contract.md` (validation, closure and budgets),
> `references/ablation.md` (complexity gate), `references/loop.md` (cleanup).
> Omit inapplicable sections; this is not a mandatory signoff checklist.

## Checkpoint map

| CP | Deliverable / spec sections | Dependencies | Status / passing commit |
| --- | --- | --- | --- |
| CP0 | <foundation> | — | <pending / in progress / passed> |
| CP1 | <capability> | CP0 | <status> |

## CP<N> — <name>

- [ ] <deliverable>
- [ ] <behavior/test>
- [ ] <controlled migration, if any>

**Carried memos:** <constraints that affect this CP>
**Gate:** fast <commands/assertions>; full <commands/assertions>
**Acceptance:** <top-level requirements this CP satisfies>
**Ablation:** <default policy or predeclared override; baseline; measurements;
trigger decision; experiments when triggered; validated survivor + gate stamp>
**Review:** <completed repair/re-review rounds; evidence batches when used>
**Open findings:** <ID, severity, location, failure/guard, evidence or next step>
**Decisions:** <validation/closure reasons; attributed P2 waiver or budget extension
only when needed; preserve counters and same-root attempt counts>
**Material risk, if any:** <changed property; evidence; missing specialist coverage>
**Required approvals, if any:** <authorization, owner and stop condition>
**Release/destructive migration only:** <operator; rollback/restore steps and owner,
prerequisites or accepted irreversibility + recovery; post-operation checks/window
and verifier; failure thresholds and authorized stop/rollback/escalation action>

Collapse resolved findings into memos that constrain future work; don't keep the
full narrative in every subsequent brief. At pass or stop, add one feedback note:
confirmed/refuted/needs-evidence counts, escaped defects, budgets used and measured
cost (or unavailable). Accepted fixes are not automatically ground truth.

## Acceptance mapping

| Requirement | CP | Verification | Result |
| --- | --- | --- | --- |
| <requirement> | CP<N> | <test / walkthrough / manual> | <evidence or pending> |

Name exact manual steps for checks the environment cannot execute. Never call a
skipped check passed.

## Deviations / migration (when applicable)

| ID | Change or break | Reason / affected sites | Owning CP / resolution |
| --- | --- | --- | --- |
| D1 | <change> | <why / blast radius> | <CP> |

## Closeout

- Reconcile deviations into approved maintained specs where needed.
- Carry residual/manual-only risk and downstream memos.
- For an in-scope release/migration, record post-operation results and any recovery;
  if handed off, name the receiver and pending checks, never mark execution verified.
- Verify final gate evidence, approval and cleanup; preserve required handoff/resume
  state outside any temporary root before deleting it.
- Commit product code/tests and approved durable docs; update this plan in its
  chosen storage, not as an extra default commit artifact.
