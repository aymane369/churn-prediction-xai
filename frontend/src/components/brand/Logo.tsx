import { cn } from '@/lib/utils'

/** The Tessera mark: four tiles, one of them coral (the customer who needs attention). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-7', className)}>
      <rect width="32" height="32" rx="8" fill="var(--charcoal)" />
      <rect x="6" y="6" width="9" height="9" rx="2" fill="#b8c6b7" />
      <rect x="17" y="6" width="9" height="9" rx="2" fill="#87a99c" />
      <rect x="6" y="17" width="9" height="9" rx="2" fill="#87a99c" />
      <rect x="17" y="17" width="9" height="9" rx="2" fill="#d99074" />
    </svg>
  )
}

export function Logo({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span
        className={cn(
          'font-display-opsz text-[1.35rem] leading-none font-medium',
          tone === 'light' ? 'text-ivory' : 'text-ink',
        )}
      >
        Tessera
      </span>
    </span>
  )
}
