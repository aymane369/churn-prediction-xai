import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states'
import { Reveal } from '@/components/Reveal'
import { ProfileHero } from '@/features/profile/ProfileHero'
import { ExplainerSection } from '@/features/profile/ExplainerSection'
import { Recommendations } from '@/features/profile/Recommendations'
import { AccountDetails } from '@/features/profile/AccountDetails'
import { useCustomer, useExplanation, useOverview } from '@/api/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="eyebrow mb-2">{eyebrow}</p>
      <h2 className="font-display-opsz text-[1.9rem] leading-tight font-medium">{title}</h2>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="pt-8" aria-busy="true" aria-label="Loading customer">
      <Skeleton className="h-52 w-full rounded-3xl" />
      <div className="mt-8 grid gap-8 md:grid-cols-12">
        <div className="space-y-4 md:col-span-7">
          <Skeleton className="-mt-16 size-32 rounded-full" />
          <Skeleton className="h-12 w-80 max-w-full" />
          <Skeleton className="h-6 w-64" />
        </div>
        <Skeleton className="h-80 rounded-3xl md:col-span-5" />
      </div>
    </div>
  )
}

export default function CustomerProfile() {
  const { id: raw } = useParams()
  const id = Number(raw)
  const location = useLocation()
  const back = (location.state as { back?: string } | null)?.back ?? ''

  const customer = useCustomer(id)
  const explanation = useExplanation(id)
  const overview = useOverview()
  useDocumentTitle(customer.data ? `@${customer.data.username}` : 'Customer')

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="-ml-3 mt-6">
      <Link to={`/customers${back}`}>
        <ArrowLeft /> All customers
      </Link>
    </Button>
  )

  if (!Number.isInteger(id) || id < 1) return <ErrorState error={null} className="pt-20" />
  if (customer.isPending || explanation.isPending) return (<>{backLink}<ProfileSkeleton /></>)
  if (customer.isError) return (<>{backLink}<ErrorState error={customer.error} onRetry={() => customer.refetch()} /></>)
  if (explanation.isError)
    return (
      <>
        {backLink}
        <ErrorState error={explanation.error} onRetry={() => explanation.refetch()} />
      </>
    )

  const c = customer.data
  const p = explanation.data
  const shap = p.explanations.find((e) => e.method === 'shap')

  return (
    <>
      {backLink}
      <div className="mt-4">
        <ProfileHero customer={c} prediction={p} thresholds={overview.data?.risk_thresholds} />
      </div>

      <Reveal className="mt-20">
        <SectionHead eyebrow="Explainability" title="Why the model predicts this" />
        <ExplainerSection prediction={p} />
      </Reveal>

      {shap && (
        <Reveal className="mt-20">
          <Recommendations customer={c} values={shap.values} />
        </Reveal>
      )}

      <Reveal className="mt-20">
        <SectionHead eyebrow="Account" title="Details" />
        <AccountDetails c={c} />
      </Reveal>
    </>
  )
}
