import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowUpRight, FlaskConical } from 'lucide-react'
import { RiskBadge } from '@/components/RiskBadge'
import { EmptyState, ErrorState } from '@/components/states'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useRecentPredictions } from '@/api/queries'
import { formatDateTime, money, pct, tenureLabel, timeAgo } from '@/lib/format'

/** Predictions made from the what-if simulator / form. Stored customers' batch scores are not "activity". */
export function RecentActivity() {
  const { data, isPending, isError, error, refetch } = useRecentPredictions(6)

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading recent predictions">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} compact />
  if (data.length === 0) {
    return (
      <EmptyState
        title="No simulations yet"
        className="rounded-2xl border border-dashed border-line-strong"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/simulator">
              <FlaskConical /> Run a what-if
            </Link>
          </Button>
        }
      >
        Predictions you run in the simulator show up here, newest first.
      </EmptyState>
    )
  }

  return (
    <ol className="divide-y divide-line">
      {data.map((p, i) => (
        <motion.li
          key={p.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: i * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex items-center gap-4 py-3.5"
        >
          <div className="w-14 shrink-0 text-right">
            <span className="font-display-opsz num text-2xl leading-none font-light">{pct(p.probability)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge risk={p.risk} />
              <span className="truncate text-sm font-semibold">{p.contract ?? 'Unknown contract'}</span>
            </div>
            <p className="mt-0.5 truncate text-[0.8125rem] text-ink-3">
              {[p.tenure !== null ? tenureLabel(p.tenure) : null, p.monthly_charges !== null ? `${money(p.monthly_charges)}/mo` : null, p.internet_service]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <time dateTime={p.created_at} title={formatDateTime(p.created_at)} className="shrink-0 text-xs text-ink-3">
            {timeAgo(p.created_at)}
          </time>
        </motion.li>
      ))}
      <li className="pt-3">
        <Button asChild variant="link" size="sm" className="px-0">
          <Link to="/simulator">
            Open the simulator <ArrowUpRight />
          </Link>
        </Button>
      </li>
    </ol>
  )
}
