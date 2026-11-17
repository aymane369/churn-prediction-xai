import { RISK } from '@/lib/risk'
import { pct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Risk } from '@/types/api'

/** Compact probability read-out: number + a bar whose colour is the risk band. */
export function ProbabilityBar({
  probability,
  risk,
  className,
  showValue = true,
}: {
  probability: number | null
  risk: Risk | null
  className?: string
  showValue?: boolean
}) {
  if (probability === null || risk === null) return <span className="text-sm text-ink-3">Not scored</span>
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {showValue && <span className="num w-10 shrink-0 text-right text-sm font-semibold">{pct(probability)}</span>}
      <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, probability * 100)}%`, background: RISK[risk].markVar }} />
      </div>
    </div>
  )
}
