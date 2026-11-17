import { Check, Minus, X } from 'lucide-react'
import { money } from '@/lib/format'
import type { Customer } from '@/types/api'

function YesNo({ value }: { value: boolean | string }) {
  const yes = value === true || value === 'Yes'
  const none = typeof value === 'string' && value.startsWith('No ') // "No internet service" / "No phone service"
  const Icon = yes ? Check : none ? Minus : X
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={`size-3.5 ${yes ? 'text-risk-low' : 'text-ink-3'}`} aria-hidden="true" />
      <span>{yes ? 'Yes' : none ? 'Not available' : 'No'}</span>
    </span>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow mb-3 border-b border-line pb-2">{title}</h3>
      <dl className="space-y-2.5 text-sm">{children}</dl>
    </div>
  )
}
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4">
    <dt className="text-ink-3">{label}</dt>
    <dd className="text-right font-semibold">{children}</dd>
  </div>
)

export function AccountDetails({ c }: { c: Customer }) {
  return (
    <div className="grid gap-10 md:grid-cols-3">
      <Group title="Household">
        <Row label="Gender">{c.gender}</Row>
        <Row label="Senior citizen"><YesNo value={c.senior_citizen} /></Row>
        <Row label="Partner"><YesNo value={c.partner} /></Row>
        <Row label="Dependents"><YesNo value={c.dependents} /></Row>
      </Group>
      <Group title="Services">
        <Row label="Phone"><YesNo value={c.phone_service} /></Row>
        <Row label="Multiple lines"><YesNo value={c.multiple_lines} /></Row>
        <Row label="Internet">{c.internet_service === 'No' ? 'None' : c.internet_service}</Row>
        <Row label="Online security"><YesNo value={c.online_security} /></Row>
        <Row label="Online backup"><YesNo value={c.online_backup} /></Row>
        <Row label="Device protection"><YesNo value={c.device_protection} /></Row>
        <Row label="Tech support"><YesNo value={c.tech_support} /></Row>
        <Row label="Streaming TV"><YesNo value={c.streaming_tv} /></Row>
        <Row label="Streaming movies"><YesNo value={c.streaming_movies} /></Row>
      </Group>
      <Group title="Billing">
        <Row label="Contract">{c.contract}</Row>
        <Row label="Paperless billing"><YesNo value={c.paperless_billing} /></Row>
        <Row label="Payment method">{c.payment_method}</Row>
        <Row label="Monthly charges"><span className="num">{money(c.monthly_charges)}</span></Row>
        <Row label="Total charges"><span className="num">{money(c.total_charges)}</span></Row>
      </Group>
    </div>
  )
}
