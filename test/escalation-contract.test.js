import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function text(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\s+/g, ' ')
}

// Declaration checks only: these do not run agents, enforce permissions or prove convergence.
test('current escalation declarations replace takeover and fixed collaboration cutoffs', () => {
  for (const path of [
    'skill/SKILL.md', 'skill/references/implementer.md', 'skill/references/planner.md',
    'skill/references/loop.md', 'skill/references/example.md',
    'skill/references/review-contract.md', 'README.md',
  ]) {
    const declaration = text(path)
    assert.match(declaration, /read-only/i, path)
    assert.match(declaration, /advisor/i, path)
    assert.match(declaration, /bounded/i, path)
    assert.match(declaration, /no fixed.*(?:round|attempt)/i, path)
    assert.doesNotMatch(declaration, /at most two attempts|do not dispatch a fourth Harry|same-root attempt limits.*remain absolute/i, path)
  }
  const skill = text('skill/SKILL.md')
  assert.match(skill, /red gate can end a failed attempt/i)
  assert.match(skill, /P1 \*\*or P2\*\*/)
  assert.match(skill, /changing diagnostic hypotheses does not reset attempts/i)
  assert.match(skill, /not runtime ACLs or automatic attempt counters/)
  const budget = text('skill/references/review-contract.md')
  assert.match(budget, /diagnosis does not require code changes/)
  assert.match(budget, /diagnosis or implementation.*may exceed ordinary cumulative repair\/evidence totals/)
  assert.match(budget, /new or revised hypothesis or diagnostic question/)
  assert.match(budget, /Unescalated work and unrelated problems still obey ordinary budgets/)
  assert.match(budget, /validate the evidence before authorizing repair/)
  const chinese = text('README_zh.md')
  assert.match(chinese, /只读的单问题升级顾问/)
  assert.match(chinese, /没有固定协作轮数或总尝试上限/)
  const client = text('client.js')
  assert.match(client, /Escalation advisor \(one problem, read-only\)/)
  assert.match(client, /升级顾问（单个难题，只读指导）/)
})

test('E5 declares decisions for continued guidance, success, unrelated roots and probe churn', () => {
  const inputs = text('skill/assets/eval-inputs.md')
  const expectations = text('skill/assets/eval-expectations.md')
  for (const label of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']) {
    assert.ok(inputs.includes(`**${label}:**`), `input ${label}`)
    assert.ok(expectations.includes(`**${label}:**`), `expectation ${label}`)
  }
  assert.match(expectations, /guided rounds=3.*bounded guided round 4; the same Harry implements\/tests/)
  assert.match(expectations, /attempt three succeeded.*No escalation/)
  assert.match(expectations, /unrelated roots do not sum to three/)
  assert.match(expectations, /Red gates can end attempts before review; P2 acceptance failures qualify/)
  assert.match(expectations, /precise root need not already be proven/)
  assert.match(expectations, /bounded diagnostic-only round.*evidence=2/)
  assert.match(expectations, /after three more guided diagnostic rounds.*evidence=5.*next bounded diagnosis/)
  assert.match(expectations, /without requiring code changes or human budget-extension approval/)
  assert.match(expectations, /independent failures=2, not seven/)
})

test('problem-scoped advisor lifecycle declarations separate closure from checkpoint approval', () => {
  const contract = text('skill/references/review-contract.md')
  assert.match(contract, /problem ID or stable failure\/acceptance identifier/)
  assert.match(contract, /problem closed.*not checkpoint APPROVE/)
  assert.match(contract, /Immediately stop dispatching Voldemort/)
  assert.match(contract, /required target gates.*affected paths.*unrelated/)
  assert.match(contract, /red or attribution is unclear.*do not close/)
  assert.match(contract, /each different problem needs its own three independent failures/)
  const expectations = text('skill/assets/eval-expectations.md')
  assert.match(expectations, /\*\*I:\*\*.*Harry continues independently.*No checkpoint APPROVE/)
  assert.match(expectations, /\*\*J:\*\*.*failures=0 or 1.*same Voldemort child.*new brief/)
  assert.match(expectations, /\*\*K:\*\*.*do not close.*unrelated/)
})
