import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-5 pb-8 pt-10 md:flex-row md:items-end md:justify-between md:pt-14', className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="font-display-opsz text-[2.4rem] leading-[1.05] font-medium md:text-[3.2rem]">{title}</h1>
        {children && <p className="mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-ink-2">{children}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
