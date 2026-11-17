import { AnimatedNumber } from '@/components/AnimatedNumber'
import { int, pct } from '@/lib/format'
import type { Overview } from '@/types/api'

interface Kpi {
  label: string
  value: number
  format: (v: number) => string
  context: string
  /** Marks numbers that come from the dataset, not from the model. */
  kind: 'predicted' | 'observed' | 'count'
}

function kpis(o: Overview): Kpi[] {
  const list: Kpi[] = [
    { label: 'Customers', value: o.customers, format: (v) => int(Math.round(v)), context: 'in the scored customer base', kind: 'count' },
  ]
  if (o.high_risk_customers !== null && o.avg_probability !== null) {
    list.push(
      {
        label: 'Predicted high risk',
        value: o.high_risk_customers,
        format: (v) => int(Math.round(v)),
        context: `${pct(o.high_risk_customers / o.customers)} of customers · probability ≥ ${pct(o.risk_thresholds?.high_min ?? 0.5)}`,
        kind: 'predicted',
      },
      {
        label: 'Average churn probability',
        value: o.avg_probability * 100,
        format: (v) => `${v.toFixed(1)}%`,
        context: 'mean of the model’s estimates',
        kind: 'predicted',
      },
    )
  }
  list.push({
    label: 'Churned in the data',
    value: o.churn_rate * 100,
    format: (v) => `${v.toFixed(1)}%`,
    context: `${int(o.churned)} customers: an observed outcome, not a prediction`,
    kind: 'observed',
  })
  return list
}

const TAG: Record<Kpi['kind'], string | null> = { predicted: 'Model estimate', observed: 'Observed', count: null }

/** Typographic KPIs separated by hairlines: numbers are the design, not boxes around them. */
export function KpiStrip({ overview }: { overview: Overview }) {
  const items = kpis(overview)
  return (
    <dl className="grid grid-cols-2 border-y border-line lg:grid-cols-4">
      {items.map((k) => (
        <div
          key={k.label}
          className="flex flex-col gap-2 border-line px-1 py-7 sm:px-6 lg:first:pl-0 [&:nth-child(even)]:border-l [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0 lg:[&:not(:first-child)]:border-l"
        >
          <dt className="flex flex-col items-start gap-1.5 text-sm font-semibold text-ink-2">
            {k.label}
            {TAG[k.kind] ? (
              <span className="rounded-full bg-sunken px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap text-ink-3">{TAG[k.kind]}</span>
            ) : (
              <span aria-hidden="true" className="h-[1.2rem]" />
            )}
          </dt>
          <dd className="font-display-opsz text-[2.6rem] leading-none font-light text-ink sm:text-[3.4rem]">
            <AnimatedNumber value={k.value} format={k.format} />
          </dd>
          <dd className="text-[0.8125rem] leading-snug text-ink-3">{k.context}</dd>
        </div>
      ))}
    </dl>
  )
}
