import { describe, expect, it } from 'vitest'
import { ADDONS, DEFAULT_INPUT, applyChange, applySetParams, diffInputs } from '@/features/simulator/model'

const base = DEFAULT_INPUT

describe('applyChange keeps the profile consistent', () => {
  it('turning internet off sets every add-on to "No internet service", and turning it on resets them to "No"', () => {
    const off = applyChange({ ...base, tech_support: 'Yes' }, base, 'internet_service', 'No')
    for (const a of ADDONS) expect(off[a]).toBe('No internet service')
    const on = applyChange(off, base, 'internet_service', 'DSL')
    for (const a of ADDONS) expect(on[a]).toBe('No')
  })

  it('turning phone off forces "No phone service" and back to "No" afterwards', () => {
    const off = applyChange(base, base, 'phone_service', false)
    expect(off.multiple_lines).toBe('No phone service')
    expect(applyChange(off, base, 'phone_service', true).multiple_lines).toBe('No')
  })

  it('moves total charges with tenure and monthly charges, preserving price history', () => {
    const original = { ...base, tenure: 10, monthly_charges: 50, total_charges: 520 } // 20 above 10 x 50
    const longer = applyChange(original, original, 'tenure', 12)
    expect(longer.total_charges).toBe(620) // 12 x 50 + 20
    const cheaper = applyChange(original, original, 'monthly_charges', 40)
    expect(cheaper.total_charges).toBe(420) // 10 x 40 + 20
  })

  it('never lets total charges go negative', () => {
    const original = { ...base, tenure: 10, monthly_charges: 50, total_charges: 100 }
    expect(applyChange(original, original, 'tenure', 0).total_charges).toBeGreaterThanOrEqual(0)
  })

  it('does not mutate the input profile', () => {
    const copy = { ...base }
    applyChange(base, base, 'contract', 'Two year')
    expect(base).toEqual(copy)
  })
})

describe('diffInputs', () => {
  it('lists only what changed, with readable values', () => {
    const next = applyChange(applyChange(base, base, 'contract', 'One year'), base, 'monthly_charges', 70)
    const d = diffInputs(base, next)
    expect(d.map((c) => c.key).sort()).toEqual(['contract', 'monthly_charges', 'total_charges'].sort())
    expect(d.find((c) => c.key === 'contract')).toMatchObject({ from: 'Month-to-month', to: 'One year' })
    expect(d.find((c) => c.key === 'monthly_charges')).toMatchObject({ from: '$80.00', to: '$70.00' })
  })

  it('is empty for identical profiles', () => {
    expect(diffInputs(base, { ...base })).toEqual([])
  })
})

describe('applySetParams (links from the profile page)', () => {
  it('applies valid changes', () => {
    const next = applySetParams(base, ['contract:One year', 'tech_support:Yes', 'monthly_charges:68'])
    expect(next).toMatchObject({ contract: 'One year', tech_support: 'Yes', monthly_charges: 68 })
  })

  it('ignores unknown keys and malformed values instead of sending them to the API', () => {
    expect(applySetParams(base, ['hacker:yes', 'tenure:abc', 'nocolon', ':empty'])).toEqual(base)
  })
})
