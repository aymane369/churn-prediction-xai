import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState } from '@/components/states'
import { CustomerFilters } from '@/features/customers/CustomerFilters'
import { CustomerCard } from '@/features/customers/CustomerCard'
import { CustomerTable } from '@/features/customers/CustomerTable'
import { Pagination } from '@/features/customers/Pagination'
import { PAGE_SIZE, hasFilters, parseParams, toQuery, withChanges } from '@/features/customers/params'
import { useCustomers } from '@/api/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { int } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SortKey } from '@/types/api'

function ListSkeleton({ view }: { view: 'cards' | 'table' }) {
  if (view === 'table') {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading customers">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Loading customers">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-72 rounded-2xl" />
      ))}
    </div>
  )
}

export default function Customers() {
  useDocumentTitle('Customers')
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const state = parseParams(params)
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useCustomers(toQuery(state))

  const update = (changes: Parameters<typeof withChanges>[1]) => setParams(withChanges(params, changes), { replace: false })
  const clearAll = () => setParams(withChanges(new URLSearchParams(), { view: state.view }))

  // Back to the top when paging, so the new page starts where the eye is
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [state.page])

  const size = PAGE_SIZE[state.view]
  const back = location.search

  return (
    <>
      <PageHeader eyebrow="Customer directory" title={<>Find a customer, <em className="font-light text-ink-2 italic">understand the risk.</em></>}>
        Every customer has a stable illustrated avatar and a pseudonym generated from an internal seed. They are not real people, and the names do not identify anyone.
      </PageHeader>

      <CustomerFilters state={state} update={update} onClear={clearAll} />

      <section aria-label="Customers" className="mt-8">
        {isPending ? (
          <ListSkeleton view={state.view} />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : data.items.length === 0 ? (
          <EmptyState
            title="No customers match these filters"
            className="rounded-2xl border border-dashed border-line-strong"
            action={
              hasFilters(state) ? (
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          >
            Try widening the risk level or tenure range, or search for a different pseudonym.
          </EmptyState>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-3" aria-live="polite">
              <span className="num font-semibold text-ink">{int(data.total)}</span> {data.total === 1 ? 'customer' : 'customers'}
            </p>
            <div className={cn('transition-opacity duration-200', isPlaceholderData && 'opacity-60')}>
              {state.view === 'cards' ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {data.items.map((c, i) => (
                    <CustomerCard key={c.id} customer={c} index={i} back={back} />
                  ))}
                </div>
              ) : (
                <CustomerTable customers={data.items} sort={state.sort} onSort={(s: SortKey) => update({ sort: s })} back={back} />
              )}
            </div>
            <Pagination page={state.page} size={size} total={data.total} onPage={(p) => update({ page: p })} />
          </>
        )}
      </section>
    </>
  )
}
