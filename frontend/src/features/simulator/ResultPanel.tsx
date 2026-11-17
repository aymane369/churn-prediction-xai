import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, FlaskConical, Loader2, Minus, RotateCcw } from 'lucide-react'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { ProbabilityGauge } from '@/components/ProbabilityGauge'
import { RiskBadge } from '@/components/RiskBadge'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { WaterfallChart } from '@/features/profile/WaterfallChart'
import type { Change } from '@/features/simulator/model'
import { oddsMultiplier } from '@/lib/shap'
import { signed } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Explanation, PredictionResult, RiskThresholds } from '@/types/api'

interface Props {
  original?: PredictionResult
  simulated?: PredictionResult
  pending: boolean
  error: unknown
  changes: Change[]
  dirty: boolean
  thresholds?: RiskThresholds | null
  onSimulate: () => void
  onReset: () => void
}

const shap = (p?: PredictionResult): Explanation | undefined => p?.explanations.find((e) => e.method === 'shap')

/** Features whose SHAP contribution moved the most between the two predictions. */
function shifts(a?: Explanation, b?: Explanation) {
  if (!a || !b) return []
  const before = new Map(a.values.map((v) => [v.feature, v]))
  return b.values
    .map((v) => ({ feature: v.feature, label: v.label, value: v.value, before: before.get(v.feature)?.contribution ?? 0, after: v.contribution }))
    .map((s) => ({ ...s, delta: s.after - s.before }))
    .filter((s) => Math.abs(s.delta) >= 0.01)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, 5)
}

export function ResultPanel({ original, simulated, pending, error, changes, dirty, thresholds, onSimulate, onReset }: Props) {
  const [showFull, setShowFull] = useState(false)
  const delta = original && simulated ? (simulated.probability - original.probability) * 100 : null
  const moved = useMemo(() => shifts(shap(original), shap(simulated)), [original, simulated])
  const maxShift = Math.max(...moved.map((m) => Math.abs(m.delta)), 0.001)
  const simShap = shap(simulated)
  const DeltaIcon = delta === null || Math.abs(delta) < 0.05 ? Minus : delta < 0 ? ArrowDownRight : ArrowUpRight

  return (
    <section aria-label="Simulation result" className="rounded-3xl border border-line bg-paper p-6 shadow-raised md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display-opsz text-2xl font-medium">Original vs. simulated</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-risk-medium-soft px-3 py-1 text-xs font-semibold text-risk-medium">
          <FlaskConical className="size-3.5" aria-hidden="true" /> Hypothetical
        </span>
      </div>

      <div className="mt-6 grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <figure className="flex flex-col items-center gap-2">
          {original ? (
            <ProbabilityGauge probability={original.probability} risk={original.risk} size={170} caption="original" lowMax={thresholds?.low_max} highMin={thresholds?.high_min} />
          ) : (
            <div className="grid size-[170px] place-items-center rounded-full border-2 border-dashed border-line-strong text-sm text-ink-3">Loading…</div>
          )}
          {original && <RiskBadge risk={original.risk} long />}
        </figure>

        <div className="flex flex-col items-center gap-1" aria-live="polite">
          <ArrowRight className="hidden size-5 text-ink-3 sm:block" aria-hidden="true" />
          {delta !== null && (
            <div className="inline-flex items-center gap-1 rounded-full bg-sunken px-3 py-1 text-sm font-semibold">
              <DeltaIcon className="size-4" aria-hidden="true" />
              <AnimatedNumber value={delta} format={(v) => `${signed(v, 1)} pts`} />
            </div>
          )}
          <span className="text-center text-xs text-ink-3">{delta === null ? '' : 'change in the model’s estimate'}</span>
        </div>

        <figure className="flex flex-col items-center gap-2">
          {simulated ? (
            <ProbabilityGauge probability={simulated.probability} risk={simulated.risk} size={170} caption="simulated" hypothetical lowMax={thresholds?.low_max} highMin={thresholds?.high_min} />
          ) : (
            <div className="grid size-[170px] place-items-center rounded-full border-2 border-dashed border-line-strong px-6 text-center text-sm text-ink-3">
              {pending ? <Loader2 className="size-5 animate-spin" aria-label="Simulating" /> : 'Run a simulation to see the new estimate'}
            </div>
          )}
          {simulated && <RiskBadge risk={simulated.risk} long />}
        </figure>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-line-strong p-4 text-[0.8125rem] leading-relaxed text-ink-2">
        <strong className="text-ink">This is a what-if, not a forecast.</strong> It shows how the <em>model’s estimate</em> moves when attributes change. It does not show that making this change would cause the customer to stay or leave, and the model can’t tell you what the customer would actually do.
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={onSimulate} disabled={pending || changes.length === 0}>
          {pending ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          {pending ? 'Simulating…' : simulated && !dirty ? 'Simulated' : 'Simulate'}
        </Button>
        <Button variant="ghost" size="lg" onClick={onReset} disabled={changes.length === 0 && !simulated}>
          <RotateCcw /> Reset
        </Button>
        {dirty && changes.length > 0 && !pending && <span className="text-sm text-ink-3">Changes not simulated yet</span>}
        {changes.length === 0 && <span className="text-sm text-ink-3">Change an attribute to enable the simulation.</span>}
      </div>

      {error ? <ErrorState error={error} compact /> : null}

      <AnimatePresence>
        {changes.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <h3 className="eyebrow mt-8 mb-3">What you changed</h3>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {changes.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="font-semibold">{c.label}</span>
                  <span className="num text-ink-2">
                    {c.from} <span aria-hidden="true">→</span>
                    <span className="sr-only"> changed to </span> <span className="font-semibold text-ink">{c.to}</span>
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {simulated && moved.length > 0 && (
        <div className="mt-8">
          <h3 className="eyebrow mb-1">How the explanation changed</h3>
          <p className="mb-3 text-xs text-ink-3">Change in each feature’s SHAP contribution, in log-odds (right of the line = more churn-like). The model combines features, so contributions can shift even for attributes you didn’t edit.</p>
          <ul className="space-y-1">
            {moved.map((m) => {
              const up = m.delta > 0
              return (
                <li key={m.feature} className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 text-sm">
                  <span className="truncate font-medium">{m.label}</span>
                  <div className="relative h-4" aria-hidden="true">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-ink-3/60" />
                    <motion.span
                      className="absolute top-1/2 h-3 -translate-y-1/2 rounded-[3px]"
                      style={{ background: up ? 'var(--risk-high-mark)' : 'var(--risk-low-mark)', left: up ? '50%' : undefined, right: up ? undefined : '50%' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(Math.abs(m.delta) / maxShift) * 50}%` }}
                      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  </div>
                  <span className={cn('num text-right font-semibold', up ? 'text-risk-high' : 'text-risk-low')} title={`Odds multiplier changed by ×${oddsMultiplier(m.delta).toFixed(2)}`}>
                    {signed(m.delta)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {simulated && simShap && (
        <div className="mt-8 border-t border-line pt-5">
          <Button variant="link" size="sm" className="px-0" onClick={() => setShowFull((v) => !v)} aria-expanded={showFull}>
            {showFull ? 'Hide' : 'Show'} the full SHAP waterfall for the simulated scenario
          </Button>
          {showFull && (
            <div className="mt-4">
              <WaterfallChart shap={simShap} probability={simulated.probability} risk={simulated.risk} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
