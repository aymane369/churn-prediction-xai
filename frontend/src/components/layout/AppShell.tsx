import { Suspense } from 'react'
import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Menu } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { StatusChip } from '@/components/layout/StatusChip'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/customers', label: 'Customers' },
  { to: '/simulator', label: 'What-if simulator' },
] as const

function PillNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Main" className={cn('flex items-center gap-1 rounded-full border border-line bg-paper p-1 shadow-card', className)}>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200',
              isActive ? 'bg-primary text-primary-foreground' : 'text-ink-2 hover:bg-sunken hover:text-ink',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function PageFallback() {
  return (
    <div className="space-y-6 pt-14" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  )
}

/** Header + animated page outlet. The old page stays mounted while it exits so shared elements (the
 *  customer avatar) can travel between the directory and the profile. */
export function AppShell() {
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-ivory">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5 md:px-8">
          <Link to="/" aria-label="Tessera home" className="rounded-md">
            <Logo />
          </Link>

          <PillNav className="hidden md:flex" />

          <div className="flex items-center gap-2">
            <StatusChip className="hidden sm:inline-flex" />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-ivory">
                <SheetHeader>
                  <SheetTitle className="font-display-opsz text-xl font-medium">Menu</SheetTitle>
                </SheetHeader>
                <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
                  {NAV.map((item) => (
                    <SheetClose asChild key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          cn('rounded-xl px-4 py-3 text-base font-semibold', isActive ? 'bg-primary text-primary-foreground' : 'text-ink-2 hover:bg-sunken')
                        }
                      >
                        {item.label}
                      </NavLink>
                    </SheetClose>
                  ))}
                  <SheetClose asChild>
                    <Link to="/" className="rounded-xl px-4 py-3 text-base font-semibold text-ink-2 hover:bg-sunken">
                      Overview page
                    </Link>
                  </SheetClose>
                </nav>
                <div className="px-4 pt-4">
                  <StatusChip />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-[1240px] px-5 pb-24 md:px-8">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Suspense fallback={<PageFallback />}>{outlet}</Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-5 py-8 text-xs text-ink-3 md:flex-row md:justify-between md:px-8">
          <p>
            Customers are pseudonymous: usernames and avatars are generated from an internal seed and do not identify real people.
          </p>
          <p>
            <Link to="/" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              About Tessera
            </Link>
            {' · '}
            <a href="/docs" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              API docs
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
