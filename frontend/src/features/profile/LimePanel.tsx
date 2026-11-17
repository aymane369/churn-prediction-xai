import { motion, useReducedMotion } from 'motion/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Explanation } from '@/types/api'

const pts = (w: number) => `${w >= 0 ? '+' : '−'}${Math.abs(w * 100).toFixed(1)} pts`

/** LIME: a local linear approximation around this customer. Weights are in probability units. */
export function LimePanel({ lime, shap }: { lime: Explanation; shap: Explanation }) {
  const reduce = useReducedMotion()
  const rows = [...lime.values].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 10)
  const max = Math.max(...rows.map((r) => Math.abs(r.contribution)), 0.001)

  // How much the two methods agree for THIS customer
  const top = (e: Explanation, n: number) => [...e.values].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, n)
  const shapTop3 = top(shap, 3)
  const limeTop3 = new Set(top(lime, 3).map((v) => v.feature))
  const shared = shapTop3.filter((v) => limeTop3.has(v.feature)).length
  const shapTop5 = top(shap, 5)
  const limeByFeature = new Map(lime.values.map((v) => [v.feature, v.contribution]))
  const sameSign = shapTop5.filter((v) => Math.sign(v.contribution) === Math.sign(limeByFeature.get(v.feature) ?? 0)).length

  return (
    <div>
      <ul className="space-y-0.5">
        {rows.map((r, i) => {
          const up = r.contribution >= 0
          const half = (Math.abs(r.contribution) / max) * 50
          return (
            <Tooltip key={r.feature}>
              <TooltipTrigger asChild>
                <li tabIndex={0} className="grid grid-cols-1 items-center gap-x-4 rounded-lg px-2 py-1.5 outline-none hover:bg-sunken/70 focus-visible:bg-sunken md:grid-cols-[minmax(0,15rem)_1fr_5rem]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.label}</p>
                    <p className="truncate text-xs text-ink-3">{r.rule ?? String(r.value ?? '')}</p>
                  </div>
                  {/* diverging bar around a centre line: right = towards churn */}
                  <div className="relative h-5" aria-hidden="true">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-ink-3/60" />
                    <motion.span
                      className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-[4px]"
                      style={{ background: up ? 'var(--risk-high-mark)' : 'var(--risk-low-mark)', left: up ? '50%' : undefined, right: up ? undefined : '50%' }}
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${half}%` }}
                      transition={{ duration: 0.5, delay: i * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  </div>
                  <p className={cn('num text-sm font-semibold md:text-right', up ? 'text-risk-high' : 'text-risk-low')}>{pts(r.contribution)}</p>
                </li>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-72 space-y-0.5">
                <p className="font-semibold">{r.label}</p>
                <p>{r.rule}</p>
                <p>
                  Local weight <span className="num font-semibold">{r.contribution.toFixed(3)}</span> (probability units)
                </p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </ul>

      <div className="mt-6 grid gap-4 rounded-2xl border border-line bg-paper p-5 sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-1">Agreement with SHAP, for this customer</p>
          <p className="font-display-opsz text-2xl leading-snug">
            <span className="num">{shared}</span> of 3 top drivers shared
          </p>
          <p className="text-sm text-ink-3">
            Same direction on <span className="num font-semibold text-ink-2">{sameSign}</span> of SHAP’s top 5 features.
          </p>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-ink-3">
          LIME fits a simple model to many slightly altered copies of this customer, so its weights are an <em>approximation</em> in probability units (percentage points) and can differ from SHAP, whose values are exact for this model and in log-odds. Treat agreement as reassurance and disagreement as a reason to look closer.
        </p>
      </div>
    </div>
  )
}
