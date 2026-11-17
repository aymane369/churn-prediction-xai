import { describe, expect, it } from 'vitest'
import { deriveInsights, segmentFilter } from '@/features/dashboard/deriveInsights'
import { simulatorHref, suggest } from '@/features/profile/suggestions'
import type { Customer, FeatureContribution, Overview, Segment } from '@/types/api'

const seg = (dimension: Segment['dimension'], value: string, customers: number, high: number, avg = 0.3): Segment => ({
  dimension, value, customers, avg_probability: avg, observed_churn_rate: avg, high_risk_share: high,
})

const overview = (): Overview => ({
  customers: 1000, churned: 265, churn_rate: 0.265, avg_monthly_charges: 64, by_contract: [],
  model_version: 'v', avg_probability: 0.27, high_risk_customers: 200,
  risk_thresholds: { low_max: 0.2, high_min: 0.5, decision_threshold: 0.34 },
  risk_distribution: [], probability_histogram: [],
  segments: [
    seg('contract', 'Month-to-month', 500, 0.36), // 180 of the 200 high-risk customers
    seg('contract', 'One year', 300, 0.05), // 15
    seg('contract', 'Two year', 200, 0.025), // 5
    seg('internet_service', 'Fiber optic', 400, 0.4),
    seg('internet_service', 'No', 150, 0.01),
    seg('tenure', '0-12 months', 300, 0.5),
    seg('tenure', '49+ months', 20, 0.0), // too small (< 5%) to be quoted
  ],
})

describe('segmentFilter', () => {
  it('builds directory filters for each dimension', () => {
    expect(segmentFilter(seg('contract', 'Two year', 1, 0))).toBe('contract=Two+year')
    expect(segmentFilter(seg('internet_service', 'DSL', 1, 0), { risk: 'high' })).toBe('risk=high&internet_service=DSL')
    expect(segmentFilter(seg('tenure', '13-24 months', 1, 0))).toBe('tenure_min=13&tenure_max=24')
    expect(segmentFilter(seg('tenure', '49+ months', 1, 0))).toBe('tenure_min=49')
  })
})

describe('deriveInsights', () => {
  it('computes numbers from the overview and links to the matching customers', () => {
    const [concentration] = deriveInsights(overview())
    expect(concentration.headline).toContain('90%') // 180 / 200
    expect(concentration.href).toContain('contract=Month-to-month')
    expect(concentration.href).toContain('risk=high')
  })

  it('never quotes tiny segments', () => {
    const all = deriveInsights(overview()).map((i) => i.headline + i.detail).join(' ')
    expect(all).not.toContain('49+ months')
  })

  it('returns nothing without model scores', () => {
    expect(deriveInsights({ ...overview(), high_risk_customers: null })).toEqual([])
  })
})

const customer = (over: Partial<Customer> = {}): Customer => ({
  id: 7, username: 'x', avatar_seed: 's', gender: 'Male', senior_citizen: false, partner: false, dependents: false,
  tenure: 3, phone_service: true, multiple_lines: 'No', internet_service: 'Fiber optic', online_security: 'No',
  online_backup: 'No', device_protection: 'No', tech_support: 'No', streaming_tv: 'No', streaming_movies: 'No',
  contract: 'Month-to-month', paperless_billing: true, payment_method: 'Electronic check', monthly_charges: 90,
  total_charges: 270, churn: false, churn_probability: 0.7, risk: 'high', ...over,
})
const d = (feature: string, contribution: number): FeatureContribution => ({ feature, label: feature, value: 'v', contribution })

describe('suggest', () => {
  it('only uses drivers that push risk UP, strongest first, and caps the list', () => {
    const s = suggest(customer(), [d('contract', 0.3), d('payment_method', 0.9), d('tech_support', -0.5), d('online_security', 0.1), d('tenure', 0.05)], 3)
    expect(s.map((x) => x.id)).toEqual(['payment_method', 'contract', 'online_security'])
  })

  it('does not suggest something that is already true for the customer', () => {
    const s = suggest(customer({ contract: 'Two year', payment_method: 'Mailed check', tech_support: 'Yes', online_security: 'Yes', tenure: 40, monthly_charges: 50, internet_service: 'DSL' }), [d('contract', 1), d('payment_method', 1), d('tech_support', 1), d('online_security', 1), d('tenure', 1), d('monthly_charges', 1), d('internet_service', 1)])
    expect(s).toEqual([])
  })

  it('never claims an intervention is proven', () => {
    const text = JSON.stringify(suggest(customer(), [d('contract', 1), d('payment_method', 1), d('tech_support', 1)]))
    expect(text).not.toMatch(/proven|guarantee|will reduce|will prevent/i)
  })

  it('encodes simulator changes in the link', () => {
    const href = simulatorHref(7, { contract: 'One year', tech_support: 'Yes' })
    const url = new URL(href, 'http://x')
    expect(url.pathname).toBe('/simulator')
    expect(url.searchParams.get('customer')).toBe('7')
    expect(url.searchParams.getAll('set')).toEqual(['contract:One year', 'tech_support:Yes'])
  })
})
