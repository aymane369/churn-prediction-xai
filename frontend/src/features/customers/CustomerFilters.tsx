import { useEffect, useState } from 'react'
import { LayoutGrid, Search, Table2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { RISK } from '@/lib/risk'
import { SORTS, TENURE_BANDS, hasFilters, tenureValue, type DirectoryState, type View, withChanges } from '@/features/customers/params'
import type { Risk, SortKey } from '@/types/api'

type Update = (changes: Parameters<typeof withChanges>[1]) => void

const ALL = 'all'

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-10 min-w-36 rounded-full border-line-strong bg-paper px-4 text-sm font-medium shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CustomerFilters({ state, update, onClear }: { state: DirectoryState; update: Update; onClear: () => void }) {
  // Search is debounced locally, then written to the URL
  const [text, setText] = useState(state.q)
  useEffect(() => setText(state.q), [state.q])
  useEffect(() => {
    if (text.trim() === state.q.trim()) return
    const id = setTimeout(() => update({ q: text }), 250)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  const tenure = tenureValue(state)
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (state.q.trim()) chips.push({ key: 'q', label: `Search: “${state.q.trim()}”`, clear: () => update({ q: '' }) })
  if (state.risk) chips.push({ key: 'risk', label: RISK[state.risk].label, clear: () => update({ risk: undefined }) })
  if (state.contract) chips.push({ key: 'contract', label: state.contract, clear: () => update({ contract: undefined }) })
  if (state.internet) chips.push({ key: 'internet', label: state.internet === 'No' ? 'No internet' : `${state.internet} internet`, clear: () => update({ internet: undefined }) })
  if (state.outcome) chips.push({ key: 'outcome', label: state.outcome === 'churned' ? 'Churned in data' : 'Active in data', clear: () => update({ outcome: undefined }) })
  if (tenure !== 'all')
    chips.push({
      key: 'tenure',
      label: tenure === 'custom' ? `Tenure ${state.tenureMin ?? 0}${state.tenureMax !== undefined ? `–${state.tenureMax}` : '+'} mo` : (TENURE_BANDS.find((b) => b.value === tenure)?.label ?? tenure),
      clear: () => update({ tenure: 'all' }),
    })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1" role="search">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <Input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search by pseudonym, e.g. witty_alpaca"
            aria-label="Search customers by pseudonym"
            className="h-11 rounded-full border-line-strong bg-paper pr-4 pl-11 text-[0.9375rem] shadow-none"
          />
        </div>
        <ToggleGroup
          type="single"
          value={state.view}
          onValueChange={(v) => v && update({ view: v as View })}
          aria-label="View"
          className="h-11 gap-1 rounded-full border border-line-strong bg-paper p-1"
        >
          <ToggleGroupItem value="cards" aria-label="Card view" className="rounded-full px-3.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <LayoutGrid className="size-4" /> <span className="text-sm font-semibold">Cards</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view" className="rounded-full px-3.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <Table2 className="size-4" /> <span className="text-sm font-semibold">Table</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <ToggleGroup
          type="single"
          value={state.risk ?? ALL}
          onValueChange={(v) => v && update({ risk: v === ALL ? undefined : (v as Risk) })}
          aria-label="Risk level"
          className="gap-1 rounded-full border border-line-strong bg-paper p-1"
        >
          {[ALL, 'low', 'medium', 'high'].map((v) => (
            <ToggleGroupItem
              key={v}
              value={v}
              className="h-8 rounded-full px-3.5 text-sm font-semibold text-ink-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:bg-sunken data-[state=on]:hover:bg-primary"
            >
              {v !== ALL && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: RISK[v as Risk].markVar }} />}
              {v === ALL ? 'All risk' : RISK[v as Risk].short}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <FilterSelect
          label="Contract"
          value={state.contract ?? ALL}
          onChange={(v) => update({ contract: v === ALL ? undefined : v })}
          options={[{ value: ALL, label: 'Any contract' }, ...['Month-to-month', 'One year', 'Two year'].map((v) => ({ value: v, label: v }))]}
        />
        <FilterSelect
          label="Internet service"
          value={state.internet ?? ALL}
          onChange={(v) => update({ internet: v === ALL ? undefined : v })}
          options={[
            { value: ALL, label: 'Any internet' },
            { value: 'DSL', label: 'DSL' },
            { value: 'Fiber optic', label: 'Fiber optic' },
            { value: 'No', label: 'No internet' },
          ]}
        />
        <FilterSelect
          label="Tenure"
          value={tenure}
          onChange={(v) => update({ tenure: v })}
          options={[...(tenure === 'custom' ? [{ value: 'custom', label: 'Custom range' }] : []), ...TENURE_BANDS.map((b) => ({ value: b.value, label: b.label }))]}
        />
        <FilterSelect
          label="Account status in the data"
          value={state.outcome ?? ALL}
          onChange={(v) => update({ outcome: v === ALL ? undefined : (v as 'active' | 'churned') })}
          options={[
            { value: ALL, label: 'Any status' },
            { value: 'active', label: 'Active' },
            { value: 'churned', label: 'Churned' },
          ]}
        />
        <div className="sm:ml-auto">
          <FilterSelect label="Sort by" value={state.sort} onChange={(v) => update({ sort: v as SortKey })} options={SORTS} />
        </div>
      </div>

      {hasFilters(state) && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              aria-label={`Remove filter: ${c.label}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-2 pl-3 text-[0.8125rem] font-semibold text-ink transition-colors hover:bg-sage"
            >
              {c.label}
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ))}
          <Button variant="link" size="sm" onClick={onClear}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
