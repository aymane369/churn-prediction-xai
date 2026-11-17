import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { featureValue, oddsMultiplier, splitDrivers } from '@/lib/shap'
import { signed } from '@/lib/format'
import type { FeatureContribution } from '@/types/api'

function DriverRow({ f, max, up, index }: { f: FeatureContribution; max: number; up: boolean; index: number }) {
  const reduce = useReducedMotion()
  const color = up ? 'var(--risk-high-mark)' : 'var(--risk-low-mark)'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <li tabIndex={0} className="rounded-lg px-2 py-2 outline-none hover:bg-sunken/70 focus-visible:bg-sunken">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm">
              <span className="font-semibold">{f.label}</span>
              <span className="text-ink-3"> · {featureValue(f)}</span>
            </p>
            <p className="num shrink-0 text-sm">
              <span className={`font-semibold ${up ? 'text-risk-high' : 'text-risk-low'}`}>{signed(f.contribution)}</span>
              <span className="text-ink-3"> ×{oddsMultiplier(f.contribution).toFixed(2)}</span>
            </p>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${(Math.abs(f.contribution) / max) * 100}%` }}
              transition={{ duration: 0.5, delay: 0.05 * index, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
        </li>
      </TooltipTrigger>
      <TooltipContent side="top" className="space-y-0.5">
        <p className="font-semibold">
          {f.label} = {featureValue(f)}
        </p>
        <p>
          SHAP value <span className="num font-semibold">{signed(f.contribution, 3)}</span> log-odds
        </p>
        <p>Odds of churn ×{oddsMultiplier(f.contribution).toFixed(3)}</p>
      </TooltipContent>
    </Tooltip>
  )
}

function Column({ title, icon, items, max, up }: { title: string; icon: React.ReactNode; items: FeatureContribution[]; max: number; up: boolean }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 px-2 text-sm font-semibold">
        <span className={`grid size-6 place-items-center rounded-full ${up ? 'bg-risk-high-soft text-risk-high' : 'bg-risk-low-soft text-risk-low'}`}>{icon}</span>
        {title}
        <span className="num text-ink-3 font-normal">({items.length})</span>
      </h4>
      {items.length === 0 ? (
        <p className="px-2 py-3 text-sm text-ink-3">No features push in this direction for this customer.</p>
      ) : (
        <ul>
          {items.map((f, i) => (
            <DriverRow key={f.feature} f={f} max={max} up={up} index={i} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** The same SHAP values as the waterfall, split by direction. Bar length = size of the contribution for THIS customer. */
export function DriverLists({ values }: { values: FeatureContribution[] }) {
  const [all, setAll] = useState(false)
  const { up, down } = splitDrivers(values)
  const max = Math.max(...values.map((v) => Math.abs(v.contribution)), 0.001)
  const shown = (list: FeatureContribution[]) => (all ? list : list.slice(0, 5))
  const hidden = up.length + down.length - shown(up).length - shown(down).length

  return (
    <div>
      <div className="grid gap-8 md:grid-cols-2">
        <Column title="Pushing risk up" icon={<ArrowUp className="size-3.5" aria-hidden="true" />} items={shown(up)} max={max} up />
        <Column title="Pulling risk down" icon={<ArrowDown className="size-3.5" aria-hidden="true" />} items={shown(down)} max={max} up={false} />
      </div>
      {(hidden > 0 || all) && (
        <Button variant="link" size="sm" className="mt-3 px-2" onClick={() => setAll((v) => !v)}>
          {all ? 'Show top 5 only' : `Show all ${values.length} features`}
        </Button>
      )}
      <p className="mt-3 px-2 text-xs text-ink-3">Bar length compares contributions for this customer only. It is not the model’s global feature importance.</p>
    </div>
  )
}
