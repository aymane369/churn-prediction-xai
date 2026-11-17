import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { RiskBadge } from '@/components/RiskBadge'
import { ProbabilityBar } from '@/components/ProbabilityBar'
import { StatusPill } from '@/features/customers/StatusPill'
import { customerCode, money, tenureLabel } from '@/lib/format'
import type { Customer, SortKey } from '@/types/api'

type Column = { label: string; asc?: SortKey; desc?: SortKey; className?: string }

const COLUMNS: Column[] = [
  { label: 'Customer' },
  { label: 'Status' },
  { label: 'Subscription' },
  { label: 'Tenure', asc: 'tenure_asc', desc: 'tenure_desc', className: 'text-right' },
  { label: 'Monthly', desc: 'charges_desc', className: 'text-right' },
  { label: 'Churn probability', asc: 'risk_asc', desc: 'risk_desc' },
  { label: 'Risk' },
]

function SortHeader({ col, sort, onSort }: { col: Column; sort: SortKey; onSort: (s: SortKey) => void }) {
  const sortable = col.asc || col.desc
  const active = sort === col.asc ? 'ascending' : sort === col.desc ? 'descending' : 'none'
  const Icon = active === 'ascending' ? ArrowUp : active === 'descending' ? ArrowDown : ChevronsUpDown
  const next = () => (active === 'descending' && col.asc ? col.asc : (col.desc ?? col.asc)!)
  return (
    <th scope="col" aria-sort={sortable ? active : undefined} className={`px-4 py-3 text-left text-xs font-semibold tracking-wide text-ink-3 uppercase ${col.className ?? ''}`}>
      {sortable ? (
        <button type="button" onClick={() => onSort(next())} className={`inline-flex items-center gap-1.5 uppercase hover:text-ink ${active !== 'none' ? 'text-ink' : ''}`}>
          {col.label}
          <Icon className="size-3.5" aria-hidden="true" />
        </button>
      ) : (
        col.label
      )}
    </th>
  )
}

export function CustomerTable({ customers, sort, onSort, back }: { customers: Customer[]; sort: SortKey; onSort: (s: SortKey) => void; back: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-paper shadow-card">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <caption className="sr-only">Customers. Column headers with buttons sort the whole list.</caption>
        <thead className="border-b border-line bg-sunken/50">
          <tr>
            {COLUMNS.map((c) => (
              <SortHeader key={c.label} col={c} sort={sort} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {customers.map((c) => (
            // The link in the first cell stretches over the whole row, so the row is clickable and keyboard accessible
            <tr key={c.id} className="relative transition-colors duration-150 hover:bg-sunken/60">
              <td className="px-4 py-3">
                <Link
                  to={`/customers/${c.id}`}
                  state={{ back }}
                  className="flex items-center gap-3 rounded-md after:absolute after:inset-0 after:content-['']"
                >
                  <Avatar seed={c.avatar_seed} name={c.username} size={40} decorative layoutId={`avatar-${c.id}`} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">@{c.username}</span>
                    <span className="eyebrow !text-[0.6875rem]">{customerCode(c.id)}</span>
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatusPill churned={c.churn} />
              </td>
              <td className="px-4 py-3 text-ink-2">{c.contract}</td>
              <td className="num px-4 py-3 text-right text-ink-2">{tenureLabel(c.tenure)}</td>
              <td className="num px-4 py-3 text-right text-ink-2">{money(c.monthly_charges)}</td>
              <td className="w-56 px-4 py-3">
                <ProbabilityBar probability={c.churn_probability} risk={c.risk} />
              </td>
              <td className="px-4 py-3">
                <RiskBadge risk={c.risk} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
