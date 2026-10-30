# The Loop — process and data handoff

How the orchestrator (**Albus** — the strategist who plans and dispatches, i.e.
you/the main agent), the implementer (**Harry** — `implementer.md`), and the
reviewer (**Severus** and the specialist bench — `reviewer.md`) fit together, and
— the important part — exactly what data crosses each edge between them. If a
payload isn't specified here, it tends to get dropped; the handoffs are where a
loosely-run loop leaks.

## The state machine

```
                          ┌──────────── PLAN — Albus (once) ────────────┐
                          │ read source of truth → decompose into       │
                          │ checkpoints → write working plan →        │
                          │ define each checkpoint's gate                │
                          └──────────────────────┬──────────────────────┘
                                                 │
        ┌────────────────── PER CHECKPOINT (in dependency order) ───────────────────┐
        │                                                                            │
        │   ALBUS (orchestrator) ─[A: implementer brief]─▶ HARRY (implementer)      │
        │        ▲                                      │                            │
        │        │                              builds + ablates + gates                  │
        │        └──────[B: delivery report]───────────┘                            │
        │        │                                                                   │
        │   orchestrator ──[C: review brief]──▶ SEVERUS (reviewer)                   │
        │        ▲                                 │                                 │
        │        │                 reads + audits gate evidence (no builds)          │
        │        │                                 │                                 │
        │        │      ┌──[D': convening request]─┘  (only when he cannot settle    │
        │        │      ▼                               something in his own lens)   │
        │        │   orchestrator trims / adds ──▶ PANEL ──┐                         │
        │        │                                          │                        │
        │        └────────[D: review report]────────────────┘                        │
        │        │                                                                   │
        │   verdict?                                                                 │
        │     ├── REQUEST-CHANGES ──[E: findings relay]──▶ HARRY                     │
        │     │        ▲                                       │                     │
        │     │        └──────[F: fix report]─────────────────┘                     │
        │     │        └──────▶ back to [C] (Severus re-reviews)                       │
        │     │                                                                      │
        │     └── APPROVE ──▶ orchestrator commits code/tests (durable docs    │
        │                     only if approved) + folds P3s/memos forward       │
        │                     + advances to next CP                             │
        └────────────────────────────────────────────────────────────────────────────┘
                                                 │
                          ┌──────────────────────┴──────────────────────┐
                          │ CLOSEOUT: Argus UI walkthrough (if Figma      │
                          │ links in plan) · acceptance mapping ·         │
                          │ reconcile deviations into spec · closeout     │
                          │ doc · name residual/manual-only risk          │
                          └──────────────────────────────────────────────┘
```

A checkpoint exits (edge → APPROVE) only when Severus approves, the approval gate
in `review-contract.md` is satisfied, **and** the full gate is green on the exact
state being committed (see Gate economy below).
Before review, every delivery must also satisfy the conditional complexity and
ablation gate in `ablation.md`; missing required experiments are not review-ready.

`review-contract.md` owns validation, closure and budgets. Albus validates candidates
between D and E; Harry executes probes and repairs. Count a repair round only
when the author response receives its re-review verdict. Evidence-only batches
use a separate finite allowance; neither budget resets same-root attempt counts.

## The handoff payloads

Each lettered edge above carries a specific payload. Treat these as the contract
between roles.

### A — orchestrator → Harry: *implementer brief*
- Checkpoint scope (this checkpoint's deliverables only).
- Exact spec section references (the standard to build to).
- Gate commands (the done-condition), measurement baseline and `ablation.md` policy.
- Hard constraints (frozen surfaces, layering/dependency rules, etc.).
- **Carried memos**: constraints Severus flagged in earlier checkpoints that this
  one must honor.
Full template in `implementer.md`.

### B — Harry → orchestrator: *delivery report*
- What was delivered, against the brief's checklist.
- Full gate results (real command output, including any ugly parts), stamped
  with the tree state they ran on.
- Every deviation: ID + what changed + why.
- Files changed / added.
- Complexity measurements and trigger ruling; when triggered, experiment artifacts,
  keep/revert decisions and combined-survivor evidence (`ablation.md`).
- Self-flagged risk spots ("review this hardest").
- Temporary-artifact inventory: exact paths owned by this run, for Albus's cleanup.
- Confirmation: not committed, stayed in scope.

### C — orchestrator → Severus: *review brief*
- Confirmation the gate is green on the state under review — a red gate never
  crosses this edge (Albus bounces it at edge B).
- How to see the diff + the baseline commit (only the unpassed changes).
- Spec sections to check against.
- Harry's declared deviation list (for rulings) and complexity/ablation evidence.
- The current repair-round/evidence counts, and any
  reassessment decision in force.
- Material security changes or missing coverage, plus any applicable risk/approval
  and rollback fields (`review-contract.md`, `reviewer.md`).
- Focus areas, highest-risk-first.
Full template in `reviewer.md`.

### D' — Severus → orchestrator: *convening request* (optional, instead of D)
Returned when the triage pass hits something Severus cannot settle in his own
lens. Not a substitute for reviewing — everything he *could* settle is already
settled and reported alongside.
- Which specialists, named.
- **Per specialist: the exact point he cannot settle**, not a risk adjective.
- What he already ruled on, so the panel does not redo it.
The orchestrator approves or trims for budget, including plan-derived constraints.
Albus first tries to settle unsupported claims in validation; add a claim refuter
only for a consequential question that remains unresolved. Any added lens returns
its scoped result for D, not a second full review (`reviewer.md`).

### D — Severus → orchestrator: *review report*
- Verdict, reviewed snapshot, and concrete findings/closure evidence by stable ID.
- Deviation rulings, audited gate evidence, and unresolved evidence/coverage gaps.
- On APPROVE: useful downstream memos.

### D→E — orchestrator: *validation*
Batch-check blocking and security candidates using `review-contract.md`. Record
who checked each disputed claim and why it was confirmed, refuted or left open.
Static proof can suffice. An execution-only question authorizes a bounded evidence
batch, not an unconfirmed repair. Preserve the evidence count across repair rounds.

### E — orchestrator → Harry: *bounded request*
- Confirmed defects to fix, by ID; or explicitly evidence-only questions.
- Required proof, scope, and any rejected deviation or adjudication.
- Remaining repair/evidence budgets and any human-authorized extension.

### F — Harry → orchestrator: *response*
- For a repair: changes by ID, relevant regression/gate evidence and final stamp;
  include unchanged-test red/green evidence when a repro was required.
- For an evidence-only request: results on the reviewed snapshot, including failures
  to settle the question. Albus validates these before authorizing repair.
- Complexity/ablation delta, unresolved items and task-owned temporary paths.

A fix report proposes closure; it never self-closes. Send repairs back through C
for independent re-review and count the completed round then. Evidence-only results
consume their own allowance, not a repair round. Always obtain the closure verdict
for an already delivered repair; apply the stop rule before further author work.

## Transport — how the edges physically run

The payloads above are messages between real agents. In this Harness,
`hogwarts_dispatch` is the transport for both creation and continuation:

- **Create once per role per parent session.** Harry starts at the first edge A,
  Severus at the first edge C. Include the role file (`implementer.md` /
  `reviewer.md`) and the first brief. Record each returned childId. The tool
  returns without waiting for the work; wait for the delivery report before
  advancing along a dependent edge.
- **Continue at every later edge.** Call `hogwarts_dispatch` with the same role
  for the next CP, findings relay, or re-review. Its childId remains the same;
  `description` supplies the first display label, not a new identity; later
  briefs do not relabel the child. Finishing a CP or
  becoming inactive does not end the child's conversation. Never bypass reuse
  by invoking a different spawning tool.
- **Recover, do not replace.** Resuming the same parent session recovers the
  durable binding and continues that child. Context compaction, plugin reload,
  and returning from Voldemort are not replacement triggers. If the child
  cannot be resumed, or older history contains ambiguous role identities,
  report the error and stop that edge rather than quietly starting another
  Harry. A genuinely new parent session gets a new cast; bootstrap it with the
  role file, checkpoint map, deviation registry, and carry-forward memos (plus
  prior findings and rulings for Severus).
- **One implementer means serial CPs.** Do not submit concurrent checkpoints to
  Harry as if they were separate workers. Independent specialists may review a
  frozen diff concurrently. Parallel implementation in separate worktrees and
  separate parent sessions requires an explicit plan; it is not an excuse to
  create a second Harry in this session. After each approved branch lands,
  Harry runs the full gate on the merged state before it advances.

## Gate economy — pay for verification once per state

This loop's discipline was born on a project whose full gate ran in a couple of
minutes. On stacks where one build+test cycle costs tens of minutes (Xcode,
large monorepos, e2e suites), mechanically rerunning everything at every edge
turns the loop into a build queue. The fix is not to trust more — it is to
notice what a gate run actually proves:

**A gate result belongs to a tree state.** It stays valid until the tree
changes; rerunning it on an unchanged tree verifies the *reporter*, not the
code. So the invariant worth paying for is: **no state reaches a commit without
the full gate having passed on that exact state** — not "everyone reruns
everything."

**Ownership: all building and gate execution belongs to Harry, and it happens
in development.** He builds, so he builds-and-tests; every test the checkpoint
needs is written, built and run before the delivery report, and a checkpoint
whose gate is red is simply not ready — it never enters review. Albus bounces
a red delivery at edge B (the one exception: a red Harry declares as
pre-existing or environmental, which Albus rules on). Severus verifies gates by
**auditing the evidence** — the exact command, the raw output (not a summary),
a tree-state stamp that matches the diff under review, and scope honesty
(skipped tests are not passed tests) — never by rerunning the suite and never
by compiling anything: review time is read time, and reviewers get no build
permissions, no worktrees to compile in, no simulators. A suspicion that only
execution can settle goes back to Harry as a prove-or-refute request; he has
the build, he writes the pre-fix repro, returns the unchanged red evidence for
non-origin confirmation, and fixes only after the confirmed finding is relayed.
The single exception is Argus, who launches the artifact Harry's final full gate
already produced — he never rebuilds either. The batch validation between D and E is also read-only: the
validator inspects chains, oracles, entrypoints and stamps, and Harry still
executes anything that must run.

Two tiers govern *when Harry runs what*, defined per checkpoint at Plan time:

- **Fast gate** — build the touched targets + run the tests covering this
  checkpoint's scope + static checks. The per-iteration signal; aim for minutes.
- **Full gate** — the whole-workspace net. The commit-blocking signal.

Pick the economy from the full gate's *measured* cost:

- **Cheap mode** (full gate in a few minutes — e.g. an incremental Rust
  workspace): Harry runs the full gate at every report — delivery and every fix
  round. Simplicity wins; ignore the accounting below.
- **Expensive mode** (full gate in tens of minutes — e.g. an iOS app):
  - **Iterating:** fast gate only. **One** full gate before the delivery
    report, stamped with the tree state it ran on (e.g.
    `git diff HEAD | shasum` + the `git status --porcelain` listing).
  - **Fix rounds (edges E/F):** fast gate per fix.
  - **Before commit:** any fix round means the tree changed since the delivery
    full gate — so exactly **one** final full gate on the final state, run by
    Harry, its stamp audited by Albus before committing. Never a second run on
    the same state; it buys nothing.
  - **Parallel landings:** one full gate after each landing, on the merged
    state (as in Transport).
- **Unaffordable suites** (simulator/device UI tests, long e2e runs): pull them
  out of the per-checkpoint full gate into a **milestone gate** — run at
  closeout and after the riskiest checkpoints, named in the plan as such. That
  is honesty routing, not corner-cutting: the plan states exactly which states
  the heavy net did and didn't cover.

What survives in every mode: a checkpoint enters review only on green, findings
must still be *proved* (a constructed causal chain, or a failing test Harry
writes on the reviewer's prove-or-refute request — never a vibe, and never a
build started by the reviewer), and the committed state has a full-gate pass
attached by construction. The audit trail
(raw output + tree-state stamp) is what keeps a misread green from slipping
through.

## Review economy — buy the second pair of eyes where it can see something

Gate economy above governs what *verification* costs. Review has its own cost curve,
and it is the one that actually blows up: a fan-out panel plus a separate
refutation agent per finding is one to three orders of magnitude more expensive
than a single reviewer. Left unmanaged it dwarfs the implementation it is
reviewing.

**The invariant worth paying for is not "more eyes on every checkpoint." It is
"eyes on the surface the default reviewer's sweep will not cover."** Those are
different, and conflating them is how a run ends up spending millions of tokens
to find a comment-wording error.

**Scale the panel to the diff's *unswept surface*, not to the checkpoint's
importance.** The trigger is mechanical — before convening, name the specific
thing a panel would look at that Severus's own pass would not. If you cannot
name it, do not convene:

- **Severus alone** — the diff's risk lies entirely inside the lens he already
  runs (correctness, the paths tests miss). A change confined to one layer, whose
  every consequence is reachable by reading outward from the diff, has almost no
  unswept surface — however load-bearing the checkpoint feels.
- **Severus + 2–3 lenses** — the diff opens surface his default sweep is
  structurally blind to: a second *layer* with different rules from the one the
  diff sits in, a different *artifact class* (configuration, assets, build
  settings, generated code), or a dependency boundary whose behavior is not in
  this repo. A claim that needs an empirical probe rather than a read is not a
  lens — it is a prove-or-refute request to Harry.
- **Severus + a full panel** — a checkpoint whose failure is expensive *and*
  whose surface spans several of those at once. Rare. One or two per run.

**Two sizing mistakes, both real:**

- *Uniform intensity.* Running the same panel on every checkpoint because the
  milestone matters. The milestone's importance is already priced into having
  the loop at all; it does not tell you where a second reader helps.
- *Sizing by the reviewer's confidence.* "Severus approved, so we're fine" and
  "Severus is unsure, so send everyone" are both wrong — a reviewer's confidence
  is highest exactly where his lens does not reach, because nothing looked back.

**When a panel does pay, it usually pays outside the reviewer's frame, not
deeper inside it.** Convene lenses that ask a *different question*, not lenses
that re-ask the same question harder. Three agents re-reading the same diff for
correctness is triple cost for near-zero added coverage; one agent asking "what
did this swap silently discard?" is a different question and finds different
bugs.

**Coverage and refutation are different jobs.** A coverage specialist is named
for an uncovered boundary and owns that surface. A claim refuter is a bounded
challenge to one load-bearing conclusion and may read the same surface without
duplicating the review. Neither is the validation batch: that is one read-only
pass over all blocking candidates between D and E, done by one non-origin
validator (`review-contract.md`), not a panel.

**Bound author work, not message count.** `review-contract.md` limits completed
repair/re-review rounds and evidence-only batches separately. Re-review a delivered
repair before applying the stop rule; a limit does not authorize a bigger panel
or reset same-root escalation attempts.
**Budget the loss when a fan-out dies.** A phase whose agents all fail together
(rate limit, API error) usually caches nothing — the whole spend is gone.
On a long run, prefer several smaller convenings over one giant one, and treat a
mid-flight failure as a sizing signal, not just bad luck.

**Never let a review run against a moving tree.** If a fix lands while a panel
is reading, its findings describe a state that no longer exists. Either hold the
fix until the review returns, or hold the review — never both at once.

**Size the lead reviewer's rounds too, not just the panel.** It is easy to apply
all of this to convening and none of it to Severus himself, and then wonder why a
twenty-line rework cost as much as the checkpoint that introduced it. Every
dispatch says what to examine; a re-review dispatch must also say **what not to
re-examine, and why** — the findings already settled, the evidence already
produced, the sweeps whose premises have not changed. Without that, each round
silently re-runs the previous one at full price and the loop's cost stops
tracking how much new surface there is. (What makes a re-review cheap or
expensive is novelty, not line count — `reviewer.md`, Re-review.)

## The working plan is memory, not an archive

The rule above — if it isn't in the working plan, it's lost — creates a pressure
the orchestrator has to actively counterbalance. Every review round adds findings,
rulings, corrections, and memos; nothing removes them. A persistent implementer
re-reads that document every round, so an unpruned plan quietly becomes the
largest recurring cost in the run, and the signal in it thins out as it grows.

Two habits keep it useful:

- **Prune on pass.** When a checkpoint commits, its resolved findings and
  superseded reasoning have done their job. Collapse them to the durable residue
  — the rulings that constrain future work, the corrections to facts the run got
  wrong — and discard temporary narratives under the cleanup policy below.
  Keep what a future checkpoint must honor, not a new archive file by default.
- **Brief by section, not by document.** A dispatch names the sections that bear
  on this checkpoint — its own entry, plus the specific standing constraints it
  must honor — and never says "read the plan." The document is a reference the
  roles index into, not a preamble they recite each round.

### Storage, retention, and commits

The working plan is **coordination state, not automatically a Git deliverable**.
Its storage is an explicit plan-time decision (`assets/plan-template.md`):

- **Default: session memory or one task-scoped temporary root outside the
  workspace.** Temporary execution plans, progress lists, and review reports are
  scratch artifacts under the cleanup policy below. Do not commit them by
  default, and do not hide them behind new `.gitignore` rules.
- **Durable exception: a user-approved maintained roadmap/design document.** It
  may live in the repository and be updated with checkpoint status because the
  user explicitly chose it as durable. That approval also decides who commits it
  and when; it does not make every other plan/progress/review file durable.
- **Commits are code/tests by default.** Actual rules, templates, code, and tests
  are deliverables and do belong in Git; a checkpoint commit does not have to
  carry a plan update. When the durable exception exists, its update follows the
  approved document's own retention/lifecycle decision.
- The memory rule still applies to the chosen storage: if a constraint is not
  recorded where the roles will read it, it is lost. "Not in Git" does not mean
  "not written down."

## What the orchestrator does at each verdict

- **REQUEST-CHANGES:** batch-validate the blocking candidates (D→E above); relay
  the confirmed P1/P2 findings and open evidence routes (edge E) → Harry fixes
  (edge F) → Severus re-reviews (edge C). Never advance with an open confirmed
  P1/P2, an unresolved blocking `needs-evidence`, or a required human approval
  replaced by consensus.
- **Before more author work:** apply the separate repair-round and evidence
  budgets in `review-contract.md`. Complete the verdict on an existing repair;
  stop/reassess before exceeding a budget. Never suppress a new serious finding.
- **APPROVE:** confirm the approval gate (`review-contract.md`) is satisfied —
  every candidate accounted for, gate green on the exact state, deviations ruled,
  P2 waivers attributed, no unresolved required verification. Albus completes
  temporary-artifact cleanup below, records the lightweight feedback entry, then
  commits the checkpoint's code/tests as one traceable unit. A working plan or
  review report is not part of that commit unless the user approved it as a
  durable roadmap/design document. Update the working plan in its chosen storage
  (session/temp by default), stamp the durable doc if one exists ✅ with date +
  commit hash, then fold forward. Do not hand cleanup back to the user.

## Temporary artifacts — Albus owns cleanup

Review evidence must be available during review; it does **not** belong in Git by
default. Use session/tool output when sufficient. When files are needed, choose
one task-scoped temporary root outside the workspace, within allowed filesystem
permissions, and pass its location to the workers. Track the exact paths this run
creates; Harry includes that inventory in his delivery. Raw logs, experiment
patches, snapshots, scratch scripts, per-run review reports, progress lists, and
temporary execution plans are **not committed by default**; they are not
deliverables. Do not hide them behind new ignore rules either. A user-approved
maintained roadmap/design document is the durable exception; explicit
user-requested artifacts are the other.

After each checkpoint's approval, before committing or advancing, **Albus** must:

1. Remove only superseded artifacts whose producers and consumers have finished.
   Retain the active working plan, counters, unresolved findings, deviation registry
   and downstream memos wherever they are stored, plus evidence still needed for
   later checkpoints, repair/re-review or post-operation checks. A future reader
   is still a consumer; checkpoint approval does not end the whole run.
2. Preserve the concise result and verification outcome in the existing working
   plan, conversation or PR—not a new audit bundle. Confirm the next checkpoint's
   brief and carry-forward state remain readable after the proposed cleanup.
3. Verify resolved absolute targets and ownership, then remove only the obsolete
   task-owned files. Do not remove a temporary root containing active state.
   Never infer ownership from a filename or untracked status; never use blanket
   `git clean`, resets, or unstaging. Preserve user files, pre-existing changes
   and staging; ask if ownership/retention is unclear.
4. Inspect workspace/Git status and verify the selected obsolete paths are gone
   and retained state still exists. Cleanup must not change reviewed code/config/
   tests; if it does, return to validation/review. Name blocked cleanup honestly.

At final closeout or cancellation, remove the task-owned temporary root only after
all remaining consumers finish and necessary handoff/resume state has been copied
to and read back from a surviving conversation/PR or approved durable document. The
plan inside that same root is not a surviving destination. A pause or budget stop
is not permission to discard unresolved findings or reset counters: retain their
state or verify this transfer before deletion. Planned retention is not failed
cleanup and does not make temporary plans Git deliverables.

## Carry-forward: how data survives between checkpoints

Two things must persist across checkpoint boundaries or the loop leaks knowledge:

- **Deviation registry** (in the working plan, wherever it is stored). Every
  accepted deviation, with ID, reason, and scope. This is the honest record of
  "what we built vs. what the doc said," and it's what you reconcile into the
  spec/contract at closeout. A durable roadmap/design doc is the exception where
  this may live in Git; by default it is session/task-scoped state.
- **Carry-forward memos** (in the working plan, written into the *target*
  checkpoint's section). When Severus's APPROVE report (edge D) contains a
  downstream memo — a constraint the next stage must honor, a limitation to work
  around, a test the finale must add — the orchestrator writes it *now* into that
  future checkpoint's brief-to-be. A reviewer who has read the whole run will
  often predict a hazard several checkpoints early; capture the prediction or
  you'll rediscover it the hard way.

If it isn't written into the working plan, it didn't happen. That plan is the
loop's memory between stages, not a default repository file.

## Closeout (after the last checkpoint)

- **Argus's UI walkthrough first** — only if the working plan carries Figma links
  (recorded by Albus at Plan time; no links = skip, and UI verification routes
  to manual acceptance). Argus launches the app Harry's final full gate already
  built and walks the milestone's flows in the simulator against the Figma
  frames; findings (screenshot + violated frame) come back as a normal review
  report — P1/P2 block closeout, Harry fixes, Argus re-walks the affected
  flows. Full discipline in `reviewer.md` (Argus).
- Compile the acceptance mapping: every requirement ↔ how it was verified
  (automated test / headless assertion / **manual or user acceptance** for
  anything the environment couldn't execute — stated as such, never faked).
- Reconcile the deviation registry back into the spec/contract as errata.
- For an in-scope release/destructive migration, verify the operation handoff in
  `reviewer.md`: record post-operation results, recovery actions and residual risk.
  If another operator owns execution, hand off the named checks and recovery plan
  with results marked pending; code APPROVE is not operational verification.
- Deliver the closeout summary: acceptance check-off, known limitations and
  explicitly deferred work. Use the agreed closeout document if one is a required
  deliverable; otherwise use the conversation or PR, not a new report file.
- Albus verifies temporary-artifact cleanup again after the last reviewer or UI
  walkthrough finishes, before handing the workspace back.
- The residual risk the automated nets can't catch is handled by *naming it
  explicitly*, not by pretending it's covered.

## Anti-patterns (the ways the loop rots)

- **The orchestrator writes code.** No independent judge left; you're reviewing
  your own work by proxy.
- **Same agent implements and reviews.** Collapses the one property that makes
  this work.
- **A fresh agent per checkpoint.** Respawning Harry or Severus each round is
  amnesia by another name — the accumulated memory the roles exist to build is
  thrown away. Create once per parent session, then continue the same agent;
  rehydrate a new cast from the plan only in a genuinely new parent session.
- **Severus takes the gate on faith — or builds anything at all.** Both are
  wrong. A bare claim is never enough: audit the evidence (command, raw output,
  tree-state stamp, scope). And a suite rerun on an unchanged tree verifies the
  reporter, not the code — all building and test execution is Harry's, in
  development; a reviewer who needs something run sends Harry a
  prove-or-refute request instead of compiling a PoC himself.
- **A red gate enters review.** Review exists to find the bugs tests can't see,
  not to discover the build is broken — bounce red deliveries at edge B.
- **Advancing with open P1/P2.** The whole point is not shipping the known bug.
- **Faking verification you couldn't run.** State the boundary; route to manual.
- **Losing a memo between checkpoints.** If it's not in the working plan, it's
  gone — regardless of whether that plan lives in session memory, a temp root, or
  an approved durable doc.
- **Checkpoints too big to review deeply.** If Severus can't hold it in his head,
  split finer.
- **Uniform review intensity.** Convening the same panel every checkpoint because
  the milestone matters. Size to the diff's unswept surface (Review economy above)
  — otherwise the cheap checkpoints subsidize nothing and the run's cost stops
  tracking its risk.
- **A working plan that only grows.** Every round adds; nothing is ever pruned;
  the persistent implementer re-reads all of it every round. Prune on pass.
- **Committing the working plan by habit.** Temporary execution plans, progress
  lists and review reports do not belong in Git by default; a repo plan needs the
  user's durable-roadmap approval, not a `.gitignore` workaround.
- **Relaying findings before validation.** A reporter's chain is a candidate, not
  a repair order. Skipping the one batch validation turns review into churn and
  can send Harry to fix a non-defect.
- **One validator per finding.** "Independent validation" does not mean spawning
  an agent for every finding; that is the fan-out cost with none of the coverage.
- **Treating review rounds as progress.** Three completed repair/re-review rounds with the same
  blocking findings is a signal to reassess, not to queue a fourth automatic
  round. Re-scoping or renaming the same work to reset the counter is the
  auto-reset loophole.
- **Escalating because churn hit the cap.** Voldemort exists for same-root
  failure evidence, not for reviewer noise.
- **Letting an agent stand in for a required human approval.** Model consensus
  and a green gate cannot sign off a policy-, release-, or migration-gated
  decision.
- **Approving a green suite over an untested path.** Zero confirmed findings with
  open required verification is still blocked.
