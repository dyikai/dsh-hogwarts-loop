import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function text(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\s+/g, ' ')
}

const entries = [
  'skill/SKILL.md', 'skill/references/planner.md', 'skill/references/implementer.md',
  'skill/references/reviewer.md', 'skill/references/loop.md',
  'skill/references/example.md', 'skill/references/review-contract.md',
  'skill/assets/plan-template.md', 'README.md', 'README_zh.md',
]

// Content-contract checks only: no agent execution or proof of LLM compliance.
test('every checkpoint declares mandatory ablation without size-trigger exemptions', () => {
  const policy = text('skill/references/ablation.md')
  assert.match(policy, /every checkpoint, regardless of size or complexity/i)
  assert.match(policy, /at least one.*actual deletion or simpler substitution/i)
  assert.match(policy, /before checkpoint approval review/i)
  assert.doesNotMatch(policy, /threshold|trigger|production lines|high-cost/i)
  for (const path of ['skill/references/ablation.md', ...entries]) {
    const declaration = text(path)
    assert.match(declaration, /mandatory ablation|强制消融/i, path)
    assert.doesNotMatch(declaration, /conditional (?:ablation|complexity)|subthreshold|not[ -]triggered|when triggered|if triggered|trigger (?:decision|ruling)|300 or more|8 or more|2 or more|high-cost flags|project-specific thresholds/i, path)
  }
})

test('mandatory ablation preserves controlled experiments, acceptance and independent audit', () => {
  const policy = text('skill/references/ablation.md')
  for (const claim of [
    /freeze a green candidate/i,
    /1–3 deletion hypotheses/i,
    /one unit at a time/i,
    /same frozen candidate/i,
    /variant patch and stamp/i,
    /raw command output/i,
    /unchanged acceptance/i,
    /do not delete, skip or weaken acceptance/i,
    /private-shape test failure is not by itself/i,
    /keep\/revert\/unresolved/i,
    /final full gate.*exact surviving tree/i,
    /Albus checks readiness.*Severus audits/i,
    /He does not rerun experiments/i,
  ]) assert.match(policy, claim)
})

test('ablation declarations cover tiny, non-code, repair and evidence-reuse scenarios', () => {
  const policy = text('skill/references/ablation.md')
  // Each scenario checks the policy's stated decision, not an agent's actual decision.
  const scenarios = [
    ['tiny edit', /complexity affects.*experiment scale, not eligibility/i],
    ['non-code or deletion-only checkpoint', /documentation.*tests.*configuration.*deletion-only.*not exempt/i],
    ['appropriate non-runtime experiment', /current changed artifacts.*content, behavior or scenario acceptance/i],
    ['documentation simplification', /repeated instructions.*canonical rule/i],
    ['test simplification', /redundant setup.*coverage/i],
    ['configuration simplification', /unnecessary override.*effective settings/i],
    ['deletion-only simplification', /remaining affected caller.*compatibility/i],
    ['candidate changed by repair', /repair changes the candidate.*new or affected hypotheses.*final combination/i],
    ['unchanged tree, evidence-only handoff', /same unchanged tree and acceptance.*reuse.*completed.*evidence reuse, not.*exemption/i],
    ['accepted survivor', /accepted survivor.*not.*recursively ablate/i],
    ['rejected deletion', /rejected deletion can be a completed experiment/i],
    ['no meaningful executable experiment or blocked environment', /no meaningful executable experiment.*explicit human waiver or stop/i],
  ]
  for (const [scenario, claim] of scenarios) assert.match(policy, claim, scenario)
  assert.match(policy, /do not self-declare.*N\/A.*completed/i)
})

test('planning, delivery, repair and review carry mandatory evidence through the same policy', () => {
  for (const path of entries) assert.match(text(path), /ablation\.md/, path)
  const loop = text('skill/references/loop.md')
  for (const [heading, claim] of [
    ['A — orchestrator', /mandatory ablation scope/i],
    ['B — Harry', /mandatory ablation evidence/i],
    ['C — orchestrator', /mandatory ablation evidence/i],
    ['F — Harry', /updated or validly reused ablation evidence/i],
  ]) {
    const section = loop.split(`### ${heading}`)[1]?.split('###')[0]
    assert.match(section, claim, heading)
  }
  const implementer = text('skill/references/implementer.md')
  assert.match(implementer, /delivery report.*mandatory ablation evidence/i)
  assert.match(implementer, /fix round.*update or validly reuse.*ablation evidence/i)
  assert.match(text('skill/references/example.md'), /both the initial delivery and the one-line repair.*mandatory ablation.*does not claim historical experiment results/i)
  assert.match(text('skill/references/review-contract.md'), /Checkpoint approval requires.*mandatory ablation readiness in `ablation\.md`/i)
  const template = text('skill/assets/plan-template.md')
  assert.match(template, /Omit only inapplicable optional sections; mandatory ablation cannot be omitted/i)
  assert.doesNotMatch(template, /predeclared override|experiments when triggered/i)
})
