import type { Explanation, FeatureContribution } from '@/types/api'
import { money } from '@/lib/format'

/**
 * SHAP maths. Read this before changing any label that mentions a SHAP value.
 *
 *  - The model's output is a probability p, but SHAP values live on the *log-odds* scale:
 *        logit(p) = base_value + sum(phi_i)        (exact, additive)
 *  - So a single phi is a change in LOG-ODDS, never "percentage points of probability".
 *  - exp(phi_i) is the multiplicative effect on the ODDS of churn, and these multiply exactly:
 *        odds(p) = exp(base_value) * prod(exp(phi_i)).
 *  - A running total can be converted to a probability with the sigmoid, but only the *totals*
 *    (baseline, after-each-step, final) have a probability meaning, not the individual steps.
 */

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
export const logit = (p: number) => Math.log(p / (1 - p))
export const oddsMultiplier = (phi: number) => Math.exp(phi)

export interface WaterfallStep {
  kind: 'feature' | 'rest'
  key: string
  label: string
  /** Display value of the feature (or a count for the grouped remainder). */
  value: string | number | null
  /** SHAP value in log-odds. Positive pushes towards churn. */
  phi: number
  /** Running log-odds before / after this step. */
  from: number
  to: number
  /** Running probability before / after this step (sigmoid of the running log-odds). */
  fromProb: number
  toProb: number
  /** Number of features folded into a 'rest' step. */
  count?: number
}

export interface Waterfall {
  base: number
  final: number
  baseProb: number
  finalProb: number
  steps: WaterfallStep[]
  /** |base + sum(phi) - final|, should be ~0. Surfaced so a mismatch is visible, not hidden. */
  residual: number
}

/** Largest |phi| first; the long tail of small contributions is folded into one "rest" step. */
export function buildWaterfall(shap: Explanation, probability: number, topN = 8): Waterfall {
  const base = shap.base_value ?? 0
  const sorted = [...shap.values].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  const head = sorted.slice(0, topN)
  const tail = sorted.slice(topN)

  const steps: WaterfallStep[] = []
  let running = base
  const push = (partial: Pick<WaterfallStep, 'kind' | 'key' | 'label' | 'value' | 'phi'> & { count?: number }) => {
    const from = running
    running += partial.phi
    steps.push({ ...partial, from, to: running, fromProb: sigmoid(from), toProb: sigmoid(running) })
  }
  for (const f of head) push({ kind: 'feature', key: f.feature, label: f.label, value: f.value, phi: f.contribution })
  if (tail.length > 0) {
    push({
      kind: 'rest',
      key: 'rest',
      label: `${tail.length} other feature${tail.length === 1 ? '' : 's'}`,
      value: null,
      phi: tail.reduce((s, f) => s + f.contribution, 0),
      count: tail.length,
    })
  }
  const final = logit(probability)
  return { base, final, baseProb: sigmoid(base), finalProb: probability, steps, residual: Math.abs(running - final) }
}

export interface Drivers {
  up: FeatureContribution[]
  down: FeatureContribution[]
}

export function splitDrivers(values: FeatureContribution[]): Drivers {
  const sorted = [...values].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  return { up: sorted.filter((v) => v.contribution > 0), down: sorted.filter((v) => v.contribution < 0) }
}

/** A feature's value with its unit, for display. */
export function featureValue(f: Pick<FeatureContribution, 'feature' | 'value'>): string {
  if (f.value === null) return 'unknown'
  if (f.feature === 'monthly_charges' || f.feature === 'total_charges') return money(Number(f.value))
  return String(f.value)
}

function phrase(f: FeatureContribution): string {
  if (f.feature === 'tenure') return `a tenure of ${f.value} month${Number(f.value) === 1 ? '' : 's'}`
  if (f.feature === 'monthly_charges' || f.feature === 'total_charges') return `${f.label.toLowerCase()} of ${featureValue(f)}`
  return `${f.label.toLowerCase()} (${featureValue(f)})`
}

/** Plain-language summary. Describes what the MODEL does, never claims a cause. */
export function summarise(shap: Explanation, probability: number): string {
  const { up, down } = splitDrivers(shap.values)
  const baseline = sigmoid(shap.base_value ?? 0)
  const rel = probability > baseline ? 'above' : 'below'
  const list = (items: FeatureContribution[]) => items.slice(0, 2).map(phrase).join(' and ')
  const parts = [
    `The model puts this customer's churn probability at ${(probability * 100).toFixed(0)}%, ${rel} its baseline of about ${(baseline * 100).toFixed(0)}%.`,
  ]
  if (up.length > 0) parts.push(`It is pushed up mainly by ${list(up)}.`)
  if (down.length > 0) parts.push(`It is pulled down mainly by ${list(down)}.`)
  return parts.join(' ')
}
