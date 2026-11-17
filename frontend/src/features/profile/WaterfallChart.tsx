import { useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { buildWaterfall, featureValue, oddsMultiplier, type WaterfallStep } from '@/lib/shap'
import { pct, signed } from '@/lib/format'
import { RISK } from '@/lib/risk'
import { cn } from '@/lib/utils'
import type { Explanation, Risk } from '@/types/api'

const UP = 'var(--risk-high-mark)' // pushes towards churn
const DOWN = 'var(--risk-low-mark)' // pushes away from churn
const REST = 'var(--info-mark)'

/** Shared column template: label | axis | numbers. */
const GRID = 'grid grid-cols-1 items-center gap-x-4 md:grid-cols-[minmax(0,14rem)_1fr_5.5rem]'

const fmtValue = (step: WaterfallStep) => (step.value === null ? '' : featureValue({ feature: step.key, value: step.value }))

/** Nice integer ticks covering [lo, hi]. */
function ticksFor(lo: number, hi: number): number[] {
  const step = hi - lo > 8 ? 2 : 1
  const out: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t)
  return out
}

interface Scale {
  x: (v: number) => number
  guides: string
}

function Axis({ scale, children, className }: { scale: Scale; children?: React.ReactNode; className?: string }) {
  // The gridlines live in each row's own axis cell, so they line up with that cell's width exactly
  return (
    <div className={cn('relative h-9', className)} style={{ background: scale.guides }}>
      {children}
    </div>
  )
}

function StepRow({ step, index, scale, first, last }: { step: WaterfallStep; index: number; scale: Scale; first: boolean; last: boolean }) {
  const reduce = useReducedMotion()
  const up = step.phi >= 0
  const color = step.kind === 'rest' ? REST : up ? UP : DOWN
  const x0 = scale.x(step.from)
  const x1 = scale.x(step.to)
  const left = Math.min(x0, x1)
  const width = Math.max(0.6, Math.abs(x1 - x0))

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <li
          tabIndex={0}
          aria-label={`${step.label}${step.value !== null ? ` ${fmtValue(step)}` : ''}: ${signed(step.phi, 2)} log-odds, odds multiplied by ${oddsMultiplier(step.phi).toFixed(2)}`}
          className={cn(GRID, 'rounded-lg outline-none hover:bg-sunken/70 focus-visible:bg-sunken')}
        >
          <div className="min-w-0 px-2 pt-1 md:py-0">
            <p className="truncate text-sm font-semibold">{step.label}</p>
            {step.value !== null && <p className="truncate text-xs text-ink-3">{fmtValue(step)}</p>}
          </div>
          <Axis scale={scale}>
            {/* connectors: a bar starts exactly where the previous one ended */}
            {!first && <span aria-hidden="true" className="absolute top-0 h-[calc(50%-8px)] w-px bg-ink-3/50" style={{ left: `${x0}%` }} />}
            {!last && <span aria-hidden="true" className="absolute bottom-0 h-[calc(50%-8px)] w-px bg-ink-3/50" style={{ left: `${x1}%` }} />}
            <motion.span
              className="absolute top-1/2 h-4 -translate-y-1/2 rounded-[4px]"
              style={{ left: `${left}%`, background: color }}
              initial={reduce ? false : { width: 0, opacity: 0.4 }}
              animate={{ width: `${width}%`, opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.08 + index * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </Axis>
          <div className="num flex items-baseline justify-between px-2 pb-1 md:block md:px-0 md:pb-0 md:text-right">
            <span className={cn('text-sm font-semibold', up ? 'text-risk-high' : 'text-risk-low')}>{signed(step.phi)}</span>
            <span className="block text-xs text-ink-3">×{oddsMultiplier(step.phi).toFixed(2)} odds</span>
          </div>
        </li>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72 space-y-1 text-left">
        <p className="font-semibold">
          {step.label}
          {step.value !== null && <span className="font-normal"> = {fmtValue(step)}</span>}
        </p>
        <p>
          SHAP value: <span className="num font-semibold">{signed(step.phi, 3)}</span> log-odds
        </p>
        <p>
          Multiplies the odds of churn by <span className="num font-semibold">×{oddsMultiplier(step.phi).toFixed(3)}</span>
        </p>
        <p className="opacity-80">
          Running prediction in this order: {pct(step.fromProb, 1)} → {pct(step.toProb, 1)}
        </p>
        {step.kind === 'rest' && <p className="opacity-80">Sum of {step.count} smaller contributions.</p>}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Waterfall of one prediction on the LOG-ODDS scale: start at the baseline (the model's average
 * output), add each feature's SHAP value, end at this customer's prediction. The axis shows both
 * log-odds and the probability each tick corresponds to.
 */
export function WaterfallChart({ shap, probability, risk }: { shap: Explanation; probability: number; risk: Risk }) {
  const wf = useMemo(() => buildWaterfall(shap, probability, 8), [shap, probability])

  const { scale, ticks } = useMemo(() => {
    const all = [wf.base, wf.final, ...wf.steps.flatMap((s) => [s.from, s.to])]
    const lo = Math.floor(Math.min(...all) - 0.4)
    const hi = Math.ceil(Math.max(...all) + 0.4)
    const x = (v: number) => ((v - lo) / (hi - lo)) * 100
    const ticks = ticksFor(lo, hi)
    const lines = ticks.map((t) => `linear-gradient(var(--line), var(--line)) ${x(t)}% 0 / 1px 100% no-repeat`)
    // the baseline gets a stronger line so every bar can be read against it
    const baseline = `linear-gradient(var(--ink-3), var(--ink-3)) ${x(wf.base)}% 0 / 1px 100% no-repeat`
    return { scale: { x, guides: [baseline, ...lines].join(', ') } satisfies Scale, ticks }
  }, [wf])

  return (
    <figure aria-labelledby="wf-title" className="min-w-0">
      <figcaption id="wf-title" className="sr-only">
        Waterfall chart: how each feature moves the prediction from the baseline of {pct(wf.baseProb)} to {pct(wf.finalProb)}. The same numbers are in the lists below.
      </figcaption>

      {/* Axis header: log-odds on top, the probability each tick corresponds to underneath */}
      <div className={cn(GRID, 'hidden md:grid')} aria-hidden="true">
        <span />
        <div className="relative h-10">
          {ticks.map((t) => (
            <span key={t} className="num absolute top-0 -translate-x-1/2 text-center text-[0.6875rem] leading-tight text-ink-3" style={{ left: `${scale.x(t)}%` }}>
              {t > 0 ? `+${t}` : t < 0 ? `−${Math.abs(t)}` : '0'}
              <span className="block opacity-80">{pct(1 / (1 + Math.exp(-t)))}</span>
            </span>
          ))}
        </div>
        <span className="text-right text-[0.6875rem] leading-tight text-ink-3">
          log-odds
          <span className="block">odds ×</span>
        </span>
      </div>

      <div className="mt-1">
        <div className={cn(GRID, 'py-0.5')}>
          <div className="px-2 pt-1 md:py-0">
            <p className="text-sm font-semibold">Baseline</p>
            <p className="text-xs text-ink-3">the model’s average output</p>
          </div>
          <Axis scale={scale}>
            <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-paper" style={{ left: `${scale.x(wf.base)}%` }} />
          </Axis>
          <div className="num flex items-baseline justify-between px-2 pb-1 md:block md:px-0 md:pb-0 md:text-right">
            <span className="text-sm font-semibold">{pct(wf.baseProb, 1)}</span>
            <span className="block text-xs text-ink-3">{signed(wf.base)}</span>
          </div>
        </div>

        <ul>
          {wf.steps.map((s, i) => (
            <StepRow key={s.key} step={s} index={i} scale={scale} first={i === 0} last={false} />
          ))}
        </ul>

        <div className={cn(GRID, 'mt-1 border-t border-line-strong py-1')}>
          <div className="px-2 pt-1 md:py-0">
            <p className="text-sm font-semibold">This customer’s prediction</p>
            <p className="text-xs text-ink-3">baseline + all contributions</p>
          </div>
          <Axis scale={scale}>
            <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${scale.x(wf.final)}%`, background: RISK[risk].markVar }} />
          </Axis>
          <div className="num flex items-baseline justify-between px-2 pb-1 md:block md:px-0 md:pb-0 md:text-right">
            <span className="font-display-opsz text-xl leading-none">{pct(wf.finalProb, 1)}</span>
            <span className="block text-xs text-ink-3">{signed(wf.final)}</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-3">
        <span className="font-semibold text-ink-2">How to read it.</span> SHAP values are in <em>log-odds</em>, not percentage points: each one multiplies the odds of churn by the factor shown, and the factors multiply exactly from baseline to prediction. The percentages on the axis, and the “running prediction” in tooltips, follow from the running total and depend on the order of the steps (largest first); the log-odds contributions do not.
        {wf.residual > 0.01 && <span className="text-risk-high"> Note: the contributions differ from the stored prediction by {wf.residual.toFixed(3)} log-odds.</span>}
      </p>
    </figure>
  )
}
