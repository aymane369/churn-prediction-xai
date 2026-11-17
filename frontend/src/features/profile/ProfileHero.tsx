import { Link } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { ProbabilityGauge } from '@/components/ProbabilityGauge'
import { RiskBadge } from '@/components/RiskBadge'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/features/customers/StatusPill'
import { tintFor } from '@/lib/avatar'
import { customerCode, formatDateTime, money, pct, tenureLabel } from '@/lib/format'
import type { Customer, PredictionResult, RiskThresholds } from '@/types/api'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.8125rem] text-ink-3">{label}</dt>
      <dd className="num text-[0.9375rem] font-semibold">{value}</dd>
    </div>
  )
}

export function ProfileHero({ customer: c, prediction: p, thresholds }: { customer: Customer; prediction: PredictionResult; thresholds?: RiskThresholds | null }) {
  const tint = tintFor(c.avatar_seed)
  const agree = p.churn === c.churn

  return (
    <section aria-label="Customer profile summary">
      {/* Banner: grainy colour field derived from the same seed as the avatar */}
      <div
        className="grain relative h-40 overflow-hidden rounded-3xl md:h-56"
        style={{
          background: `radial-gradient(70% 140% at 12% 0%, ${tint.deep}, transparent 62%), radial-gradient(55% 120% at 88% 110%, ${tint.soft}, transparent 70%), radial-gradient(40% 90% at 60% 10%, ${tint.deep}88, transparent 70%), linear-gradient(120deg, ${tint.soft}, ${tint.deep}55)`,
        }}
        aria-hidden="true"
      />

      <div className="grid gap-8 md:grid-cols-12">
        <div className="relative z-10 md:col-span-7">
          <div className="-mt-14 px-2 md:-mt-[4.5rem] md:px-6">
            <Avatar seed={c.avatar_seed} name={c.username} size={136} layoutId={`avatar-${c.id}`} className="ring-[5px] ring-ivory" />
          </div>
          <div className="mt-5 px-2 md:px-6">
            <p className="eyebrow">{customerCode(c.id)} · pseudonym</p>
            <h1 className="font-display-opsz mt-1 text-[2.4rem] leading-[1.05] font-medium break-words md:text-[3.2rem]">@{c.username}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusPill churned={c.churn} />
              <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink-2">{c.contract} contract</span>
              <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink-2">{tenureLabel(c.tenure)} tenure</span>
            </div>
            <dl className="mt-6 grid max-w-xl grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
              <Fact label="Monthly" value={money(c.monthly_charges)} />
              <Fact label="Total billed" value={money(c.total_charges)} />
              <Fact label="Internet" value={c.internet_service === 'No' ? 'None' : c.internet_service} />
              <Fact label="Payment" value={c.payment_method.replace(' (automatic)', ' · auto')} />
            </dl>
          </div>
        </div>

        {/* Prediction panel: clearly the MODEL's estimate */}
        <div className="relative z-10 md:col-span-5 md:-mt-24">
          <div className="rounded-3xl border border-line bg-paper p-6 shadow-raised">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Churn prediction</p>
              <span className="rounded-full bg-sunken px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-3">Model estimate</span>
            </div>
            <div className="mt-2 flex flex-col items-center">
              <ProbabilityGauge probability={p.probability} risk={p.risk} size={220} lowMax={thresholds?.low_max} highMin={thresholds?.high_min} />
              <RiskBadge risk={p.risk} long className="mt-1 px-3 py-1 text-sm" />
            </div>
            <p className="mt-4 text-center text-[0.8125rem] text-ink-2">
              {p.churn ? 'Above' : 'Below'} the model’s {pct(p.threshold, 1)} decision threshold, so it {p.churn ? 'flags' : 'does not flag'} this customer as likely to churn.
            </p>
            <p className="mt-3 border-t border-line pt-3 text-center text-xs text-ink-3">
              <span className="num">{p.model_version}</span> · predicted <time dateTime={p.predicted_at}>{formatDateTime(p.predicted_at)}</time>
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-dashed border-line-strong p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Observed outcome</p>
              <StatusPill churned={c.churn} />
            </div>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">
              Recorded in the dataset, separate from the prediction above. The model’s call and the recorded outcome <strong className="text-ink-2">{agree ? 'agree' : 'differ'}</strong> for this customer. This customer was part of the model’s training data.
            </p>
          </div>

          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to={`/simulator?customer=${c.id}`}>
              <FlaskConical /> Explore a what-if for this customer
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
