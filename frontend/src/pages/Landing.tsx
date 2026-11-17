import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { useCurtain } from '@/components/layout/Curtain'
import { Constellation } from '@/features/landing/Constellation'
import { useLandingMembers } from '@/features/landing/data'
import { ExplainSection, FinalCta, LandingFooter, PredictionSection, RetentionSection, Steps, TrustStrip } from '@/features/landing/Sections'
import { useOverview } from '@/api/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { int } from '@/lib/format'

function useGo() {
  const { go } = useCurtain()
  // Anchor-based CTAs keep native link behaviour (middle click, copy link) while playing the transition on a normal click
  return (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    go(to, e.detail === 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: e.clientX, y: e.clientY })
  }
}

function LandingNav() {
  const onGo = useGo()
  const links = [
    ['How it works', '#how'],
    ['Prediction', '#predict'],
    ['Explainability', '#explain'],
    ['Retention', '#retain'],
  ]
  return (
    <header className="relative z-20 mx-auto flex h-20 max-w-[1240px] items-center justify-between px-5 md:px-8">
      <a href="/" aria-label="Tessera home" className="rounded-md">
        <Logo />
      </a>
      <nav aria-label="Sections" className="hidden items-center gap-1 rounded-full border border-line bg-paper/80 p-1 shadow-card md:flex">
        {links.map(([label, href]) => (
          <a key={href} href={href} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-sunken hover:text-ink">
            {label}
          </a>
        ))}
      </nav>
      <Button asChild size="sm">
        <a href="/dashboard" onClick={(e) => onGo(e, '/dashboard')}>
          Open dashboard
        </a>
      </Button>
    </header>
  )
}

const HEADLINE = ['Predict.', 'Explain.', 'Retain.']

export default function Landing() {
  useDocumentTitle('Predict. Explain. Retain.')
  const reduce = useReducedMotion()
  const onGo = useGo()
  const { members, live } = useLandingMembers()
  const { data: overview } = useOverview()

  return (
    <div className="bg-ivory">
      <section
        className="grain relative overflow-hidden"
        style={{
          background:
            'radial-gradient(70% 60% at 78% 28%, #dde6da 0%, transparent 62%), radial-gradient(55% 50% at 6% 96%, #ebe3d0 0%, transparent 62%), radial-gradient(40% 40% at 50% 0%, #e4eadf 0%, transparent 70%), var(--ivory)',
        }}
      >
        <LandingNav />
        <div className="relative z-10 mx-auto grid max-w-[1240px] items-center gap-14 px-5 pt-8 pb-28 md:px-8 lg:grid-cols-[1.02fr_1fr] lg:pt-14 lg:pb-32">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-line-strong bg-paper/70 px-3.5 py-1.5 text-xs font-semibold text-ink-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-eucalyptus" /> Customer churn intelligence
            </p>
            <h1 className="font-display-opsz text-[clamp(3.6rem,10vw,7.6rem)] leading-[0.9] font-light">
              {HEADLINE.map((word, i) => (
                <motion.span
                  key={word}
                  className="block overflow-hidden pb-[0.08em]"
                  initial={reduce ? false : { opacity: 0, y: 36 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {i === 1 ? <em className="font-light text-ink-2 italic">{word}</em> : word}
                </motion.span>
              ))}
            </h1>
            <motion.p
              className="mt-8 max-w-lg text-[1.125rem] leading-relaxed text-ink-2"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
            >
              Tessera estimates which customers are likely to leave, then shows exactly why, attribute by attribute, so a retention team knows what to look at first.
            </motion.p>
            <motion.div
              className="mt-9 flex flex-wrap items-center gap-3"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <Button asChild size="lg">
                <a href="/dashboard" onClick={(e) => onGo(e, '/dashboard')}>
                  Explore Dashboard <ArrowRight />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#explain">See an explanation</a>
              </Button>
            </motion.div>
            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6 text-sm">
              {overview && (
                <div>
                  <dt className="text-ink-3">Customers scored</dt>
                  <dd className="font-display-opsz num text-2xl">{int(overview.customers)}</dd>
                </div>
              )}
              <div>
                <dt className="text-ink-3">Explanations</dt>
                <dd className="font-display-opsz text-2xl">SHAP + LIME</dd>
              </div>
              <div>
                <dt className="text-ink-3">What-ifs</dt>
                <dd className="font-display-opsz text-2xl">Labelled hypothetical</dd>
              </div>
            </dl>
          </div>

          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            className="px-8"
          >
            <Constellation members={members} live={live} />
          </motion.div>
        </div>
      </section>

      <Steps />
      <PredictionSection />
      <ExplainSection members={members} />
      <RetentionSection members={members} />
      <TrustStrip />
      <FinalCta />
      <LandingFooter />
    </div>
  )
}
