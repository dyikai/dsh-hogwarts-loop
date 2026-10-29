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
                          │ checkpoints → write living plan doc →        │
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
        │     └── APPROVE ──▶ orchestrator commits (code + plan update) +            │
        │                     folds P3s/memos forward + advances to next CP          │
        └────────────────────────────────────────────────────────────────────────────┘
                                                 │
                          ┌──────────────────────┴──────────────────────┐
                          │ CLOSEOUT: Argus UI walkthrough (if Figma      │
                          │ links in plan) · acceptance mapping ·         │
                          │ reconcile deviations into spec · closeout     │
                          │ doc · name residual/manual-only risk          │
                          └──────────────────────────────────────────────┘
```

A checkpoint exits (edge → APPROVE) only when Severus approves **and** the full
gate is green on the exact state being committed (see Gate economy below).
Before review, every delivery must also satisfy the conditional complexity and
ablation gate in `ablation.md`; missing required experiments are not review-ready.

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
- Focus areas, highest-risk-first.
Full template in `reviewer.md`.

### D' — Severus → orchestrator: *convening request* (optional, instead of D)
Returned when the triage pass hits something Severus cannot settle in his own
lens. Not a substitute for reviewing — everything he *could* settle is already
settled and reported alongside.
- Which specialists, named.
- **Per specialist: the exact point he cannot settle**, not a risk adjective.
- What he already ruled on, so the panel does not redo it.
The orchestrator approves, trims for budget, and adds any lens the diff cannot
reveal (plan-derived constraints) plus — where the verdict rests on Severus's
own reading — a lens pointed at that reading. Then the panel runs and returns D.

### D — Severus → orchestrator: *review report*
- Verdict: APPROVE or REQUEST-CHANGES.
- Findings, each [P1 / P2 / P3] + file:line + concrete failure scenario +
  suggested fix.
- A ruling on each declared deviation (accept/reject + reason).
- Gate verification results (ran / audited) — and, honestly, what was only
  static-analyzed.
- On APPROVE: downstream memos for later checkpoints.

### E — orchestrator → Harry: *findings relay*
- The P1/P2 findings to fix (P3s are recorded, not blocking).
- Which deviations were rejected and must change.
- Any orchestrator decision on contested points.

### F — Harry → orchestrator: *fix report*
- Per-finding: what the fix was.
- Reran the gate per the gate economy (cheap mode: the whole gate, not just the
  touched module; expensive mode: the fast gate — the one final full gate lands
  before commit).
- New tests added to lock each bug against recurrence.
- Incremental complexity since the last validated ablation (or checkpoint start);
  any newly triggered experiments and their final-survivor evidence.
Then loop back to edge C for Severus's re-review.

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
the build, he writes the failing test. The single exception is Argus, who
launches the artifact Harry's final full gate already produced — he never
rebuilds either.

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
and it is the one that actually blows up: a fan-out panel with per-finding
refutation is one to three orders of magnitude more expensive than a single
reviewer. Left unmanaged it dwarfs the implementation it is reviewing.

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

## The plan doc is working memory, not an archive

The rule above — if it isn't in the plan doc, it's lost — creates a pressure the
orchestrator has to actively counterbalance. Every review round adds findings,
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

## What the orchestrator does at each verdict

- **REQUEST-CHANGES:** relay the P1/P2 findings (edge E) → Harry fixes (edge F) →
  Severus re-reviews (edge C). Never advance with an open P1/P2.
- **APPROVE:** Albus completes temporary-artifact cleanup below, then commits the
  checkpoint as one traceable unit (code **and** plan update). Stamp it ✅ with
  date + commit hash, then fold forward. Do not hand cleanup back to the user.

## Temporary artifacts — Albus owns cleanup

Review evidence must be available during review; it does **not** belong in Git by
default. Use session/tool output when sufficient. When files are needed, choose
one task-scoped temporary root outside the workspace, within allowed filesystem
permissions, and pass its location to the workers. Track the exact paths this run
creates; Harry includes that inventory in his delivery. Raw logs, experiment
patches, snapshots, scratch scripts and per-run review reports are temporary,
not deliverables. Do not hide them behind new ignore rules or commit them by
default. Explicit user-requested artifacts are the exception.

After Severus's final approval, and before committing, advancing or sending the
final response, **Albus** must:

1. Wait for every producer/consumer of those artifacts to finish. On
   REQUEST-CHANGES, retain only evidence still needed for repair/re-review,
   outside the workspace; remove superseded scratch work.
2. Preserve a concise result, verification outcome and necessary carry-forward
   decisions in the existing plan, conversation or PR—not a new audit bundle.
   Keep source, regression tests and agreed deliverables.
3. Verify resolved absolute targets and ownership, then remove this run's
   temporary files, including any workspace leftovers and its temporary root.
   Never infer ownership from a filename or untracked status; never use blanket
   `git clean`, resets, or unstaging to make the tree look clean. Preserve user
   files, pre-existing changes and staging; ask if ownership/retention is unclear.
4. Inspect the workspace and Git status against the starting state and intended
   deliverables. Also verify the known temporary paths are gone. Cleanup must not
   change reviewed code/config/tests; if it does, return to validation/review.
   If cleanup is blocked, name the remaining paths and reason rather than
   claiming closeout is complete.

Apply the same ownership-safe cleanup when ending or cancelling a run. Keep
needed evidence until its consumers finish, not indefinitely after review. This
is Albus's closeout gate, not an optional suggestion for the user.

## Carry-forward: how data survives between checkpoints

Two things must persist across checkpoint boundaries or the loop leaks knowledge:

- **Deviation registry** (in the plan doc). Every accepted deviation, with ID,
  reason, and scope. This is the honest record of "what we built vs. what the doc
  said," and it's what you reconcile into the spec/contract at closeout.
- **Carry-forward memos** (in the plan doc, written into the *target* checkpoint's
  section). When Severus's APPROVE report (edge D) contains a downstream memo — a
  constraint the next stage must honor, a limitation to work around, a test the
  finale must add — the orchestrator writes it *now* into that future
  checkpoint's brief-to-be. A reviewer who has read the whole run will often
  predict a hazard several checkpoints early; capture the prediction or you'll
  rediscover it the hard way.

If it isn't written into the plan doc, it didn't happen. The living doc is the
loop's memory between stages.

## Closeout (after the last checkpoint)

- **Argus's UI walkthrough first** — only if the plan doc carries Figma links
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
- **Losing a memo between checkpoints.** If it's not in the plan doc, it's gone.
- **Checkpoints too big to review deeply.** If Severus can't hold it in his head,
  split finer.
- **Uniform review intensity.** Convening the same panel every checkpoint because
  the milestone matters. Size to the diff's unswept surface (Review economy above)
  — otherwise the cheap checkpoints subsidize nothing and the run's cost stops
  tracking its risk.
- **A plan doc that only grows.** Every round adds; nothing is ever pruned; the
  persistent implementer re-reads all of it every round. Prune on pass.
