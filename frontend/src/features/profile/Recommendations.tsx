import { Link } from 'react-router-dom'
import { FlaskConical, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { simulatorHref, suggest } from '@/features/profile/suggestions'
import type { Customer, FeatureContribution } from '@/types/api'

export function Recommendations({ customer, values }: { customer: Customer; values: FeatureContribution[] }) {
  const items = suggest(customer, values)

  return (
    <div className="rounded-3xl bg-charcoal p-6 text-ivory md:p-9">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sage/20 text-sage">
          <Lightbulb className="size-4.5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold tracking-[0.09em] text-sage uppercase">Retention suggestions</p>
          <h3 className="font-display-opsz mt-1 text-2xl leading-tight font-medium">Ideas to discuss, not proven fixes</h3>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-sage">
        These come from simple business rules applied to the factors that push this customer’s predicted risk up. They are suggestions only: nothing here has been shown to reduce churn, and previewing one in the simulator shows how the <em>model</em> would react, not what the customer would do.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-sage/25 p-5 text-sage">
          No actionable upward drivers were found for this customer. Their predicted risk comes from factors that a retention team can’t change directly.
        </p>
      ) : (
        <ol className="mt-8 divide-y divide-sage/20 border-y border-sage/20">
          {items.map((s, i) => (
            <li key={s.id} className="grid gap-4 py-6 md:grid-cols-[3.5rem_1fr_auto] md:items-center">
              <span aria-hidden="true" className="font-display-opsz text-4xl leading-none font-light text-eucalyptus">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h4 className="font-display-opsz text-xl font-medium">{s.title}</h4>
                <p className="mt-1 text-[0.9375rem] text-ivory/90">{s.action}</p>
                <p className="mt-1.5 text-[0.8125rem] text-sage">{s.because}</p>
              </div>
              {s.simulate && (
                <Button asChild variant="outline" size="sm" className="border-sage/40 bg-transparent text-ivory hover:border-ivory hover:bg-ivory/10">
                  <Link to={simulatorHref(customer.id, s.simulate)}>
                    <FlaskConical /> Preview in simulator
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
