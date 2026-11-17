import { describe, expect, it } from 'vitest'
import { buildWaterfall, featureValue, logit, oddsMultiplier, sigmoid, splitDrivers, summarise } from '@/lib/shap'
import type { Explanation, FeatureContribution } from '@/types/api'

const f = (feature: string, label: string, value: string | number, contribution: number): FeatureContribution => ({ feature, label, value, contribution })

/** A self-consistent explanation: base + sum(phi) = logit(p), exactly like the backend produces. */
function makeExplanation() {
  const values = [
    f('contract', 'Contract', 'Month-to-month', 0.61),
    f('tenure', 'Tenure (months)', 2, 0.54),
    f('internet_service', 'Internet service', 'Fiber optic', 0.22),
    f('online_security', 'Online security', 'No', 0.21),
    f('payment_method', 'Payment method', 'Electronic check', 0.16),
    f('multiple_lines', 'Multiple lines', 'No', -0.16),
    f('monthly_charges', 'Monthly charges', 70.7, -0.11),
    f('streaming_tv', 'Streaming TV', 'No', -0.05),
    f('streaming_movies', 'Streaming movies', 'No', -0.03),
    f('senior_citizen', 'Senior citizen', 'No', -0.02),
    f('gender', 'Gender', 'Male', 0.01),
  ]
  const base = -1.03
  const shap: Explanation = { method: 'shap', base_value: base, values }
  const probability = sigmoid(base + values.reduce((s, v) => s + v.contribution, 0))
  return { shap, probability, base }
}

describe('log-odds maths', () => {
  it('sigmoid and logit are inverses', () => {
    for (const p of [0.01, 0.2, 0.5, 0.673, 0.99]) expect(sigmoid(logit(p))).toBeCloseTo(p, 12)
  })

  it('odds multipliers multiply exactly from baseline odds to the prediction odds', () => {
    const { shap, probability, base } = makeExplanation()
    const odds = Math.exp(base) * shap.values.reduce((acc, v) => acc * oddsMultiplier(v.contribution), 1)
    expect(odds / (1 + odds)).toBeCloseTo(probability, 12)
  })

  it('a contribution of zero leaves the odds unchanged', () => {
    expect(oddsMultiplier(0)).toBe(1)
  })
})

describe('buildWaterfall', () => {
  it('ends exactly at the prediction (additivity) with no residual', () => {
    const { shap, probability } = makeExplanation()
    const wf = buildWaterfall(shap, probability, 8)
    expect(wf.residual).toBeLessThan(1e-9)
    expect(wf.steps.at(-1)!.to).toBeCloseTo(logit(probability), 9)
    expect(wf.finalProb).toBe(probability)
  })

  it('shows the top N features largest-first and folds the rest into one step that conserves the total', () => {
    const { shap, probability } = makeExplanation()
    const wf = buildWaterfall(shap, probability, 5)
    expect(wf.steps).toHaveLength(6)
    const named = wf.steps.slice(0, 5).map((s) => s.phi)
    expect(named.map(Math.abs)).toEqual([...named.map(Math.abs)].sort((a, b) => b - a))
    const rest = wf.steps[5]
    expect(rest.kind).toBe('rest')
    expect(rest.count).toBe(6)
    const restExpected = shap.values.slice().sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(5).reduce((s, v) => s + v.contribution, 0)
    expect(rest.phi).toBeCloseTo(restExpected, 12)
  })

  it('each step starts where the previous one ended', () => {
    const { shap, probability } = makeExplanation()
    const wf = buildWaterfall(shap, probability, 8)
    expect(wf.steps[0].from).toBe(wf.base)
    wf.steps.slice(1).forEach((s, i) => expect(s.from).toBeCloseTo(wf.steps[i].to, 12))
  })

  it('running probabilities are the sigmoid of the running log-odds', () => {
    const { shap, probability } = makeExplanation()
    for (const s of buildWaterfall(shap, probability, 8).steps) {
      expect(s.fromProb).toBeCloseTo(sigmoid(s.from), 12)
      expect(s.toProb).toBeCloseTo(sigmoid(s.to), 12)
    }
  })

  it('surfaces a mismatch instead of hiding it', () => {
    const { shap } = makeExplanation()
    const wf = buildWaterfall(shap, 0.9, 8) // a probability the contributions do not add up to
    expect(wf.residual).toBeGreaterThan(0.1)
  })

  it('does not create a rest step when every feature is shown', () => {
    const { shap, probability } = makeExplanation()
    expect(buildWaterfall(shap, probability, 50).steps.every((s) => s.kind === 'feature')).toBe(true)
  })
})

describe('splitDrivers', () => {
  it('partitions by sign and drops exact zeros', () => {
    const { up, down } = splitDrivers([f('a', 'A', 1, 0.3), f('b', 'B', 1, -0.5), f('c', 'C', 1, 0), f('d', 'D', 1, 0.9)])
    expect(up.map((v) => v.feature)).toEqual(['d', 'a'])
    expect(down.map((v) => v.feature)).toEqual(['b'])
  })
})

describe('featureValue and summarise', () => {
  it('formats money and passes other values through', () => {
    expect(featureValue({ feature: 'monthly_charges', value: 70.7 })).toBe('$70.70')
    expect(featureValue({ feature: 'contract', value: 'Two year' })).toBe('Two year')
    expect(featureValue({ feature: 'contract', value: null })).toBe('unknown')
  })

  it('writes a plain-language summary that describes the model, not causes', () => {
    const { shap, probability } = makeExplanation()
    const text = summarise(shap, probability)
    expect(text).toContain(`${Math.round(probability * 100)}%`)
    expect(text).toContain('contract (Month-to-month)')
    expect(text).toContain('a tenure of 2 months')
    expect(text).toContain('monthly charges of $70.70')
    expect(text).not.toMatch(/percentage points|because|caus/i)
  })
})
