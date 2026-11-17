import { Link } from 'react-router-dom'
import { ArrowRight, Database, FlaskConical, HeartHandshake, ScanSearch } from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/states'
import { Skeleton } from '@/components/ui/skeleton'
import { RiskBadge } from '@/components/RiskBadge'
import { WaterfallChart } from '@/features/profile/WaterfallChart'
import { simulatorHref, suggest } from '@/features/profile/suggestions'
import { useCurtain } from '@/components/layout/Curtain'
import { useCustomer, useExplanation, useModelInfo, useOverview } from '@/api/queries'
import { int, pct, formatDateTime } from '@/lib/format'
import { RISK, RISK_ORDER } from '@/lib/risk'
import type { Member } from '@/features/landing/data'

const Eyebrow = ({ children, light }: { children: React.ReactNode; light?: boolean }) => (
  <p className={`eyebrow mb-3 ${light ? '!text-sage' : ''}`}>{children}</p>
)

/* ------------------------------------------------------------------------------------------ */

const STEPS = [
  { icon: Database, title: 'Score', text: 'A gradient-boosted model estimates each customer’s probability of leaving.' },
  { icon: ScanSearch, title: 'Explain', text: 'SHAP shows which attributes pushed each estimate up or down, on the exact log-odds scale.' },
  { icon: FlaskConical, title: 'Simulate', text: 'Change an attribute and ask the model again. Every what-if is labelled hypothetical.' },
  { icon: HeartHandshake, title: 'Retain', text: 'Rule-based suggestions point to what an account team could discuss, not to proven fixes.' },
]

export function Steps() {
  return (
    <section id="how" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-24 md:px-8">
      <Reveal>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="font-display-opsz max-w-2xl text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] font-medium">
          From a customer table to <em className="font-light text-ink-2 italic">a clear next conversation.</em>
        </h2>
      </Reveal>
      <ol className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} as="li" delay={i * 0.08} className="relative">
            <div className="mb-5 flex items-center gap-3">
              <span aria-hidden="true" className="font-display-opsz text-5xl leading-none font-light text-risk-low-mark">{String(i + 1).padStart(2, '0')}</span>
              <span aria-hidden="true" className="h-px flex-1 bg-line-strong" />
            </div>
            <span className="mb-3 grid size-10 place-items-center rounded-full bg-secondary text-ink">
              <s.icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="font-display-opsz text-2xl font-medium">{s.title}</h3>
            <p className="mt-2 text-[0.9375rem] text-ink-2">{s.text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

export function PredictionSection() {
  const { data } = useOverview()
  const dist = data?.risk_distribution ?? []
  const total = dist.reduce((s, d) => s + d.customers, 0)

  return (
    <section id="predict" className="scroll-mt-24 border-y border-line bg-paper">
      <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 py-24 md:px-8 lg:grid-cols-2">
        <Reveal>
          <Eyebrow>Prediction</Eyebrow>
          <h2 className="font-display-opsz text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] font-medium">
            Know who is at risk, <em className="font-light text-ink-2 italic">before they leave.</em>
          </h2>
          <p className="mt-5 max-w-lg text-[1.0625rem] text-ink-2">
            Every customer gets a churn probability and one of three risk bands. The bands are simple, written-down rules, so a number like “67%” always lands in the same place.
          </p>
          <ul className="mt-6 space-y-2 text-[0.9375rem] text-ink-2">
            {RISK_ORDER.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <RiskBadge risk={b} long />
                <span>{RISK[b].description}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-3xl border border-line bg-ivory p-7 shadow-card">
            <p className="eyebrow mb-4">The customer base, by predicted risk</p>
            {total > 0 ? (
              <>
                <div className="flex h-5 overflow-hidden rounded-full" role="img" aria-label={dist.map((d) => `${d.band} risk: ${d.customers} customers`).join(', ')}>
                  {dist.map((d) => (
                    <div key={d.band} style={{ width: `${(d.customers / total) * 100}%`, background: RISK[d.band].markVar }} className="first:rounded-l-full last:rounded-r-full" />
                  ))}
                </div>
                <dl className="mt-6 grid grid-cols-3 gap-4">
                  {dist.map((d) => (
                    <div key={d.band}>
                      <dt className="flex items-center gap-2 text-sm font-semibold">
                        <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: RISK[d.band].markVar }} />
                        {RISK[d.band].short}
                      </dt>
                      <dd className="font-display-opsz num mt-1 text-4xl leading-none font-light">{int(d.customers)}</dd>
                      <dd className="mt-1 text-xs text-ink-3">{pct(d.customers / total)} of customers</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <Skeleton className="h-32 w-full rounded-2xl" />
            )}
            <p className="mt-6 border-t border-line pt-4 text-xs text-ink-3">Live from the scored customer base. These customers were part of the model’s training data, so their scores are optimistic.</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

function useFeatured(members: Member[]) {
  const id = members.find((m) => m.risk === 'high' && m.id !== null)?.id ?? null
  return id
}

export function ExplainSection({ members }: { members: Member[] }) {
  const id = useFeatured(members)
  const { data, isPending, isError, error, refetch } = useExplanation(id ?? Number.NaN)
  const shap = data?.explanations.find((e) => e.method === 'shap')

  return (
    <section id="explain" className="scroll-mt-24 bg-charcoal text-ivory">
      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 md:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <Reveal>
          <Eyebrow light>Explainability</Eyebrow>
          <h2 className="font-display-opsz text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] font-medium">
            Every score comes <em className="font-light text-sage italic">with its reasons.</em>
          </h2>
          <p className="mt-5 max-w-md text-[1.0625rem] text-sage">
            SHAP breaks each prediction into the contribution of every attribute. The contributions are exact: starting from the model’s baseline and adding them up lands precisely on the prediction.
          </p>
          <ul className="mt-8 space-y-4 text-[0.9375rem] text-ivory/90">
            <li className="flex gap-3"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-eucalyptus" />Shown in log-odds with the matching odds multiplier, never mislabelled as percentage points.</li>
            <li className="flex gap-3"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-eucalyptus" />LIME runs alongside as an independent cross-check, with an agreement read-out.</li>
            <li className="flex gap-3"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-eucalyptus" />Hover or focus any bar for the exact value, SHAP number and running prediction.</li>
          </ul>
          {id !== null && (
            <Button asChild variant="outline" className="mt-8 border-sage/40 bg-transparent text-ivory hover:border-ivory hover:bg-ivory/10">
              <Link to={`/customers/${id}`}>
                Open this customer <ArrowRight />
              </Link>
            </Button>
          )}
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-3xl bg-ivory p-5 text-ink shadow-float sm:p-7">
            {id === null ? (
              <p className="p-6 text-center text-ink-3">Connect the API to see a live explanation of a real customer here.</p>
            ) : isPending ? (
              <Skeleton className="h-96 w-full rounded-2xl" />
            ) : isError ? (
              <ErrorState error={error} onRetry={() => refetch()} compact />
            ) : shap ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="eyebrow">A real prediction, explained</p>
                  <RiskBadge risk={data.risk} long />
                </div>
                <WaterfallChart shap={shap} probability={data.probability} risk={data.risk} />
              </>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

export function RetentionSection({ members }: { members: Member[] }) {
  const id = useFeatured(members)
  const customer = useCustomer(id ?? Number.NaN)
  const expl = useExplanation(id ?? Number.NaN)
  const shap = expl.data?.explanations.find((e) => e.method === 'shap')
  const items = customer.data && shap ? suggest(customer.data, shap.values, 3) : []

  return (
    <section id="retain" className="mx-auto grid max-w-[1240px] scroll-mt-24 items-center gap-12 px-5 py-24 md:px-8 lg:grid-cols-2">
      <Reveal className="lg:order-2">
        <Eyebrow>Retention intelligence</Eyebrow>
        <h2 className="font-display-opsz text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] font-medium">
          Turn a score into <em className="font-light text-ink-2 italic">a conversation.</em>
        </h2>
        <p className="mt-5 max-w-lg text-[1.0625rem] text-ink-2">
          From a customer’s strongest risk drivers, Tessera suggests what an account team might raise, and lets you preview how the model would react to a change.
        </p>
        <p className="mt-4 max-w-lg rounded-2xl border border-dashed border-line-strong p-4 text-[0.8125rem] leading-relaxed text-ink-2">
          <strong className="text-ink">Suggestions, not prescriptions.</strong> They are business rules attached to model drivers. Nothing here has been shown to reduce churn, and a simulated drop in probability is not a causal effect.
        </p>
      </Reveal>

      <Reveal delay={0.1} className="lg:order-1">
        <div className="rounded-3xl bg-charcoal p-6 text-ivory shadow-float md:p-8">
          <p className="mb-1 text-xs font-semibold tracking-[0.09em] text-sage uppercase">Retention suggestions</p>
          {customer.data && <p className="mb-5 text-sm text-sage">for @{customer.data.username}</p>}
          {items.length > 0 ? (
            <ol className="divide-y divide-sage/20 border-y border-sage/20">
              {items.map((s, i) => (
                <li key={s.id} className="flex items-start gap-4 py-4">
                  <span aria-hidden="true" className="font-display-opsz text-3xl leading-none font-light text-eucalyptus">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display-opsz text-lg font-medium">{s.title}</h3>
                    <p className="mt-0.5 text-sm text-ivory/85">{s.action}</p>
                    {s.simulate && customer.data && (
                      <Link to={simulatorHref(customer.data.id, s.simulate)} className="mt-2 inline-block text-xs font-semibold text-sage underline decoration-sage/40 underline-offset-4 hover:text-ivory">
                        Preview in simulator →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-sm text-sage">{id === null ? 'Connect the API to see suggestions for a real customer here.' : 'Loading suggestions…'}</p>
          )}
        </div>
      </Reveal>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

export function TrustStrip() {
  const { data } = useModelInfo()
  const test = data ? data.metrics[data.algorithm]?.test : undefined
  return (
    <section aria-label="About the model" className="border-t border-line">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-14 md:px-8 lg:grid-cols-[1fr_2fr] lg:items-center">
        <p className="font-display-opsz text-2xl leading-snug font-medium">Honest about what it can and can’t do.</p>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
          {test && (
            <>
              <div><dt className="text-[0.8125rem] text-ink-3">ROC-AUC (held-out)</dt><dd className="font-display-opsz num text-3xl font-light">{test.roc_auc.toFixed(3)}</dd></div>
              <div><dt className="text-[0.8125rem] text-ink-3">PR-AUC (held-out)</dt><dd className="font-display-opsz num text-3xl font-light">{test.pr_auc.toFixed(3)}</dd></div>
              <div><dt className="text-[0.8125rem] text-ink-3">Recall at threshold</dt><dd className="font-display-opsz num text-3xl font-light">{pct(test.recall)}</dd></div>
            </>
          )}
          {data && <div><dt className="text-[0.8125rem] text-ink-3">Trained</dt><dd className="num mt-1 text-sm font-semibold">{formatDateTime(data.trained_at)}</dd></div>}
        </dl>
      </div>
      <p className="mx-auto max-w-[1240px] px-5 pb-12 text-xs leading-relaxed text-ink-3 md:px-8">
        Metrics are measured on customers the model did not train on. Customers shown in the app were part of its training data, so their individual scores are optimistic. Customers are pseudonymous: names and avatars are generated and do not identify real people.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

export function FinalCta() {
  const { go } = useCurtain()
  return (
    <section className="bg-charcoal text-ivory">
      <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-8 px-5 py-24 md:px-8 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="font-display-opsz max-w-2xl text-[clamp(2.4rem,5vw,4.2rem)] leading-[1] font-medium">
          See your customers <em className="font-light text-sage italic">differently.</em>
        </h2>
        <Button
          asChild
          size="lg"
          className="bg-ivory text-ink hover:bg-sage"
        >
          <a
            href="/dashboard"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              const r = e.currentTarget.getBoundingClientRect()
              go('/dashboard', e.detail === 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY })
            }}
          >
            Explore Dashboard <ArrowRight />
          </a>
        </Button>
      </div>
    </section>
  )
}

export function LandingFooter() {
  return (
    <footer className="bg-charcoal text-sage">
      <div className="mx-auto grid max-w-[1240px] gap-6 border-t border-sage/20 px-5 py-10 text-xs leading-relaxed md:grid-cols-2 md:px-8">
        <p>© Tessera demo. Built on a public sample dataset; no real customers.</p>
        <p className="md:text-right">
          Avatars: DiceBear “Lorelei” by Lisa Wischofsky (CC0 1.0). Type: Manrope and Fraunces (SIL OFL 1.1). Icons: Lucide (ISC). Full list in <code>ATTRIBUTION.md</code>.
        </p>
      </div>
    </footer>
  )
}
