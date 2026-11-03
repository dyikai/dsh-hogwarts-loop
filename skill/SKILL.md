---
name: hogwarts-loop
description: "Run a full plan→build→review→commit loop for a large engineering effort: Albus plans checkpoints, Harry implements each one, Severus plus a specialist bench reviews it, and Albus commits on pass. Every role is dispatched through hogwarts_dispatch on its own configured model."
---

## Hogwarts Loop — plan → build → review → commit

A discipline for taking a large engineering effort all the way from a plan to
committed, reviewed code — as a sequence of small, independently-verified
checkpoints. It starts with **planning**: **Albus** (the Planner) reads the
source of truth and decomposes it into a checkpoint plan. Then the engine is a
**builder/reviewer separation**: an *implementer* — **Harry** — writes each
checkpoint's code, an *independent reviewer* — **Severus** (plus a bench of
specialists) — tries to break it, and they loop until it's clean; then Albus
commits it and moves to the next. You (the main agent) *are* Albus — you plan,
dispatch, judge, and commit, but you never write the feature code yourself. (The
cast is a mnemonic: Albus/Dumbledore plans and orchestrates from above, Harry does
the work, Severus scrutinizes it.)

This is a multi-agent mode, not a requirement to delegate every task. If the user
asks for personal execution or forbids subagents, work directly outside this loop
and do not claim independent review.

### Dispatch in this harness

Use **`hogwarts_dispatch`** for both first dispatch and every later brief to a
cast member, never `subagent` / `subagent_fork` / `spawn_teammate` as a replacement.
**One parent session has one child per role.** The first call creates the child
on that role's configured model; later calls continue the same child and its
conversation, across checkpoints as well as fix→re-review rounds.

```
hogwarts_dispatch({ role: 'harry', description: 'CP1 build', prompt: '<first brief>' })
// After CP1 passes: same Harry, same childId, not a new implementer.
hogwarts_dispatch({ role: 'harry', description: 'CP2 build', prompt: '<next brief>' })
```

Rules of dispatch:

- The first `prompt` includes the role instructions, scope, spec references,
  conventions, gates, and constraints. Later briefs give the next scope or
  findings and changed constraints; the child retains its own history but does
  not automatically see Albus's conversation. The tool prepends the current
  Harry/Voldemort persona on continuations too, superseding historical role
  instructions without replacing the child or its creation-time model.
- CP completion, an idle/inactive child, context compaction, and returning from
  a Voldemort escalation are **not** reasons to create another Harry.
- Dispatch is nonblocking. Wait for the relevant delivery before assigning that
  role another checkpoint; simultaneous briefs to one role are not independent
  workers. Different review roles may run in parallel.
- Set `cwd` only on first creation. Omit it on subsequent calls, which preserve
  the child's established working directory.
- A continuation error is a blocker to diagnose, not permission to bypass the
  binding with another tool. Resume the existing child; do not silently replace
  it. A genuinely new parent session starts a new cast, briefed from the plan.

The tool schema lists the authoritative cast. Configure creation-time model
routes in **Settings → Hogwarts Loop** (also available from the Plugins row).
Changing defaults does not replace an existing role's child or reset its memory.

### Why this pattern earns its cost

Running two subagents plus a loop is more expensive than just implementing. It
pays off precisely when a mistake is expensive, because it defends against the
single biggest failure mode in real work: **an author cannot see the bug in code
they just convinced themselves is correct.** The implementer's own tests pass
because they test what the implementer *thought about*. An independent reviewer,
holding an adversarial mindset and re-deriving the spec, walks the paths the
author skipped. That gap is where the worst bugs live — the ones that ship green.

So the value is not "more review." It is *structural independence* (a reviewer
who is not the author) + *bounded blast radius* (small checkpoints) + *a
full-workspace safety net on every state that reaches a commit* (gates). Keep
all three or the pattern degrades into theater.

### When to use it, and when not to

Use it for: planning *and* building milestone/phase work against a design or spec,
large refactors, engine/framework internals, anything spanning many files or
multiple sessions, anything where a silent regression would be costly. Reach for
it at the *planning* stage — when the user wants to lay out a big piece of work
and then actually build it.

Don't use it for: small changes you can verify in one pass, exploratory spikes
where the goal is learning not shipping, tasks with no objective gate (you'll
spin without a way to say "this checkpoint passed"), a one-off review of an
existing PR, or authoring the design/requirements spec itself (that's the input
to this loop, not its job).

### The cast at a glance

- **Planner / orchestrator — Albus (you).** *First* read the source of truth and
  decompose it into a checkpoint plan recorded in the **working plan**. Choose its
  storage explicitly: session memory or a task-scoped temp root outside the
  workspace by default; a repository plan only when the user approves it as a
  maintained roadmap/design document. Temporary execution plans, progress lists
  and review reports are not committed by default and are not hidden behind
  `.gitignore`. *Then* drive the loop: dispatch each stage, judge pass/fail,
  commit code/tests on pass, carry memos and deviations forward. You are the only
  one who commits, and you never write the feature code — that separation keeps
  your judgment uncontaminated by authorship. You also own post-review cleanup:
  remove obsolete task-owned artifacts before advancing or replying, retaining
  active plans and carry-forward state until their consumers finish. Transfer
  required handoff/resume state before final root cleanup (`references/loop.md`).
- **Implementer — Harry.** Builds one checkpoint to spec, runs the gates (all
  build/test execution is his and happens during development — every test the
  checkpoint needs is written, built and run before delivery; a red gate never
  enters review, so what reaches Severus is a fully green tree plus its
  evidence), reports what he did and every deviation, does not commit, stays
  in scope.
- **Reviewer — Severus** (+ the specialist bench: Alastor/security,
  Filius/performance, Minerva/concurrency, and Argus/UI-walkthrough — who runs
  once at closeout, only when the plan carries design links). Independently
  verifies against the spec, audits Harry's gate evidence, probes adversarially
  by reading and reasoning — **review time is read time: no builds, no test
  runs, no PoC compiles**; a suspicion only execution can settle goes back to
  Harry as a prove-or-refute request — returns APPROVE or REQUEST-CHANGES with
  categorized findings, rules but never fixes. Findings are candidates until a
  non-origin validator confirms them; the reviewer never validates his own. The
  one reviewer who touches a build is Argus, and only to launch the artifact
  Harry already built.
- **One-problem escalation advisor — Voldemort.** Read-only thinking, diagnosis
  and executable advice after Harry's three failed independent attempts on the
  same unresolved problem. He never edits code, runs builds/tests, commits, self-closes a
  fix or takes other checkpoints. Albus relays advice and actual evidence;
  Harry always implements and tests, and Severus independently closes the fix.

Keep every role as a **distinct subagent with persistent context** across the
whole parent session. Each checkpoint is a new assignment, not a new agent.
Harry and Severus keep the same childIds for subsequent checkpoints and
fix→re-review rounds. The working plan supplements their memory and bootstraps a
new cast only when work moves to a genuinely new parent session; its storage
(durable repo doc vs session/temp) does not change the role binding.

### Simplify large deliveries before review

Harry measures every delivery and fix report against the conditional gate in
**`references/ablation.md`**. When triggered, he runs controlled deletion or
substitution experiments before the final gate; acceptance must not weaken.
Albus rejects missing evidence, and Severus audits the experiments with the code.
A successful review is not a substitute for this check. Load the reference when
planning gates, preparing a delivery, or auditing its complexity report.

### Escalation: Voldemort

Harry makes **three independent attempts** on the same unresolved problem
before advisor-guided collaboration. **Same-root** is operationally tracked by a
stable problem/failure and acceptance criteria: record the proven root when known,
or the current unproven hypothesis. Proving the exact root is not an escalation
prerequisite; changing diagnostic hypotheses does not reset attempts. Independent,
unrelated defects cannot be combined or borrow this problem's budget precedence.
One attempt has a substantive approach, implementation and validation evidence. A red gate can end a failed attempt;
neither a green tree nor entry into review is required to count it. An independently
confirmed same-root P1 **or P2** remaining after implementation can also establish
failure. Repeating commands, progress messages, evidence-only probes and unrelated
new roots do not add attempts. A successful third attempt does not escalate;
a green gate alone does not close a known unresolved finding.

If the **third attempt still fails, Harry must promptly report to Albus**, not
continue private independent retries. Albus records the history and brings in
`voldemort` for **one problem**, with:

- the checkpoint spec, acceptance criteria and concrete unresolved problem,
  with its proven root or still-unproven diagnostic hypotheses,
- each of Harry's three approaches and changes (paths and shape of fix),
- exact validation/failure evidence, including red gates or confirmed findings,
- ruled-out possibilities, current hypothesis and relevant scope/approval limits.

Voldemort is a **read-only advisor**, not a replacement implementer. He inspects,
thinks, diagnoses and returns an executable next-step plan, hypotheses to validate,
a bounded validation scenario and acceptance signals. He never edits code, runs
builds/tests, commits, declares closure or takes another checkpoint. Albus relays
his advice to **the same Harry child**; Harry implements, tests and returns actual
changes and evidence. Albus sends the results and failure report back to Voldemort,
who adjusts the approach. Severus independently reviews and closes the fix; an
advisor's confidence or Harry's green claim cannot replace closure.

Continue this collaboration until the problem is solved: **no fixed two-round or
total-attempt cap**, and no independent-phase limit truncates Harry's guided work.
Keep the first three attempts and cumulative totals; never reset history. Albus
reassesses each round and authorizes bounded diagnosis **or** implementation with
an evidence-driven new/revised hypothesis or diagnostic question, named commands,
time/scenario limits and decidable signals. Diagnosis need not change code; Harry
executes and reports, and evidence is validated before repair is authorized.
Never blindly repeat ineffective work. Honor a
human stop request, and honestly report real permission, environment or external
prerequisite blockers rather than claiming completion.

`review-contract.md` defines the narrow precedence over the ordinary repair cap
and evidence budget, including eligible diagnostic-only rounds. Unescalated work,
blind probe churn and unrelated problems do not receive this exception;
unrelated roots cannot borrow this problem's collaboration allowance. These are
agent work contracts, **not runtime ACLs or automatic attempt counters**.

### Review discipline

Use **`references/review-contract.md`** for the operational rules:
- Report a concrete failure and the guard checked, not speculative concerns.
- Albus batch-validates blocking candidates; complete static proof is enough.
  Execution-only questions go to Harry, and the independent reviewer closes fixes.
- Count complete repair/re-review rounds, not messages. Evidence-only work has a
  separate finite budget; a successful probe plus repair is not two repair rounds.
- Default to Severus alone. Add a specialist for a material risk or unresolved
  question the existing review has not covered (`references/reviewer.md`).
- Honor required human approvals; do not invent new signoff forms for routine work.

The limits are workflow instructions, not host permissions or runtime enforcement.
`references/evaluation.md` describes a small controlled comparison; neither these
instructions nor passing unit tests demonstrate better review outcomes.

### Build once, in development

All compiling and testing belongs to the development side of the loop. Harry
writes the tests the checkpoint calls for, builds, runs them, and hands over a
green tree with the evidence (command, raw output, tree-state stamp). Reviewers
read code and evidence; they do not compile, do not rerun suites, do not spin
up simulators, and do not get worktrees to build in — every build a reviewer
starts is cost the loop already paid once, and a rerun on an unchanged tree
verifies the reporter, not the code. When a reviewer's suspicion can only be
settled by running something, it returns as a **prove-or-refute request**
(input, expected failure, the test to write) that Albus routes to Harry. Harry
has the build: he returns the unchanged pre-fix red evidence for non-origin
confirmation, then fixes only after confirmation; the test stays as the
regression lock. The single exception is the UI walkthrough (Argus), which
launches the already-built app and never rebuilds it.

### Where the detail lives

This file is the overview. The operational detail lives in the skill directory;
read — or paste into a child's brief — the file for the role you are dispatching:

- **`references/planner.md`** — Albus's full responsibilities: how to plan
  (decompose into checkpoints, define gates, write the working plan and choose
  its storage/retention), then dispatch, judge, commit code/tests, and keep the
  run honest.
- **`references/implementer.md`** — Harry's full responsibilities and the
  dispatch brief you send him.
- **`references/reviewer.md`** — Severus's full responsibilities, the finding
  axes, adversarial technique, the professor bench (Severus=correctness lead,
  Alastor=security, Filius=performance, Minerva=concurrency, Argus=closeout UI
  walkthrough), coverage specialists vs claim refuters, review panels, security
  triage, and how to wire in built-in review tooling.
- **`references/review-contract.md`** — the canonical finding record and
  lifecycle (severity / evidence status / disposition), batch validation, the
  prove-or-refute evidence standard, stable IDs and class-of-bug handling, and
  the separate repair-round and evidence budgets, including escalation precedence.
- **`references/loop.md`** — the per-checkpoint state machine, the data handoff
  between Albus, Harry, and Severus, and the transport mechanics for continuing
  the same children across rounds.
- **`references/evaluation.md`** — lightweight outcome feedback, the synthetic
  seed corpus and its input/expectation separation, and the honest limits of any
  comparison.
- **`references/example.md`** — a concrete worked run: checkpoint-sizing
  heuristics, a real milestone decomposition, and one full review round-trip.
- **`assets/plan-template.md`** — skeleton for the working plan (including the
  storage/retention decision, risk/approval, review-ledger and convergence
  fields). The template is a product asset; each run's filled plan is not
  committed by default.
- **`assets/eval-inputs.md` / `assets/eval-expectations.md`** — synthetic smoke cases.
- **`assets/eval-legacy-inputs.md` / `assets/eval-legacy-expectations.md`** — a
  repository-derived before/after pair and staged closure replay, with provenance
  and a full-loop variant. Keep all scoring material and unreleased snapshots
  outside the evaluated agents' accessible context; never paste answers into briefs.
