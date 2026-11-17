import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/states'
import { CustomerPicker } from '@/features/simulator/CustomerPicker'
import { Controls } from '@/features/simulator/Controls'
import { ResultPanel } from '@/features/simulator/ResultPanel'
import { DEFAULT_INPUT, applyChange, applySetParams, customerToInput, diffInputs } from '@/features/simulator/model'
import { api } from '@/api/endpoints'
import { useCustomer, useExplanation, useOverview, usePredict } from '@/api/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { pct } from '@/lib/format'
import type { PredictionInput, PredictionResult } from '@/types/api'

export default function Simulator() {
  useDocumentTitle('What-if simulator')
  const [params, setParams] = useSearchParams()
  const customerId = Number(params.get('customer')) || null
  const sets = useMemo(() => params.getAll('set'), [params])

  const customer = useCustomer(customerId ?? Number.NaN)
  const stored = useExplanation(customerId ?? Number.NaN)
  const overview = useOverview()

  // "Original" = the customer's stored prediction, or the illustrative profile scored once
  const baseline = useQuery({
    queryKey: ['baseline-profile'],
    queryFn: ({ signal }) => api.predict(DEFAULT_INPUT, signal),
    enabled: customerId === null,
    staleTime: Infinity,
  })
  const original: PredictionResult | undefined = customerId === null ? baseline.data : stored.data
  const originalInput = useMemo<PredictionInput>(() => (customerId !== null && customer.data ? customerToInput(customer.data) : DEFAULT_INPUT), [customerId, customer.data])

  const [input, setInput] = useState<PredictionInput>(DEFAULT_INPUT)
  const [simulatedFor, setSimulatedFor] = useState<PredictionInput | null>(null)
  const predict = usePredict()
  const autoRan = useRef<string | null>(null)

  const simulate = (profile: PredictionInput = input) => {
    predict.mutate(profile, { onSuccess: () => setSimulatedFor(profile) })
  }

  // (Re)initialise the editable profile whenever the starting point changes. Arriving from a
  // "Preview in simulator" link, the suggested change is simulated here, with the profile we just
  // built (not whatever `input` happened to hold during the previous render).
  useEffect(() => {
    if (customerId !== null && !customer.data) return
    const start = sets.length ? applySetParams(originalInput, sets) : originalInput
    setInput(start)
    setSimulatedFor(null)

    const key = `${customerId}|${sets.join('|')}`
    const wantsAutoRun = sets.length > 0 && diffInputs(originalInput, start).length > 0
    if (!wantsAutoRun) {
      predict.reset()
    } else if (autoRan.current !== key) {
      autoRan.current = key // also guards against React StrictMode running effects twice in development
      simulate(start)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalInput, sets.join('|')])

  const changes = useMemo(() => diffInputs(originalInput, input), [originalInput, input])
  const dirty = simulatedFor === null || diffInputs(simulatedFor, input).length > 0

  const onChange = <K extends keyof PredictionInput>(key: K, value: PredictionInput[K]) => setInput((cur) => applyChange(cur, originalInput, key, value))
  const reset = () => {
    setInput(originalInput)
    setSimulatedFor(null)
    predict.reset()
    if (sets.length) setParams((p) => { p.delete('set'); return p }, { replace: true })
  }
  const pick = (id: number | null) => setParams(id === null ? {} : { customer: String(id) })

  const loadError = customerId !== null ? (customer.error ?? stored.error) : baseline.error
  const loading = customerId !== null ? customer.isPending || stored.isPending : baseline.isPending
  const simulated = predict.data

  return (
    <>
      <PageHeader eyebrow="What-if simulator" title={<>Change the customer, <em className="font-light text-ink-2 italic">watch the model react.</em></>}>
        Adjust a customer’s contract, charges or services, then ask the model for a new prediction and see how its explanation changes. Scenarios are hypothetical and are not predictions about what a customer will do.
      </PageHeader>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="eyebrow">Start from</span>
        <CustomerPicker current={customerId !== null ? customer.data : undefined} onPick={pick} />
        {customerId === null && <span className="text-sm text-ink-3">An illustrative profile, not a real customer.</span>}
      </div>

      {loadError ? (
        <ErrorState error={loadError} onRetry={() => { customer.refetch(); stored.refetch(); baseline.refetch() }} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="order-2 lg:order-1 lg:col-span-6 xl:col-span-6">
            <Controls value={input} original={originalInput} onChange={onChange} />
          </div>
          <div className="order-1 lg:order-2 lg:col-span-6">
            <div className="lg:sticky lg:top-24">
              <ResultPanel
                original={loading ? undefined : original}
                simulated={simulated}
                pending={predict.isPending}
                error={predict.error}
                changes={changes}
                dirty={dirty}
                thresholds={overview.data?.risk_thresholds}
                onSimulate={() => simulate()}
                onReset={reset}
              />
            </div>
          </div>
        </div>
      )}

      {/* Phone: the result is far from the controls, so keep the action and the number in reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-strong bg-ivory px-5 py-3 lg:hidden">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
          <p className="text-sm">
            {simulated ? (
              <>
                <span className="text-ink-3">Simulated </span>
                <span className="font-display-opsz num text-xl">{pct(simulated.probability)}</span>
                {original && <span className="text-ink-3"> · was {pct(original.probability)}</span>}
              </>
            ) : (
              <span className="text-ink-3">{changes.length} change{changes.length === 1 ? '' : 's'}</span>
            )}
          </p>
          <Button onClick={() => simulate()} disabled={predict.isPending || changes.length === 0}>
            <FlaskConical /> Simulate
          </Button>
        </div>
      </div>
      <div className="h-16 lg:hidden" aria-hidden="true" />
    </>
  )
}
