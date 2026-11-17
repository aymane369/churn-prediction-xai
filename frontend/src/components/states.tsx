import type { ReactNode } from 'react'
import { AlertTriangle, DatabaseZap, SearchX, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/api/client'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-14 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-full bg-sunken text-ink-3">
        <SearchX className="size-5" aria-hidden="true" />
      </span>
      <h3 className="font-display-opsz text-xl font-medium">{title}</h3>
      {children && <p className="max-w-sm text-ink-3">{children}</p>}
      {action}
    </div>
  )
}

/** Explains *what* failed in plain terms and offers a retry; never shows a stack trace. */
export function ErrorState({
  error,
  onRetry,
  className,
  compact,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
  compact?: boolean
}) {
  const e = error instanceof ApiError ? error : null
  let Icon = AlertTriangle
  let title = 'Something went wrong'
  let body = e?.message ?? 'The request failed. Please try again.'
  if (e?.kind === 'network') {
    Icon = WifiOff
    title = 'Can’t reach the server'
    body = 'The API isn’t responding. Check that the stack is running, then try again.'
  } else if (e?.isModelUnavailable) {
    Icon = DatabaseZap
    title = 'The model isn’t available yet'
    body = 'No trained model was found. Run the setup job (or `python -m src.models.train`) and reload.'
  } else if (e?.status === 404) {
    title = 'Not found'
  }
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 text-center', compact ? 'px-4 py-8' : 'px-6 py-16', className)}>
      <span className="grid size-12 place-items-center rounded-full bg-risk-high-soft text-risk-high">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="font-display-opsz text-xl font-medium">{title}</h3>
      <p className="max-w-md text-ink-3">{body}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
