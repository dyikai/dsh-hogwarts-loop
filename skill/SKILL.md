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
  not automatically see Albus's conversation.
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
  decompose it into a checkpoint plan (the living plan doc). *Then* drive the
  loop: dispatch each stage, judge pass/fail, commit on pass, carry memos and
  deviations forward. You are the only one who commits, and you never write the
  feature code — that separation keeps your judgment uncontaminated by authorship.
  You also own post-review cleanup: remove this run's temporary artifacts before
  advancing or replying, without waiting for the user (`references/loop.md`).
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
  categorized findings, rules but never fixes. The one reviewer who touches a
  build is Argus, and only to launch the artifact Harry already built.
- **Escalation implementer — Voldemort.** Behaves exactly like Harry — same
  gates run during development, same green tree plus raw evidence, never commits
  — but he runs on the stronger model configured for his seat and is dispatched
  for **one unresolved problem**, never for the implementer's remaining work
  (see *Escalation* below). His work is still reviewed by Severus.

Keep every role as a **distinct subagent with persistent context** across the
whole parent session. Each checkpoint is a new assignment, not a new agent.
Harry and Severus keep the same childIds for subsequent checkpoints and
fix→re-review rounds. The plan doc supplements their memory and bootstraps a
new cast only when work moves to a genuinely new parent session.

### Simplify large deliveries before review

Harry measures every delivery and fix report against the conditional gate in
**`references/ablation.md`**. When triggered, he runs controlled deletion or
substitution experiments before the final gate; acceptance must not weaken.
Albus rejects missing evidence, and Severus audits the experiments with the code.
A successful review is not a substitute for this check. Load the reference when
planning gates, preparing a delivery, or auditing its complexity report.

### Escalation: Voldemort

Harry gets **three attempts** on a problem. One attempt is one
build → gate → review round on the same root cause: you dispatch him, he returns
a green tree with evidence, Severus rules. A green tree + APPROVE ends the
problem at whatever attempt it lands, so a third attempt that passes never
escalates.

If the **third** attempt still fails — the gate stays red, or Severus keeps
returning P1 findings on the *same* root cause rather than on new work — stop
retrying Harry and escalate once to `voldemort`.

Voldemort is **the same kind of worker as Harry**, not a different one: hand him
the working contract you would give Harry (scope, gates, evidence, no commit) and
the only differences are the model behind him and the history he receives. The
escalation brief is not the spec again; it must carry:

- the checkpoint spec and its acceptance criteria,
- what Harry changed in **each** attempt (paths and the shape of each fix),
- the exact failure evidence for each attempt (gate output, Severus's findings),
- what you have already ruled out, and the current working hypothesis.

Voldemort's mandate is **one problem, not the checklist**. His brief names the
single unresolved problem and he may change only what that problem needs:

- do not hand him the remaining checkpoints,
- do not let him "clean up while he is here" or refactor beyond the problem,
- once that problem is green and Severus approves it, control returns to Harry
  for everything else — Voldemort is not kept on the checkpoint,
- he is never dispatched for an ordinary checkpoint that Harry has not failed
  three times.

Voldemort gets **at most two attempts**. His result still goes through Severus
before you commit. If the second Voldemort attempt also fails, **stop**: report
back to the user with the problem statement, the five attempts (3 × Harry,
2 × Voldemort), the evidence, what was ruled out, and the options you see. Do not
dispatch a fourth Harry, do not dispatch a third Voldemort, and do not quietly
widen the checkpoint scope to make it pass.

### Build once, in development

All compiling and testing belongs to the development side of the loop. Harry
writes the tests the checkpoint calls for, builds, runs them, and hands over a
green tree with the evidence (command, raw output, tree-state stamp). Reviewers
read code and evidence; they do not compile, do not rerun suites, do not spin
up simulators, and do not get worktrees to build in — every build a reviewer
starts is cost the loop already paid once, and a rerun on an unchanged tree
verifies the reporter, not the code. When a reviewer's suspicion can only be
settled by running something, it returns as a **prove-or-refute request**
(input, expected failure, the test to write) that Albus routes to Harry, who
has the build and writes the test that settles it — a test that then stays as
the regression lock. The single exception is the UI walkthrough (Argus), which
launches the already-built app and never rebuilds it.

### Where the detail lives

This file is the overview. The operational detail lives in the skill directory;
read — or paste into a child's brief — the file for the role you are dispatching:

- **`references/planner.md`** — Albus's full responsibilities: how to plan
  (decompose into checkpoints, define gates, write the plan doc), then dispatch,
  judge, commit, and keep the run honest.
- **`references/implementer.md`** — Harry's full responsibilities and the
  dispatch brief you send him.
- **`references/reviewer.md`** — Severus's full responsibilities, the P1/P2/P3
  severity scheme, adversarial technique, the professor bench
  (Severus=correctness lead, Alastor=security, Filius=performance,
  Minerva=concurrency, Argus=closeout UI walkthrough), review panels, and how to
  wire in built-in review tooling.
- **`references/loop.md`** — the per-checkpoint state machine, the data handoff
  between Albus, Harry, and Severus, and the transport mechanics for continuing
  the same children across rounds.
- **`references/example.md`** — a concrete worked run: checkpoint-sizing
  heuristics, a real milestone decomposition, and one full review round-trip.
- **`assets/plan-template.md`** — skeleton for the living plan doc.
