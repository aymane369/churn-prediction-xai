import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useReducedMotion } from 'motion/react'
import { RiskBadge } from '@/components/RiskBadge'
import { RISK, RISK_ORDER } from '@/lib/risk'
import { int, pct } from '@/lib/format'
import type { Overview, Risk } from '@/types/api'

interface Bin {
  short: string
  range: string
  lower: number
  upper: number
  customers: number
  band: Risk
}

const bandOf = (mid: number, low: number, high: number): Risk => (mid < low ? 'low' : mid >= high ? 'high' : 'medium')

function HistTooltip({ active, payload, total }: { active?: boolean; payload?: Array<{ payload: Bin }>; total: number }) {
  if (!active || !payload?.length) return null
  const b = payload[0].payload
  return (
    <div className="min-w-44 rounded-xl border border-line-strong bg-paper p-3 shadow-raised">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="num text-sm font-semibold">{b.range}</span>
        <RiskBadge risk={b.band} />
      </div>
      <p className="text-sm text-ink-2">
        <span className="num font-semibold text-ink">{int(b.customers)}</span> customers
        <span className="text-ink-3"> · {pct(b.customers / total, 1)} of all</span>
      </p>
      <p className="mt-1 text-xs text-ink-3">Predicted churn probability in this range</p>
    </div>
  )
}

export function RiskHistogram({ overview }: { overview: Overview }) {
  const reduce = useReducedMotion()
  const low = overview.risk_thresholds?.low_max ?? 0.2
  const high = overview.risk_thresholds?.high_min ?? 0.5
  const data: Bin[] = overview.probability_histogram.map((b) => ({
    short: `${Math.round(b.lower * 100)}`,
    range: `${pct(b.lower)} to ${pct(b.upper)}`,
    lower: b.lower,
    upper: b.upper,
    customers: b.customers,
    band: bandOf((b.lower + b.upper) / 2, low, high),
  }))
  const total = overview.customers
  const bands = Object.fromEntries(overview.risk_distribution.map((d) => [d.band, d])) as Record<Risk, Overview['risk_distribution'][number] | undefined>

  return (
    <div>
      {/* Visually hidden data table: the chart is not the only way to read these numbers */}
      <table className="sr-only">
        <caption>Customers by predicted churn probability</caption>
        <thead>
          <tr>
            <th scope="col">Probability range</th>
            <th scope="col">Customers</th>
            <th scope="col">Risk band</th>
          </tr>
        </thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.lower}>
              <td>{b.range}</td>
              <td>{b.customers}</td>
              <td>{RISK[b.band].label}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h-[280px]" role="img" aria-label="Histogram of customers by predicted churn probability, coloured by risk band">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={4}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="short" tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-3)', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: 'var(--ink-3)', fontSize: 12 }} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
            <Tooltip cursor={{ fill: 'rgb(34 43 41 / 0.05)' }} content={<HistTooltip total={total} />} />
            <Bar dataKey="customers" radius={[5, 5, 0, 0]} isAnimationActive={!reduce} animationDuration={700}>
              {data.map((b) => (
                <Cell key={b.lower} fill={RISK[b.band].mark} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-xs text-ink-3">Predicted churn probability, in 10% steps (left edge of each bin)</p>

      {/* Band summary: how many customers, how confident the model is, and how it compares with reality */}
      <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {RISK_ORDER.map((band) => {
          const d = bands[band]
          return (
            <Link
              key={band}
              to={`/customers?risk=${band}&sort=${band === 'low' ? 'risk_asc' : 'risk_desc'}`}
              className="group bg-paper p-4 transition-colors duration-200 hover:bg-sunken focus-visible:z-10"
            >
              <div className="flex items-center justify-between">
                <RiskBadge risk={band} long />
                <span className="text-xs font-semibold text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">View →</span>
              </div>
              <p className="font-display-opsz mt-3 text-3xl leading-none font-light">
                <span className="num">{int(d?.customers ?? 0)}</span>
              </p>
              <p className="mt-1 text-[0.8125rem] text-ink-3">{RISK[band].description}</p>
              {d && (
                <p className="mt-3 border-t border-line pt-3 text-xs text-ink-2">
                  Avg predicted <span className="num font-semibold">{pct(d.avg_probability, 1)}</span>
                  <span className="text-ink-3"> · churned in data </span>
                  <span className="num font-semibold">{pct(d.observed_churn_rate, 1)}</span>
                </p>
              )}
            </Link>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-ink-3">
        The model was trained on these customers, so “churned in data” is an in-sample comparison, not a forecast of future accuracy.
      </p>
    </div>
  )
}
