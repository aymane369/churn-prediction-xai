import { Info } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { WaterfallChart } from '@/features/profile/WaterfallChart'
import { DriverLists } from '@/features/profile/DriverLists'
import { LimePanel } from '@/features/profile/LimePanel'
import { summarise } from '@/lib/shap'
import type { PredictionResult } from '@/types/api'

/** SHAP is the primary explanation (exact for this model); LIME is shown as an independent cross-check. */
export function ExplainerSection({ prediction }: { prediction: PredictionResult }) {
  const shap = prediction.explanations.find((e) => e.method === 'shap')
  const lime = prediction.explanations.find((e) => e.method === 'lime')

  if (!shap) {
    return <p className="rounded-2xl border border-dashed border-line-strong p-8 text-ink-3">No SHAP explanation is stored for this prediction.</p>
  }

  return (
    <div>
      <p className="font-display-opsz max-w-3xl text-[1.45rem] leading-snug font-light text-ink md:text-[1.7rem]">{summarise(shap, prediction.probability)}</p>

      <Tabs defaultValue="shap" className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-11 rounded-full border border-line bg-paper p-1">
            <TabsTrigger value="shap" className="rounded-full px-5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">
              SHAP
            </TabsTrigger>
            {lime && (
              <TabsTrigger value="lime" className="rounded-full px-5 text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none">
                LIME cross-check
              </TabsTrigger>
            )}
          </TabsList>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">
                <Info /> What am I looking at?
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-2 text-sm leading-relaxed">
              <p className="font-semibold">Reading an explanation</p>
              <p>
                The model starts from a <strong>baseline</strong>, its average output, then each feature of this customer nudges the prediction up or down.
              </p>
              <p>
                SHAP measures those nudges in <strong>log-odds</strong>. Positive pushes towards churn, negative away from it. Their sum is exact: baseline + contributions = this customer’s prediction.
              </p>
              <p className="text-ink-3">These describe how the <em>model</em> reached its number. They do not show that changing a feature would change what the customer does.</p>
            </PopoverContent>
          </Popover>
        </div>

        <TabsContent value="shap" className="mt-6 space-y-10">
          <section aria-label="Prediction waterfall">
            <h3 className="font-display-opsz mb-4 text-xl font-medium">From baseline to prediction</h3>
            <WaterfallChart shap={shap} probability={prediction.probability} risk={prediction.risk} />
          </section>
          <section aria-label="Drivers of this prediction">
            <h3 className="font-display-opsz mb-4 text-xl font-medium">What moves this customer’s risk</h3>
            <DriverLists values={shap.values} />
          </section>
        </TabsContent>

        {lime && (
          <TabsContent value="lime" className="mt-6">
            <h3 className="font-display-opsz mb-4 text-xl font-medium">A second opinion: LIME</h3>
            <LimePanel lime={lime} shap={shap} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
