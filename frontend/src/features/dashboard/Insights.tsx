import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { deriveInsights } from '@/features/dashboard/deriveInsights'
import type { Overview } from '@/types/api'

/** Editorial list of observations computed from the live overview numbers. */
export function Insights({ overview }: { overview: Overview }) {
  const insights = deriveInsights(overview)
  if (insights.length === 0) {
    return <p className="text-ink-3">Insights appear once the model has scored the customer base.</p>
  }
  return (
    <div>
      <ol className="divide-y divide-line border-y border-line">
        {insights.map((it, i) => (
          <li key={it.id}>
            <Link to={`/customers?${it.href}`} className="group grid grid-cols-[3rem_1fr_auto] items-start gap-4 py-6 transition-colors duration-200 hover:bg-paper sm:grid-cols-[4rem_1fr_auto] sm:px-2">
              <span aria-hidden="true" className="font-display-opsz text-4xl leading-none font-light text-risk-low-mark sm:text-5xl">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="font-display-opsz text-[1.35rem] leading-snug font-medium">{it.headline}</h3>
                <p className="mt-1.5 max-w-xl text-[0.9375rem] text-ink-2">{it.detail}</p>
              </div>
              <span className="mt-1 hidden items-center gap-1 text-sm font-semibold text-ink-2 sm:inline-flex">
                <span className="underline decoration-line-strong underline-offset-4 group-hover:decoration-ink">See customers</span>
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-ink-3">
        These describe where <em>predicted</em> risk is concentrated in today’s data. They are observations, not evidence of what would reduce churn.
      </p>
    </div>
  )
}
