import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ADDONS, LABELS } from '@/features/simulator/model'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PredictionInput } from '@/types/api'

type Change = <K extends keyof PredictionInput>(key: K, value: PredictionInput[K]) => void

interface Props {
  value: PredictionInput
  original: PredictionInput
  onChange: Change
}

const segmented = 'h-10 gap-1 rounded-full border border-line-strong bg-paper p-1'
const segItem = 'h-8 rounded-full px-4 text-sm font-semibold text-ink-2 hover:bg-sunken data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary'

function Field({ id, label, changed, children, hint }: { id: string; label: string; changed: boolean; children: ReactNode; hint?: string }) {
  return (
    <div className={cn('rounded-xl border-l-2 py-1 pl-4 transition-colors', changed ? 'border-eucalyptus' : 'border-transparent')}>
      <div className="mb-2 flex items-center gap-2">
        <Label htmlFor={id} className="text-sm font-semibold">
          {label}
        </Label>
        {changed && <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-2">changed</span>}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>}
    </div>
  )
}

function SwitchField({ k, value, original, onChange, disabled, label }: { k: keyof PredictionInput; value: PredictionInput; original: PredictionInput; onChange: Change; disabled?: boolean; label?: string }) {
  const current = value[k]
  const on = current === true || current === 'Yes'
  const changed = current !== original[k]
  const toggle = (v: boolean) => {
    if (typeof current === 'boolean') onChange(k, v as never)
    else onChange(k, (v ? 'Yes' : 'No') as never)
  }
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-xl border-l-2 py-1.5 pl-4', changed ? 'border-eucalyptus' : 'border-transparent', disabled && 'opacity-50')}>
      <Label htmlFor={`f-${k}`} className="text-sm font-medium">
        {label ?? LABELS[k]}
        {changed && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-2">changed</span>}
      </Label>
      <Switch id={`f-${k}`} checked={on} disabled={disabled} onCheckedChange={toggle} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-5">
      <legend className="eyebrow mb-1 w-full border-b border-line pb-2">{title}</legend>
      {children}
    </fieldset>
  )
}

export function Controls({ value, original, onChange }: Props) {
  const noInternet = value.internet_service === 'No'
  const same = <K extends keyof PredictionInput>(k: K) => value[k] === original[k]

  return (
    <div className="space-y-10">
      <Section title="Contract & billing">
        <Field id="f-contract" label="Contract" changed={!same('contract')}>
          <ToggleGroup id="f-contract" type="single" value={value.contract} onValueChange={(v) => v && onChange('contract', v as PredictionInput['contract'])} className={segmented} aria-label="Contract">
            {(['Month-to-month', 'One year', 'Two year'] as const).map((c) => (
              <ToggleGroupItem key={c} value={c} className={segItem}>
                {c === 'Month-to-month' ? 'Monthly' : c}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        <Field id="f-monthly" label="Monthly charges" changed={!same('monthly_charges')}>
          <div className="flex items-center gap-4">
            <Slider id="f-monthly" min={18} max={120} step={0.5} value={[value.monthly_charges]} onValueChange={([v]) => onChange('monthly_charges', v)} aria-label="Monthly charges" />
            <span className="num w-20 shrink-0 text-right text-sm font-semibold">{money(value.monthly_charges)}</span>
          </div>
        </Field>

        <Field id="f-tenure" label="Tenure" changed={!same('tenure')} hint="Total charges move with tenure and monthly charges.">
          <div className="flex items-center gap-4">
            <Slider id="f-tenure" min={0} max={72} step={1} value={[value.tenure]} onValueChange={([v]) => onChange('tenure', v)} aria-label="Tenure in months" />
            <span className="num w-20 shrink-0 text-right text-sm font-semibold">{value.tenure} mo</span>
          </div>
          <p className="num mt-2 text-xs text-ink-3">Total charges: <span className="font-semibold text-ink-2">{money(value.total_charges)}</span></p>
        </Field>

        <Field id="f-payment" label="Payment method" changed={!same('payment_method')}>
          <Select value={value.payment_method} onValueChange={(v) => onChange('payment_method', v as PredictionInput['payment_method'])}>
            <SelectTrigger id="f-payment" className="h-10 w-full rounded-full border-line-strong bg-paper px-4 shadow-none sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Electronic check', 'Mailed check', 'Bank transfer (automatic)', 'Credit card (automatic)'].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <SwitchField k="paperless_billing" value={value} original={original} onChange={onChange} />
      </Section>

      <Section title="Services">
        <Field id="f-internet" label="Internet service" changed={!same('internet_service')}>
          <ToggleGroup id="f-internet" type="single" value={value.internet_service} onValueChange={(v) => v && onChange('internet_service', v as PredictionInput['internet_service'])} className={segmented} aria-label="Internet service">
            {[['DSL', 'DSL'], ['Fiber optic', 'Fiber optic'], ['No', 'None']].map(([v, l]) => (
              <ToggleGroupItem key={v} value={v} className={segItem}>
                {l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <SwitchField k="phone_service" value={value} original={original} onChange={onChange} />
        <SwitchField
          k="multiple_lines"
          value={value}
          original={original}
          onChange={onChange}
          disabled={!value.phone_service}
        />
        <div className="grid gap-x-6 sm:grid-cols-2">
          {ADDONS.map((a) => (
            <SwitchField key={a} k={a} value={value} original={original} onChange={onChange} disabled={noInternet} />
          ))}
        </div>
        {noInternet && <p className="pl-4 text-xs text-ink-3">Add-on services need an internet connection, so they are switched off while internet is “None”.</p>}
      </Section>

      <details className="group rounded-2xl border border-line bg-paper px-5 py-4 open:pb-6">
        <summary className="cursor-pointer list-none text-sm font-semibold text-ink-2 select-none marker:hidden">
          <span className="eyebrow">Household attributes</span>
          <span className="ml-2 text-ink-3 group-open:hidden">(show)</span>
        </summary>
        <div className="mt-5 space-y-4">
          <Field id="f-gender" label="Gender" changed={!same('gender')}>
            <ToggleGroup id="f-gender" type="single" value={value.gender} onValueChange={(v) => v && onChange('gender', v as PredictionInput['gender'])} className={segmented} aria-label="Gender">
              {['Female', 'Male'].map((g) => (
                <ToggleGroupItem key={g} value={g} className={segItem}>
                  {g}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <SwitchField k="senior_citizen" value={value} original={original} onChange={onChange} />
          <SwitchField k="partner" value={value} original={original} onChange={onChange} />
          <SwitchField k="dependents" value={value} original={original} onChange={onChange} />
        </div>
      </details>
    </div>
  )
}
