import type { Customer, FeatureContribution } from '@/types/api'

/**
 * Rule-based retention SUGGESTIONS derived from a customer's strongest upward drivers.
 * They are business rules attached to model drivers. Nothing here has been shown to reduce churn.
 */
export interface Suggestion {
  id: string
  title: string
  /** Why this suggestion is shown, in terms of the model's driver. */
  because: string
  /** What an account manager could try. */
  action: string
  /** Attribute changes the simulator can apply to preview the model's reaction (hypothetical). */
  simulate?: Record<string, string | number>
  driver: FeatureContribution
}

type Rule = (c: Customer, f: FeatureContribution) => Omit<Suggestion, 'id' | 'driver' | 'because'> | null

const RULES: Record<string, Rule> = {
  contract: (c) =>
    c.contract === 'Month-to-month'
      ? { title: 'Offer a longer-term plan', action: 'Propose a one-year plan, for example with a loyalty incentive.', simulate: { contract: 'One year' } }
      : null,
  payment_method: (c) =>
    c.payment_method === 'Electronic check'
      ? { title: 'Encourage automatic payment', action: 'Invite the customer to switch to automatic bank transfer or card payments.', simulate: { payment_method: 'Bank transfer (automatic)' } }
      : null,
  tech_support: (c) =>
    c.tech_support === 'No' && c.internet_service !== 'No'
      ? { title: 'Offer a tech-support trial', action: 'Offer a time-limited tech-support add-on.', simulate: { tech_support: 'Yes' } }
      : null,
  online_security: (c) =>
    c.online_security === 'No' && c.internet_service !== 'No'
      ? { title: 'Offer online security', action: 'Offer a time-limited online-security add-on.', simulate: { online_security: 'Yes' } }
      : null,
  monthly_charges: (c) =>
    c.monthly_charges >= 80
      ? { title: 'Review price against value', action: 'Check that the plan matches actual usage; consider a plan review or a bundle.', simulate: { monthly_charges: Math.round(c.monthly_charges * 0.85 * 100) / 100 } }
      : null,
  tenure: (c) =>
    c.tenure <= 12
      ? { title: 'Check in during the first year', action: 'Reach out early to catch dissatisfaction while the relationship is new.' }
      : null,
  internet_service: (c) =>
    c.internet_service === 'Fiber optic'
      ? { title: 'Check the fiber plan fits', action: 'Confirm the fiber plan matches how the customer actually uses the service.' }
      : null,
}

/** Up to `limit` suggestions, ordered by how strongly the underlying driver pushes churn up. */
export function suggest(customer: Customer, values: FeatureContribution[], limit = 3): Suggestion[] {
  const out: Suggestion[] = []
  const upward = [...values].filter((v) => v.contribution > 0).sort((a, b) => b.contribution - a.contribution)
  for (const driver of upward) {
    const rule = RULES[driver.feature]?.(customer, driver)
    if (!rule) continue
    out.push({ ...rule, id: driver.feature, driver, because: `${driver.label} (${String(driver.value)}) is among the factors pushing this customer’s predicted risk up.` })
    if (out.length === limit) break
  }
  return out
}

/** Encodes a suggestion's attribute changes for the simulator link. */
export function simulatorHref(customerId: number, simulate: Record<string, string | number>): string {
  const p = new URLSearchParams({ customer: String(customerId) })
  for (const [k, v] of Object.entries(simulate)) p.append('set', `${k}:${v}`)
  return `/simulator?${p.toString()}`
}
