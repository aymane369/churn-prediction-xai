import { describe, expect, it } from 'vitest'
import { PAGE_SIZE, hasFilters, parseParams, tenureValue, toQuery, withChanges } from '@/features/customers/params'

const sp = (s: string) => new URLSearchParams(s)

describe('parseParams', () => {
  it('has sensible defaults', () => {
    const s = parseParams(sp(''))
    expect(s).toMatchObject({ q: '', sort: 'id', view: 'cards', page: 1 })
    expect(hasFilters(s)).toBe(false)
  })

  it('ignores invalid values rather than passing them to the API', () => {
    const s = parseParams(sp('risk=extreme&sort=random&outcome=maybe&page=-3&tenure_min=abc&view=grid'))
    expect(s).toMatchObject({ risk: undefined, sort: 'id', outcome: undefined, page: 1, tenureMin: undefined, view: 'cards' })
  })

  it('reads every supported filter', () => {
    const s = parseParams(sp('q=otter&risk=high&contract=Two%20year&internet_service=DSL&outcome=churned&tenure_min=13&tenure_max=24&sort=risk_desc&view=table&page=3'))
    expect(s).toMatchObject({ q: 'otter', risk: 'high', contract: 'Two year', internet: 'DSL', outcome: 'churned', tenureMin: 13, tenureMax: 24, sort: 'risk_desc', view: 'table', page: 3 })
    expect(hasFilters(s)).toBe(true)
  })
})

describe('toQuery', () => {
  it('maps UI state to the API query, with paging by view', () => {
    const q = toQuery(parseParams(sp('risk=high&outcome=churned&view=table&page=3&q=%20otter%20')))
    expect(q).toMatchObject({ risk: 'high', churn: true, limit: PAGE_SIZE.table, offset: 2 * PAGE_SIZE.table, search: 'otter' })
    expect(toQuery(parseParams(sp('outcome=active'))).churn).toBe(false)
    expect(toQuery(parseParams(sp(''))).churn).toBeUndefined()
  })
})

describe('withChanges', () => {
  it('resets to page 1 when a filter changes', () => {
    expect(withChanges(sp('page=4&risk=low'), { risk: 'high' }).toString()).toBe('risk=high')
  })

  it('keeps the page when only the page or the view changes', () => {
    expect(withChanges(sp('page=4'), { page: 5 }).get('page')).toBe('5')
    expect(withChanges(sp('page=4'), { view: 'table' }).get('page')).toBe('4')
  })

  it('removes a filter when it is cleared', () => {
    expect(withChanges(sp('risk=high&contract=One%20year'), { risk: undefined }).toString()).toBe('contract=One+year')
  })

  it('translates a tenure band to min/max and back', () => {
    const next = withChanges(sp(''), { tenure: '13-24' })
    expect(next.get('tenure_min')).toBe('13')
    expect(next.get('tenure_max')).toBe('24')
    expect(tenureValue(parseParams(next))).toBe('13-24')
    expect(tenureValue(parseParams(withChanges(next, { tenure: 'all' })))).toBe('all')
    expect(tenureValue(parseParams(sp('tenure_min=49')))).toBe('49+')
    expect(tenureValue(parseParams(sp('tenure_min=3&tenure_max=9')))).toBe('custom')
  })
})
