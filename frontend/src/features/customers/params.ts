import type { CustomerQuery, Risk, SortKey } from '@/types/api'

/** The directory's whole state lives in the URL: shareable, bookmarkable, and Back works. */

export type View = 'cards' | 'table'
export type Outcome = 'active' | 'churned'

export const PAGE_SIZE: Record<View, number> = { cards: 24, table: 20 }

export interface DirectoryState {
  q: string
  risk?: Risk
  contract?: string
  internet?: string
  outcome?: Outcome
  tenureMin?: number
  tenureMax?: number
  sort: SortKey
  view: View
  page: number
}

export const TENURE_BANDS = [
  { value: 'all', label: 'Any tenure', min: undefined, max: undefined },
  { value: '0-12', label: 'First year (0–12 mo)', min: 0, max: 12 },
  { value: '13-24', label: 'Second year (13–24 mo)', min: 13, max: 24 },
  { value: '25-48', label: '2–4 years (25–48 mo)', min: 25, max: 48 },
  { value: '49+', label: '4+ years (49+ mo)', min: 49, max: undefined },
] as const

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'id', label: 'Customer ID' },
  { value: 'risk_desc', label: 'Highest risk first' },
  { value: 'risk_asc', label: 'Lowest risk first' },
  { value: 'tenure_desc', label: 'Longest tenure' },
  { value: 'tenure_asc', label: 'Shortest tenure' },
  { value: 'charges_desc', label: 'Highest monthly charges' },
]

const RISKS: Risk[] = ['low', 'medium', 'high']
const SORT_KEYS = SORTS.map((s) => s.value)
const int = (v: string | null) => (v !== null && /^\d+$/.test(v) ? Number(v) : undefined)

export function parseParams(sp: URLSearchParams): DirectoryState {
  const risk = sp.get('risk') as Risk | null
  const sort = sp.get('sort') as SortKey | null
  const outcome = sp.get('outcome')
  return {
    q: sp.get('q') ?? '',
    risk: risk && RISKS.includes(risk) ? risk : undefined,
    contract: sp.get('contract') || undefined,
    internet: sp.get('internet_service') || undefined,
    outcome: outcome === 'active' || outcome === 'churned' ? outcome : undefined,
    tenureMin: int(sp.get('tenure_min')),
    tenureMax: int(sp.get('tenure_max')),
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'id',
    view: sp.get('view') === 'table' ? 'table' : 'cards',
    page: Math.max(1, int(sp.get('page')) ?? 1),
  }
}

export function toQuery(s: DirectoryState): CustomerQuery {
  const size = PAGE_SIZE[s.view]
  return {
    limit: size,
    offset: (s.page - 1) * size,
    search: s.q.trim() || undefined,
    risk: s.risk,
    contract: s.contract,
    internet_service: s.internet,
    churn: s.outcome === undefined ? undefined : s.outcome === 'churned',
    tenure_min: s.tenureMin,
    tenure_max: s.tenureMax,
    sort: s.sort,
  }
}

/** Which tenure band matches the current min/max, or 'custom' for a range that came from a link. */
export function tenureValue(s: DirectoryState): string {
  if (s.tenureMin === undefined && s.tenureMax === undefined) return 'all'
  const hit = TENURE_BANDS.find((b) => b.min === s.tenureMin && b.max === s.tenureMax)
  return hit?.value ?? 'custom'
}

type Changes = Partial<{
  q: string
  risk: Risk | undefined
  contract: string | undefined
  internet: string | undefined
  outcome: Outcome | undefined
  tenure: string
  sort: SortKey
  view: View
  page: number
}>

/** Returns new search params with `changes` applied. Any filter change resets to page 1. */
export function withChanges(sp: URLSearchParams, changes: Changes): URLSearchParams {
  const next = new URLSearchParams(sp)
  const set = (key: string, value: string | undefined) => (value ? next.set(key, value) : next.delete(key))
  if ('q' in changes) set('q', changes.q?.trim())
  if ('risk' in changes) set('risk', changes.risk)
  if ('contract' in changes) set('contract', changes.contract)
  if ('internet' in changes) set('internet_service', changes.internet)
  if ('outcome' in changes) set('outcome', changes.outcome)
  if ('tenure' in changes) {
    const band = TENURE_BANDS.find((b) => b.value === changes.tenure)
    set('tenure_min', band?.min !== undefined ? String(band.min) : undefined)
    set('tenure_max', band?.max !== undefined ? String(band.max) : undefined)
  }
  if ('sort' in changes) set('sort', changes.sort === 'id' ? undefined : changes.sort)
  if ('view' in changes) set('view', changes.view === 'table' ? 'table' : undefined)
  if ('page' in changes) set('page', changes.page && changes.page > 1 ? String(changes.page) : undefined)
  else if (Object.keys(changes).some((k) => k !== 'view')) next.delete('page')
  return next
}

export const hasFilters = (s: DirectoryState) =>
  Boolean(s.q.trim() || s.risk || s.contract || s.internet || s.outcome || s.tenureMin !== undefined || s.tenureMax !== undefined)
