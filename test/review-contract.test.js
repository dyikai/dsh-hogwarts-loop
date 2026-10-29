import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { DEFAULT_ROLES } from '../index.js'

/* Static contract fixtures. These check that the process documents and packaged
 * examples stay internally consistent. They do not evaluate reviewer or model
 * quality, and a green run here is not a measured evaluation result. */

const ROOT = join(import.meta.dirname, '..')
const text = (path) => readFileSync(join(ROOT, path), 'utf8')
const flat = (path) => text(path).replace(/\s+/g, ' ')

const CONTRACT = 'skill/references/review-contract.md'
const EVAL = 'skill/references/evaluation.md'
const INPUTS = 'skill/assets/eval-inputs.md'
const EXPECTATIONS = 'skill/assets/eval-expectations.md'

test('the review contract keeps severity, evidence and disposition distinct', () => {
  const contract = flat(CONTRACT)
  for (const phrase of [
    /severity/i,
    /evidence status/i,
    /disposition/i,
    /candidate/,
    /confirmed/,
    /refuted/,
    /needs-evidence/,
    /pre-existing/,
    /cp-introduced/,
    /repair-introduced/,
    /stable ID/i,
    /source snapshot/i,
    /causal chain/i,
    /guard \/ counterexample checked/i,
    /closure reason/i,
    /batch validation/i,
    /one batch/i,
    /does not originate|not be the candidate's origin/i,
    /security candidates are always inside the batch/i,
    /needs-evidence` is never an approval/i,
    /confirmed P1 is never waived/i,
    /explicit, attributed P2 waiver|P2 waiver is explicit/i,
    /three completed review\/response cycles/i,
    /auto-reset/i,
    /precedence with same-root escalation/i,
    /class of bug/i,
    /routed-out-of-scope/i,
  ]) {
    assert.match(contract, phrase)
  }
})

test('the proof protocol preserves the no-build rule and staged red/green evidence', () => {
  const reviewer = flat('skill/references/reviewer.md')
  const implementer = flat('skill/references/implementer.md')
  const contract = flat(CONTRACT)
  const loop = flat('skill/references/loop.md')

  assert.match(reviewer, /do not compile, do not run the suite|no builds, no test runs, no compiles/i)
  assert.match(contract, /real integration entrypoint/i)
  assert.match(contract, /oracle/i)
  assert.match(contract, /unchanged/i)
  assert.match(contract, /red before repair|red run before repair/i)
  assert.match(contract, /never reset, checkout, stash|Never reset, checkout, stash/i)
  assert.match(contract, /complete deterministic code\/data-flow causal chain/i)
  assert.match(contract, /do not (require|demand) execution|static code proof is valid/i)
  assert.match(contract, /refutes only that scenario|refutes only that bounded scenario/i)
  assert.match(implementer, /red run before repair/i)
  assert.match(implementer, /both source stamps/i)
  assert.match(implementer, /do not repair yet/i)
  assert.match(implementer, /never reset, checkout, stash/i)
  assert.match(loop, /The batch validation between D and E is also read-only/i)
})

test('the finding lifecycle separates reporting, confirmation and closure', () => {
  const contract = flat(CONTRACT)
  const loop = flat('skill/references/loop.md')
  const example = flat('skill/references/example.md')

  assert.match(contract, /two stages: \*\*confirmation\*\*.*\*\*closure\*\*/i)
  assert.match(contract, /A non-origin validator tries to confirm it from the record/i)
  assert.match(contract, /evidence collection only/i)
  assert.match(contract, /bounded handoff is not a second full review and is not a repair/i)
  assert.match(contract, /substantive evidence report consumes one review\/response cycle/i)
  assert.match(contract, /pre-fix evidence response and the later repair response are therefore \*\*two cycles\*\*/i)
  assert.match(contract, /three unresolved evidence-only responses with no code change/i)
  assert.match(contract, /no separate evidence-only allowance/i)
  assert.match(contract, /Harry's fix report proposes a disposition|F report is a proposal/i)
  assert.match(contract, /closed-fixed` only after independent re-review/i)
  assert.match(contract, /When the repro route was required, the same test must be red-before and green-after with both stamps/i)
  assert.match(loop, /proposed.*disposition.*not a self-closed one/i)
  assert.match(loop, /pre-fix evidence report consumes one review\/response cycle/i)
  assert.match(loop, /later repair response consumes another/i)
  assert.match(loop, /no evidence-only exemption/i)
  assert.match(example, /teaching reconstruction/i)
  assert.match(example, /not a recovered historical record/i)
  assert.match(example, /No repair happened before this point/i)
  assert.match(example, /used \*\*two\*\* review\/response cycles/i)
})

test('repeated no-code-change evidence-only reports reach the stop rule', () => {
  const contract = flat(CONTRACT)
  const loop = flat('skill/references/loop.md')

  // Scenario: D1 -> evidence-only report, still needs-evidence; D2 -> another
  // scenario evidence report, still needs-evidence; D3 -> third evidence-only
  // report, still unresolved. Each substantive report counts, so the third hits
  // the checkpoint cap. There is no evidence-only free retry.
  const substantive = ['pre-fix evidence', 'replacement-scenario evidence', 'third evidence-only report']
  assert.equal(substantive.length, 3)
  assert.match(contract, /\| pre-fix evidence-only report \| 1 \|/i)
  assert.match(contract, /\| replacement-scenario \/ `needs-evidence` update \| 1 \|/i)
  assert.match(contract, /\| informational progress note or tool log .* \| 0 \|/i)
  assert.match(contract, /Relabeling an evidence-only report as "not a cycle".*does not evade the count/i)
  assert.match(contract, /Proposing a replacement scenario is a \*\*new substantive evidence response\*\* and counts as the next cycle/i)
  assert.match(contract, /three unresolved evidence-only responses with no code change/i)
  assert.match(contract, /D1 → evidence-only report → still needs-evidence; D2 → replacement-scenario report → still needs-evidence; D3 → third evidence-only report → the third cycle stops automatic work/i)
  assert.match(loop, /Three unresolved evidence-only responses with no code change reach the same stop\/reassess rule/i)
  assert.doesNotMatch(contract, /does not increment the review\/response cycle/i)
  assert.doesNotMatch(loop, /does not increment the review\/response cycle/i)
})

test('E1 and E4 expectations score the candidate stage and keep the original leak open', () => {
  const gold = flat(EXPECTATIONS)

  assert.match(gold, /reviewer's report is a `candidate` with a complete static chain/i)
  assert.match(gold, /Non-origin validator may confirm it statically|confirm it statically/i)
  assert.match(gold, /Original leak \(same ID; still open\)/i)
  assert.match(gold, /repair did \*\*not\*\* fix the reported leak/i)
  assert.match(gold, /repair-introduced regression \(new ID\)/i)
  assert.match(gold, /starts as `candidate` with a clear static chain/i)
  assert.match(gold, /Closure for either requires independent re-review/i)
  assert.doesNotMatch(gold, /Keep the original closed/i)
  assert.doesNotMatch(gold, /repair fixed the reported leak/i)
})

test('comparison guidance holds non-treatment variables and isolates the eval context', () => {
  const guide = flat(EVAL)
  const readme = flat('README.md')
  const skill = flat('skill/SKILL.md')

  assert.match(guide, /non-treatment variable/i)
  assert.match(guide, /record exactly which prompt.*differs/i)
  assert.match(guide, /fresh evaluation context/i)
  assert.match(guide, /withhold gold and previous-run answers/i)
  assert.doesNotMatch(guide, /same frozen snapshot and configuration/i)
  assert.match(readme, /non-treatment variables/i)
  assert.match(skill, /non-treatment variables/i)
})

test('the convergence cap is checkpoint-wide and distinct from same-root escalation', () => {
  const contract = flat(CONTRACT)
  const skill = flat('skill/SKILL.md')
  const loop = flat('skill/references/loop.md')
  const planner = flat('skill/references/planner.md')

  for (const doc of [contract, skill, loop, planner]) {
    assert.match(doc, /three completed review\/response cycles|Three completed review\/response cycles/i)
    assert.match(doc, /(convergence|checkpoint)[ -]?(wide )?cap|cap .*checkpoint/i)
  }
  assert.match(contract, /do not dispatch a fourth review\/response cycle/i)
  assert.match(contract, /Counters are preserved/i)
  assert.match(contract, /stricter limit wins/i)
  assert.match(contract, /Never escalate merely because review churn/i)
  assert.match(skill, /Do not dispatch a fourth Harry, do not dispatch a third Voldemort/i)
  assert.match(skill, /Neither resets the other/i)
  assert.match(loop, /New serious findings are still triaged and routed/i)
})

test('the evaluation assets are synthetic, separate, and cover the required cases', () => {
  const inputs = flat(INPUTS)
  const expectations = flat(EXPECTATIONS)
  const guide = flat(EVAL)

  assert.match(inputs, /synthetic/i)
  assert.match(expectations, /synthetic/i)
  assert.match(guide, /synthetic/i)
  assert.match(guide, /not a measured benchmark|no measured reviewer improvement is claimed/i)
  assert.match(guide, /Never claim an actual model score without running/i)

  for (const id of ['E1', 'E2', 'E3', 'E4', 'E5']) {
    assert.match(inputs, new RegExp(`\\b${id}\\b`))
    assert.match(expectations, new RegExp(`\\b${id}\\b`))
  }

  // The reviewer-safe target file must not carry the scoring answers.
  assert.doesNotMatch(inputs, /Expected defect:/i)
  assert.doesNotMatch(inputs, /Expected decision:/i)
  assert.doesNotMatch(inputs, /fix-required/i)
  assert.doesNotMatch(inputs, /Scoring notes/i)
  assert.match(expectations, /Expected defect:/i)
  assert.match(expectations, /Expected decision:/i)
  assert.match(expectations, /fix-required/i)
  assert.match(expectations, /Scoring notes/i)
})

test('the working example uses the current proof protocol, not reviewer execution', () => {
  const example = flat('skill/references/example.md')
  assert.match(example, /under the current protocol Severus does not run it/i)
  assert.match(example, /original run predates the no-build rule/i)
  assert.doesNotMatch(example, /Severus proved it before escalating/i)
  assert.match(example, /reuses the same finding ID/i)
  assert.match(example, /three completed review\/response cycles/i)
})

test('the plan template carries the risk, approval, ledger and convergence fields', () => {
  const template = flat('skill/assets/plan-template.md')
  for (const phrase of [
    /Risk plan:/i,
    /human approval:/i,
    /rollback\/owner:/i,
    /Security triage:/i,
    /Review cycles:/i,
    /Finding ledger/i,
    /Outcome feedback|Review feedback/i,
    /needs-evidence/i,
  ]) {
    assert.match(template, phrase)
  }
})

test('the concise READMEs point at the canonical contract and do not overclaim', () => {
  const en = flat('README.md')
  const zh = flat('README_zh.md')
  assert.match(en, /review-contract\.md/)
  assert.match(en, /evaluation\.md/)
  assert.match(en, /three completed review\/response cycles/i)
  assert.match(en, /synthetic/i)
  assert.match(zh, /review-contract\.md/)
  assert.match(zh, /evaluation\.md/)
  assert.match(zh, /三轮 review\/response/)
  assert.match(zh, /合成/)
  assert.match(en, /not as host permissions/i)
  assert.match(zh, /不是 Host 的权限机制/)
  assert.match(en, /no model score is claimed without actually running/i)
  assert.match(zh, /未真正跑过.*就不声称.*模型得分/s)
})

test('working plans are session/temp by default and are not committed as checkpoints', () => {
  const template = flat('skill/assets/plan-template.md')
  const loop = flat('skill/references/loop.md')
  const planner = flat('skill/references/planner.md')
  const skill = flat('skill/SKILL.md')
  const en = flat('README.md')
  const zh = flat('README_zh.md')

  assert.match(template, /Storage\/retention:/i)
  assert.match(template, /not committed by default/i)
  assert.match(template, /Each passing CP commits code\/tests/i)
  assert.match(loop, /Storage, retention, and commits/i)
  assert.match(loop, /not committed by default/i)
  assert.match(loop, /\.gitignore/)
  assert.match(planner, /not committed by default/i)
  assert.match(planner, /user-approved/i)
  assert.match(skill, /not committed by default/i)
  assert.match(en, /Working plans are not commits/i)
  assert.match(zh, /工作用计划不进默认提交/)

  // The old "commit the plan first / code and plan update" rules must be gone.
  assert.doesNotMatch(planner, /Commit it first/i)
  assert.doesNotMatch(loop, /commits \(code \+ plan update\)/i)
  assert.doesNotMatch(planner, /plan-doc status update in the same commit/i)
})

test('role personas carry the review contract and retain frozen legacy identities', () => {
  const { harry, severus, alastor, voldemort } = DEFAULT_ROLES

  assert.match(harry.persona, /red-before-fix/i)
  assert.match(harry.persona, /never report unresolved verification as passed/i)
  assert.match(severus.persona, /candidate\/confirmed\/refuted\/needs-evidence/)
  assert.match(severus.persona, /convergence cap/i)
  assert.match(severus.persona, /no builds, no test runs, no compiles/i)
  assert.match(alastor.persona, /required scoped lens/i)
  assert.match(voldemort.persona, /ONE specific problem/i)
  assert.match(voldemort.persona, /never reset either/i)

  for (const [role, expected] of Object.entries({ harry, severus, alastor, voldemort })) {
    assert.ok(Array.isArray(expected.legacyPersonas), `${role} has frozen legacy personas`)
    assert.equal(expected.legacyPersonas.length, 1)
    assert.notEqual(expected.persona, expected.legacyPersonas[0], `${role} persona actually updated`)
    assert.ok(expected.legacyPersonas[0].startsWith(`You are ${role[0].toUpperCase()}${role.slice(1)},`))
  }
})
