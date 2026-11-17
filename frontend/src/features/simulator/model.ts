import type { Customer, PredictionInput } from '@/types/api'

export const LABELS: Record<keyof PredictionInput, string> = {
  gender: 'Gender',
  senior_citizen: 'Senior citizen',
  partner: 'Partner',
  dependents: 'Dependents',
  tenure: 'Tenure',
  phone_service: 'Phone service',
  multiple_lines: 'Multiple lines',
  internet_service: 'Internet service',
  online_security: 'Online security',
  online_backup: 'Online backup',
  device_protection: 'Device protection',
  tech_support: 'Tech support',
  streaming_tv: 'Streaming TV',
  streaming_movies: 'Streaming movies',
  contract: 'Contract',
  paperless_billing: 'Paperless billing',
  payment_method: 'Payment method',
  monthly_charges: 'Monthly charges',
  total_charges: 'Total charges',
}

export const ADDONS = ['online_security', 'online_backup', 'device_protection', 'tech_support', 'streaming_tv', 'streaming_movies'] as const
export type Addon = (typeof ADDONS)[number]

/** Illustrative starting point when no customer is chosen. Not a real customer. */
export const DEFAULT_INPUT: PredictionInput = {
  gender: 'Female',
  senior_citizen: false,
  partner: false,
  dependents: false,
  tenure: 12,
  phone_service: true,
  multiple_lines: 'No',
  internet_service: 'Fiber optic',
  online_security: 'No',
  online_backup: 'No',
  device_protection: 'No',
  tech_support: 'No',
  streaming_tv: 'No',
  streaming_movies: 'No',
  contract: 'Month-to-month',
  paperless_billing: true,
  payment_method: 'Electronic check',
  monthly_charges: 80,
  total_charges: 960,
}

export function customerToInput(c: Customer): PredictionInput {
  return {
    gender: c.gender as PredictionInput['gender'],
    senior_citizen: c.senior_citizen,
    partner: c.partner,
    dependents: c.dependents,
    tenure: c.tenure,
    phone_service: c.phone_service,
    multiple_lines: c.multiple_lines as PredictionInput['multiple_lines'],
    internet_service: c.internet_service as PredictionInput['internet_service'],
    online_security: c.online_security as PredictionInput['online_security'],
    online_backup: c.online_backup as PredictionInput['online_backup'],
    device_protection: c.device_protection as PredictionInput['device_protection'],
    tech_support: c.tech_support as PredictionInput['tech_support'],
    streaming_tv: c.streaming_tv as PredictionInput['streaming_tv'],
    streaming_movies: c.streaming_movies as PredictionInput['streaming_movies'],
    contract: c.contract as PredictionInput['contract'],
    paperless_billing: c.paperless_billing,
    payment_method: c.payment_method as PredictionInput['payment_method'],
    monthly_charges: c.monthly_charges,
    total_charges: c.total_charges,
  }
}

/**
 * Applies one edit and keeps the profile internally consistent, the way the training data is:
 *  - no internet service  => every add-on is "No internet service" (and back to "No" when internet returns)
 *  - no phone service     => "multiple lines" is "No phone service"
 *  - tenure / monthly changes move total charges by the same amount (price history is preserved)
 */
export function applyChange<K extends keyof PredictionInput>(
  current: PredictionInput,
  original: PredictionInput,
  key: K,
  value: PredictionInput[K],
): PredictionInput {
  const next: PredictionInput = { ...current, [key]: value }

  if (key === 'internet_service') {
    const none = value === 'No'
    for (const a of ADDONS) {
      if (none) next[a] = 'No internet service'
      else if (current[a] === 'No internet service') next[a] = 'No'
    }
  }
  if (key === 'phone_service') {
    if (!value) next.multiple_lines = 'No phone service'
    else if (current.multiple_lines === 'No phone service') next.multiple_lines = 'No'
  }
  if (key === 'tenure' || key === 'monthly_charges') {
    const delta = next.monthly_charges * next.tenure - original.monthly_charges * original.tenure
    next.total_charges = Math.max(0, Math.round((original.total_charges + delta) * 100) / 100)
  }
  return next
}

export interface Change {
  key: keyof PredictionInput
  label: string
  from: string
  to: string
}

const show = (key: keyof PredictionInput, v: PredictionInput[keyof PredictionInput]): string => {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (key === 'monthly_charges' || key === 'total_charges') return `$${Number(v).toFixed(2)}`
  if (key === 'tenure') return `${v} mo`
  return String(v)
}

/** Fields that differ between two profiles, for the "what changed" list. */
export function diffInputs(a: PredictionInput, b: PredictionInput): Change[] {
  return (Object.keys(LABELS) as (keyof PredictionInput)[])
    .filter((k) => a[k] !== b[k])
    .map((k) => ({ key: k, label: LABELS[k], from: show(k, a[k]), to: show(k, b[k]) }))
}

/** Parses `set=key:value` URL params (from the profile's "Preview in simulator" links) onto a profile. Unknown keys are ignored. */
export function applySetParams(base: PredictionInput, sets: string[]): PredictionInput {
  let next = base
  for (const s of sets) {
    const i = s.indexOf(':')
    if (i < 1) continue
    const key = s.slice(0, i) as keyof PredictionInput
    const raw = s.slice(i + 1)
    if (!(key in LABELS)) continue
    const current = base[key]
    const value = typeof current === 'number' ? Number(raw) : typeof current === 'boolean' ? raw === 'true' || raw === 'Yes' : raw
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    next = applyChange(next, base, key, value as PredictionInput[typeof key])
  }
  return next
}
