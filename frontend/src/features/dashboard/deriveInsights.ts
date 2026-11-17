import type { Overview, Segment } from '@/types/api'
import { pct, int } from '@/lib/format'

export const DIMENSION_LABEL: Record<Segment['dimension'], string> = {
  contract: 'Contract',
  internet_service: 'Internet',
  tenure: 'Tenure',
}

/** Query string for the customer directory that reproduces a segment. */
export function segmentFilter(seg: Pick<Segment, 'dimension' | 'value'>, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra)
  if (seg.dimension === 'contract') p.set('contract', seg.value)
  else if (seg.dimension === 'internet_service') p.set('internet_service', seg.value)
  else {
    // "0-12 months", "13-24 months", "49+ months"
    const m = /^(\d+)(?:-(\d+)|\+)/.exec(seg.value)
    if (m) {
      p.set('tenure_min', m[1])
      if (m[2]) p.set('tenure_max', m[2])
    }
  }
  return p.toString()
}

export const segmentName = (s: Segment) =>
  s.dimension === 'internet_service' ? (s.value === 'No' ? 'No internet' : `${s.value} internet`) : s.value

export interface Insight {
  id: string
  headline: string
  detail: string
  /** Directory query string that shows exactly the customers the insight talks about. */
  href: string
}

/**
 * Observations computed from the real overview numbers. They describe where predicted risk is
 * concentrated; they are not claims about what would reduce churn.
 */
export function deriveInsights(o: Overview): Insight[] {
  if (o.high_risk_customers === null || o.segments.length === 0) return []
  const totalHigh = o.high_risk_customers
  const overallShare = totalHigh / o.customers
  const insights: Insight[] = []

  // 1. The segment that holds the largest share of all high-risk customers (contract partitions the base)
  const contracts = o.segments.filter((s) => s.dimension === 'contract')
  const biggest = [...contracts].sort((a, b) => b.high_risk_share * b.customers - a.high_risk_share * a.customers)[0]
  if (biggest) {
    const n = Math.round(biggest.high_risk_share * biggest.customers)
    insights.push({
      id: 'concentration',
      headline: `${pct(n / totalHigh)} of high-risk customers are on ${biggest.value.toLowerCase()} contracts`,
      detail: `${int(n)} of the ${int(totalHigh)} customers the model rates high risk. ${pct(biggest.high_risk_share)} of that contract group is high risk, against ${pct(overallShare)} across the whole base.`,
      href: segmentFilter(biggest, { risk: 'high', sort: 'risk_desc' }),
    })
  }

  // 2. The riskiest pocket among reasonably large segments (>= 5% of customers), any dimension
  const big = o.segments.filter((s) => s.customers >= o.customers * 0.05)
  const riskiest = [...big].sort((a, b) => b.high_risk_share - a.high_risk_share)[0]
  if (riskiest && riskiest.value !== biggest?.value) {
    insights.push({
      id: 'riskiest',
      headline: `${segmentName(riskiest)}: ${pct(riskiest.high_risk_share)} are high risk`,
      detail: `The highest share among segments with at least ${pct(0.05)} of customers (${int(riskiest.customers)} customers, average predicted probability ${pct(riskiest.avg_probability)}).`,
      href: segmentFilter(riskiest, { risk: 'high', sort: 'risk_desc' }),
    })
  }

  // 3. The calmest large segment, as a contrast
  const calmest = [...big].sort((a, b) => a.high_risk_share - b.high_risk_share)[0]
  if (calmest) {
    insights.push({
      id: 'calmest',
      headline: `${segmentName(calmest)}: only ${pct(calmest.high_risk_share, 1)} are high risk`,
      detail: `The lowest share among larger segments (${int(calmest.customers)} customers, average predicted probability ${pct(calmest.avg_probability)}).`,
      href: segmentFilter(calmest, { sort: 'risk_asc' }),
    })
  }
  return insights
}
