import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Page title block. With `aside` (a picture) the header becomes two columns: the text and its
 * action on the left, the picture on the right sitting flush on the line that follows the header.
 */
export function PageHeader({
  eyebrow,
  title,
  children,
  actions,
  aside,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
  aside?: ReactNode
  className?: string
}) {
  const text = (
    <div className={cn('max-w-2xl', aside ? 'pb-8' : '')}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h1 className="font-display-opsz text-[2.4rem] leading-[1.05] font-medium md:text-[3.2rem]">{title}</h1>
      {children && <p className="lead mt-5 max-w-xl">{children}</p>}
      {aside && actions && <div className="mt-7 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )

  if (aside) {
    return (
      <header className={cn('grid items-end gap-x-8 gap-y-6 pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] md:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]', className)}>
        {text}
        <div className="mx-auto w-full max-w-sm md:mx-0 md:max-w-none">{aside}</div>
      </header>
    )
  }

  return (
    <header className={cn('flex flex-col gap-5 pb-8 pt-10 md:flex-row md:items-end md:justify-between md:pt-14', className)}>
      {text}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
