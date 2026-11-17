import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** Observed account status in the dataset. Deliberately neutral: it is a fact, not a model output. */
export function StatusPill({ churned, className }: { churned: boolean; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold',
            churned ? 'border-line-strong text-ink-2' : 'border-line text-ink-2',
            className,
          )}
        >
          <span
            aria-hidden="true"
            className={cn('size-1.5 rounded-sm', churned ? 'bg-ink-3' : 'bg-transparent ring-1 ring-ink-3 ring-inset')}
          />
          {churned ? 'Churned' : 'Active'}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {churned ? 'This customer left, as recorded in the dataset (observed, not predicted).' : 'This customer was still subscribed in the dataset (observed, not predicted).'}
      </TooltipContent>
    </Tooltip>
  )
}
