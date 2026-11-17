import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** Live model / API status. Tells the user at a glance whether the numbers on screen are real. */
export function StatusChip({ className }: { className?: string }) {
  const { data, isError, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => api.health(signal),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  })

  const state = isPending ? 'checking' : isError ? 'offline' : data?.model ? 'live' : 'no-model'
  const label = {
    checking: 'Checking…',
    offline: 'API offline',
    live: `Model ${data?.model?.split('-').pop() ?? ''}`,
    'no-model': 'No model',
  }[state]
  const dot = { checking: 'bg-info-mark', offline: 'bg-risk-high-mark', live: 'bg-risk-low-mark', 'no-model': 'bg-risk-medium-mark' }[state]
  const detail =
    state === 'live'
      ? `Live predictions from ${data?.model}. Cache ${data?.cache}.`
      : state === 'offline'
        ? 'The API can’t be reached. Pages will show an error until it returns.'
        : state === 'no-model'
          ? 'The API is up but no trained model is loaded.'
          : 'Contacting the API…'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn('inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-2', className)}
        >
          <span className={cn('size-2 rounded-full', dot, state === 'live' && 'motion-safe:animate-pulse')} aria-hidden="true" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  )
}
