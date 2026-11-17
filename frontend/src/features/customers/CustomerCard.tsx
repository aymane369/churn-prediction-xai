import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowUpRight } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { RiskBadge } from '@/components/RiskBadge'
import { ProbabilityBar } from '@/components/ProbabilityBar'
import { StatusPill } from '@/features/customers/StatusPill'
import { tintFor } from '@/lib/avatar'
import { customerCode, money, pct, tenureLabel } from '@/lib/format'
import type { Customer } from '@/types/api'

export function CustomerCard({ customer: c, index, back }: { customer: Customer; index: number; back: string }) {
  const tint = tintFor(c.avatar_seed)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.03, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Link
        to={`/customers/${c.id}`}
        state={{ back }}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-out-soft hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised"
      >
        {/* A band tinted from the same seed as the avatar: each customer gets a consistent colour identity */}
        <div className="relative h-16" style={{ background: `linear-gradient(120deg, ${tint.soft}, ${tint.deep}33)` }} aria-hidden="true" />
        <div className="-mt-9 flex items-end justify-between px-5">
          <Avatar seed={c.avatar_seed} name={c.username} size={64} decorative layoutId={`avatar-${c.id}`} className="ring-2 ring-paper" />
          <RiskBadge risk={c.risk} long className="mb-1" />
        </div>

        <div className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-5">
          <div>
            <h3 className="truncate text-[1.0625rem] font-semibold">@{c.username}</h3>
            <p className="eyebrow mt-0.5 !text-[0.6875rem]">{customerCode(c.id)}</p>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display-opsz num text-[2.4rem] leading-none font-light">{c.churn_probability === null ? '–' : pct(c.churn_probability)}</span>
              <span className="text-xs text-ink-3">predicted churn probability</span>
            </div>
            <ProbabilityBar probability={c.churn_probability} risk={c.risk} showValue={false} className="mt-2.5" />
          </div>

          <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-3 text-[0.8125rem]">
            <div>
              <dt className="text-ink-3">Contract</dt>
              <dd className="font-semibold">{c.contract === 'Month-to-month' ? 'Monthly' : c.contract}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Tenure</dt>
              <dd className="num font-semibold">{tenureLabel(c.tenure)}</dd>
            </div>
            <div>
              <dt className="text-ink-3">Monthly</dt>
              <dd className="num font-semibold">{money(c.monthly_charges)}</dd>
            </div>
          </dl>
          <div className="flex items-center justify-between">
            <StatusPill churned={c.churn} />
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-3 transition-colors group-hover:text-ink">
              Open profile <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
