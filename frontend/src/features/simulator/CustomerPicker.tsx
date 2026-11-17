import { useState } from 'react'
import { ChevronsUpDown, Search } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { RiskBadge } from '@/components/RiskBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCustomers } from '@/api/queries'
import { customerCode, pct } from '@/lib/format'
import type { Customer } from '@/types/api'

export function CustomerPicker({ current, onPick }: { current: Customer | undefined; onPick: (id: number | null) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const { data, isFetching } = useCustomers({ search: text.trim() || undefined, limit: 6, sort: 'risk_desc' })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* The accessible name starts with the visible text (WCAG 2.5.3 "Label in Name") */}
        <Button
          variant="outline"
          className="h-12 w-full justify-between rounded-2xl px-3 sm:w-auto sm:min-w-72"
          aria-label={`${current ? `@${current.username}` : 'Illustrative profile (no customer)'}, choose a customer to start from`}
        >
          {current ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar seed={current.avatar_seed} name={current.username} size={30} decorative />
              <span className="truncate font-semibold">@{current.username}</span>
            </span>
          ) : (
            <span className="text-ink-2">Illustrative profile (no customer)</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search pseudonym" aria-label="Search customers" className="h-10 rounded-full pl-9" autoFocus />
        </div>
        <ul className="mt-2 max-h-72 overflow-y-auto" aria-busy={isFetching}>
          <li>
            <button
              type="button"
              className="w-full rounded-lg px-2 py-2 text-left text-sm text-ink-2 hover:bg-sunken"
              onClick={() => {
                onPick(null)
                setOpen(false)
              }}
            >
              Use the illustrative profile
            </button>
          </li>
          {data?.items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-sunken"
                onClick={() => {
                  onPick(c.id)
                  setOpen(false)
                }}
              >
                <Avatar seed={c.avatar_seed} name={c.username} size={32} decorative />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">@{c.username}</span>
                  <span className="eyebrow !text-[0.6875rem]">{customerCode(c.id)}</span>
                </span>
                <span className="num text-sm text-ink-2">{c.churn_probability !== null ? pct(c.churn_probability) : ''}</span>
                <RiskBadge risk={c.risk} />
              </button>
            </li>
          ))}
          {data && data.items.length === 0 && <li className="px-2 py-4 text-center text-sm text-ink-3">No customers match “{text}”.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
