import { useQueries } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import type { Customer, CustomerQuery, Risk } from '@/types/api'

export interface Member {
  id: number | null
  seed: string
  username: string
  probability: number | null
  risk: Risk | null
}

/**
 * Shown only when the API can't be reached. These are NOT real customers or real scores:
 * the constellation labels them "Illustrative sample" and hides model numbers.
 */
export const SAMPLE: Member[] = ['alder', 'birch', 'cedar', 'dune', 'ember', 'fjord', 'grove', 'harbor', 'isle'].map((s) => ({
  id: null,
  seed: `sample-${s}`,
  username: `sample_${s}`,
  probability: null,
  risk: null,
}))

const toMember = (c: Customer): Member => ({ id: c.id, seed: c.avatar_seed, username: c.username, probability: c.churn_probability, risk: c.risk })

// Deterministic picks per band (not the extremes), so the visual shows a realistic mix
const PICKS: { query: CustomerQuery; band: Risk }[] = [
  { band: 'high', query: { risk: 'high', sort: 'risk_desc', limit: 4, offset: 420 } },
  { band: 'medium', query: { risk: 'medium', sort: 'risk_desc', limit: 3, offset: 310 } },
  { band: 'low', query: { risk: 'low', sort: 'risk_asc', limit: 3, offset: 900 } },
]

/** Real customers with real model scores for the hero visual, or the clearly-labelled sample if unavailable. */
export function useLandingMembers(): { members: Member[]; live: boolean; loading: boolean } {
  const results = useQueries({
    queries: PICKS.map((p) => ({
      queryKey: ['landing', p.band],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.customers(p.query, signal),
      staleTime: 300_000,
      retry: false,
    })),
  })
  const loading = results.some((r) => r.isPending)
  const ok = results.every((r) => r.data && r.data.items.length > 0)
  if (!ok) return { members: SAMPLE, live: false, loading }

  const [high, medium, low] = results.map((r) => r.data!.items.map(toMember))
  // interleave bands so neighbouring avatars on a ring differ in colour
  const order: Member[] = []
  for (let i = 0; i < 4; i++) {
    if (high[i]) order.push(high[i])
    if (medium[i]) order.push(medium[i])
    if (low[i]) order.push(low[i])
  }
  return { members: order.slice(0, 9), live: true, loading }
}
