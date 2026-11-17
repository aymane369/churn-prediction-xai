import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { int } from '@/lib/format'
import { cn } from '@/lib/utils'

/** 1 … 4 5 6 … 294: always includes first, last and a window around the current page. */
function pageWindow(page: number, count: number): (number | 'gap')[] {
  const wanted = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count))
  const sorted = [...wanted].sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap')
    out.push(p)
  })
  return out
}

export function Pagination({
  page,
  size,
  total,
  onPage,
}: {
  page: number
  size: number
  total: number
  onPage: (p: number) => void
}) {
  const count = Math.max(1, Math.ceil(total / size))
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(total, page * size)

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
      <p className="text-sm text-ink-3" aria-live="polite">
        Showing <span className="num font-semibold text-ink">{int(from)}–{int(to)}</span> of <span className="num font-semibold text-ink">{int(total)}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft aria-hidden="true" /> Previous
        </Button>
        <ul className="mx-1 hidden items-center gap-1 sm:flex">
          {pageWindow(page, count).map((p, i) =>
            p === 'gap' ? (
              <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-3">
                …
              </li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => onPage(p)}
                  aria-label={`Page ${p}`}
                  aria-current={p === page ? 'page' : undefined}
                  className={cn(
                    'num h-8 min-w-8 rounded-full px-2 text-sm font-semibold transition-colors',
                    p === page ? 'bg-primary text-primary-foreground' : 'text-ink-2 hover:bg-sunken',
                  )}
                >
                  {p}
                </button>
              </li>
            ),
          )}
        </ul>
        <span className="mx-2 text-sm text-ink-3 sm:hidden">
          Page {page} of {count}
        </span>
        <Button variant="outline" size="sm" disabled={page >= count} onClick={() => onPage(page + 1)}>
          Next <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
