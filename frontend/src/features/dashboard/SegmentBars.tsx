import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DIMENSION_LABEL, segmentFilter, segmentName } from '@/features/dashboard/deriveInsights'
import { RISK } from '@/lib/risk'
import { int, pct } from '@/lib/format'
import type { Overview, Risk, Segment } from '@/types/api'

const DIMENSIONS: Segment['dimension'][] = ['contract', 'internet_service', 'tenure']

const bandOf = (p: number, low: number, high: number): Risk => (p < low ? 'low' : p >= high ? 'high' : 'medium')

/** Ranked bars: length = average predicted churn probability of the segment. Click drills into the directory. */
export function SegmentBars({ overview }: { overview: Overview }) {
  const [dimension, setDimension] = useState<Segment['dimension']>('contract')
  const low = overview.risk_thresholds?.low_max ?? 0.2
  const high = overview.risk_thresholds?.high_min ?? 0.5

  const rows = useMemo(() => {
    const list = overview.segments.filter((s) => s.dimension === dimension)
    // Tenure has a natural order; the others are ranked by risk
    return dimension === 'tenure' ? list : [...list].sort((a, b) => b.avg_probability - a.avg_probability)
  }, [overview.segments, dimension])
  const max = Math.max(...rows.map((r) => r.avg_probability), 0.01) * 1.1

  return (
    <div>
      <ToggleGroup
        type="single"
        value={dimension}
        onValueChange={(v) => v && setDimension(v as Segment['dimension'])}
        aria-label="Segment by"
        className="mb-6 w-full justify-start gap-1 rounded-full border border-line bg-paper p-1"
      >
        {DIMENSIONS.map((d) => (
          <ToggleGroupItem
            key={d}
            value={d}
            className="rounded-full px-4 text-sm font-semibold text-ink-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:bg-sunken data-[state=on]:hover:bg-primary"
          >
            {DIMENSION_LABEL[d]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <ul className="space-y-1">
        {rows.map((s, i) => {
          const band = bandOf(s.avg_probability, low, high)
          return (
            <li key={`${dimension}-${s.value}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={`/customers?${segmentFilter(s, { sort: 'risk_desc' })}`}
                    className="group -mx-2 block rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-sunken"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold">{segmentName(s)}</span>
                      <span className="num text-sm text-ink-2">
                        <span className="font-semibold text-ink">{pct(s.avg_probability, 1)}</span>
                        <span className="text-ink-3"> avg · {int(s.customers)}</span>
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sunken group-hover:bg-ivory">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: RISK[band].markVar }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(s.avg_probability / max) * 100}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
                      />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64">
                  <p className="font-semibold">{segmentName(s)}</p>
                  <p>
                    {pct(s.high_risk_share, 1)} high risk · churned in data {pct(s.observed_churn_rate, 1)}
                  </p>
                  <p className="opacity-80">Click to list these customers</p>
                </TooltipContent>
              </Tooltip>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-3">Bar length: average predicted churn probability. Colour: risk band of that average.</p>
    </div>
  )
}
