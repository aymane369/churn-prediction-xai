import { RISK } from '@/lib/risk'
import { cn } from '@/lib/utils'
import type { Risk } from '@/types/api'

interface RiskBadgeProps {
  risk: Risk | null
  /** Show the full label ("High risk") instead of the short one ("High"). */
  long?: boolean
  className?: string
}

/** Colour is never the only signal: the band name is always written out. */
export function RiskBadge({ risk, long, className }: RiskBadgeProps) {
  if (!risk) {
    return (
      <span className={cn('inline-flex items-center rounded-full bg-sunken px-2.5 py-0.5 text-xs font-semibold text-ink-3', className)}>
        Not scored
      </span>
    )
  }
  const r = RISK[risk]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold', r.soft, r.text, className)}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: r.markVar }} />
      {long ? r.label : r.short}
    </span>
  )
}
