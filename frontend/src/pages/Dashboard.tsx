import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/states'
import { Reveal } from '@/components/Reveal'
import { ChurnIllustration } from '@/features/dashboard/ChurnIllustration'
import { KpiStrip } from '@/features/dashboard/KpiStrip'
import { RiskHistogram } from '@/features/dashboard/RiskHistogram'
import { SegmentBars } from '@/features/dashboard/SegmentBars'
import { RecentActivity } from '@/features/dashboard/RecentActivity'
import { Insights } from '@/features/dashboard/Insights'
import { useModelInfo, useOverview } from '@/api/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDateTime } from '@/lib/format'

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="eyebrow mb-2">{eyebrow}</p>
      <h2 className="font-display-opsz text-[1.65rem] leading-tight font-medium">{title}</h2>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-4 pt-14 pb-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-14 w-full max-w-xl" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <div className="grid grid-cols-2 gap-6 border-y border-line py-7 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      <div className="mt-14 grid gap-14 lg:grid-cols-12">
        <Skeleton className="h-96 rounded-2xl lg:col-span-7" />
        <Skeleton className="h-96 rounded-2xl lg:col-span-5" />
      </div>
    </div>
  )
}

function ModelFootnote() {
  const { data } = useModelInfo()
  if (!data) return null
  const test = data.metrics[data.algorithm]?.test
  return (
    <p className="mt-16 border-t border-line pt-5 text-xs leading-relaxed text-ink-3">
      Scores come from <span className="num font-semibold text-ink-2">{data.model_version}</span>, trained {formatDateTime(data.trained_at)} on {data.n_train.toLocaleString('en-US')} customers
      {test && (
        <>
          . On {data.n_test.toLocaleString('en-US')} held-out customers it reaches ROC-AUC <span className="num">{test.roc_auc.toFixed(3)}</span> and PR-AUC{' '}
          <span className="num">{test.pr_auc.toFixed(3)}</span>
        </>
      )}
      . Customers in this directory were part of its training data, so their individual scores are optimistic compared with brand-new customers.
    </p>
  )
}

export default function Dashboard() {
  useDocumentTitle('Dashboard')
  const { data: overview, isPending, isError, error, refetch } = useOverview()

  if (isPending) return <DashboardSkeleton />
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  const scored = overview.avg_probability !== null

  return (
    <>
      <PageHeader
        aside={<ChurnIllustration />}
        eyebrow="Customer intelligence"
        title={
          <>
            Who is likely to leave, <em className="font-light text-ink-2 italic">and why.</em>
          </>
        }
        actions={
          <Button asChild size="lg">
            <Link to="/customers?risk=high&sort=risk_desc">
              High-risk customers <ArrowRight />
            </Link>
          </Button>
        }
      >
        Predicted churn risk across {overview.customers.toLocaleString('en-US')} pseudonymous customers. Every number marked “model estimate” comes from the trained model; “observed” numbers come from the dataset.
      </PageHeader>

      <Reveal>
        <KpiStrip overview={overview} />
      </Reveal>

      {!scored ? (
        <div className="mt-14 rounded-2xl border border-line-strong bg-paper p-8">
          <h2 className="font-display-opsz text-2xl font-medium">Scores aren’t available yet</h2>
          <p className="mt-2 max-w-xl text-ink-2">
            The customer base is loaded but the model hasn’t scored it. Run the setup job (or <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">python -m src.models.precompute</code>) and refresh.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-16 grid gap-14 lg:grid-cols-12">
            <Reveal className="lg:col-span-7">
              <SectionHead eyebrow="Churn risk distribution" title="How predicted risk is spread" />
              <RiskHistogram overview={overview} />
            </Reveal>
            <Reveal delay={0.08} className="lg:col-span-5">
              <SectionHead eyebrow="Segments" title="Where risk concentrates" />
              <SegmentBars overview={overview} />
            </Reveal>
          </div>

          <div className="mt-20 grid gap-14 lg:grid-cols-12">
            <Reveal className="lg:col-span-7 lg:order-2">
              <SectionHead eyebrow="Retention insights" title="What the numbers point to" />
              <Insights overview={overview} />
            </Reveal>
            <Reveal delay={0.08} className="lg:col-span-5 lg:order-1">
              <SectionHead eyebrow="Recent prediction activity" title="Latest simulations" />
              <RecentActivity />
            </Reveal>
          </div>
        </>
      )}

      <ModelFootnote />
    </>
  )
}
