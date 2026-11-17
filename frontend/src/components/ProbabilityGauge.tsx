import { motion, useReducedMotion } from 'motion/react'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { RISK } from '@/lib/risk'
import { pct } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Risk } from '@/types/api'

interface ProbabilityGaugeProps {
  /** 0..1 */
  probability: number
  risk: Risk
  /** Rendered pixel size of the square gauge. */
  size?: number
  /** Caption under the number. Pass null to hide it. */
  caption?: string | null
  /** Band boundaries (0..1), as served by the backend. */
  lowMax?: number
  highMin?: number
  className?: string
  /** Tint the caption as hypothetical (simulator). */
  hypothetical?: boolean
}

const TICKS = 60

/**
 * Segmented ring. Every tick belongs to a risk zone (colour = the zone's mark colour), and ticks
 * up to the predicted probability are lit. The number and the risk label carry the meaning; colour
 * is reinforcement only.
 */
export function ProbabilityGauge({
  probability,
  risk,
  size = 240,
  caption = 'churn probability',
  lowMax = 0.2,
  highMin = 0.5,
  className,
  hypothetical,
}: ProbabilityGaugeProps) {
  const reduce = useReducedMotion()
  const c = 100
  const inner = 70
  const outer = 94

  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const f = (i + 0.5) / TICKS
    const angle = f * Math.PI * 2 - Math.PI / 2
    const zone: Risk = f < lowMax ? 'low' : f >= highMin ? 'high' : 'medium'
    return {
      i,
      lit: f <= probability,
      color: RISK[zone].markVar,
      x1: c + Math.cos(angle) * inner,
      y1: c + Math.sin(angle) * inner,
      x2: c + Math.cos(angle) * outer,
      y2: c + Math.sin(angle) * outer,
    }
  })

  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${hypothetical ? 'Simulated ' : ''}churn probability ${pct(probability)}, ${RISK[risk].label.toLowerCase()}`}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" aria-hidden="true">
        {ticks.map((t) => (
          <motion.line
            key={t.i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.color}
            strokeWidth={3.4}
            strokeLinecap="round"
            initial={reduce ? false : { opacity: 0.14 }}
            animate={{ opacity: t.lit ? 1 : 0.14 }}
            transition={{ duration: 0.3, delay: reduce ? 0 : t.i * 0.009 }}
          />
        ))}
      </svg>
      <div className="relative text-center">
        <div className="font-display-opsz leading-none text-ink" style={{ fontSize: size * 0.24 }}>
          <AnimatedNumber value={probability * 100} format={(v) => `${Math.round(v)}`} />
          <span className="ml-0.5 align-top text-ink-3" style={{ fontSize: size * 0.11 }}>
            %
          </span>
        </div>
        {caption && (
          <div className={cn('mt-1.5 text-xs font-semibold', hypothetical ? 'text-ink-3 italic' : 'text-ink-3')}>{caption}</div>
        )}
      </div>
    </div>
  )
}
