import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { ProbabilityGauge } from '@/components/ProbabilityGauge'
import { RiskBadge } from '@/components/RiskBadge'
import { useExplanation } from '@/api/queries'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { Member } from '@/features/landing/data'
import { RISK } from '@/lib/risk'
import { signed } from '@/lib/format'
import { cn } from '@/lib/utils'

// Rings: diameter as % of the container, orbit duration, direction, and which members sit on it
const RINGS = [
  { size: 52, duration: 90, reverse: false, take: 2 },
  { size: 76, duration: 140, reverse: true, take: 3 },
  { size: 100, duration: 200, reverse: false, take: 4 },
] as const

function MiniDrivers({ id }: { id: number }) {
  const { data } = useExplanation(id)
  const shap = data?.explanations.find((e) => e.method === 'shap')
  if (!shap) return null
  const top = [...shap.values].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3)
  const max = Math.max(...top.map((t) => Math.abs(t.contribution)))
  return (
    <ul className="space-y-1.5" aria-label="Top SHAP drivers">
      {top.map((t) => (
        <li key={t.feature} className="grid grid-cols-[1fr_2.6rem] items-center gap-2 text-xs">
          <div>
            <div className="mb-1 flex justify-between gap-2">
              <span className="truncate font-semibold">{t.label}</span>
            </div>
            <div className="h-1.5 rounded-full bg-sunken">
              <div className="h-full rounded-full" style={{ width: `${(Math.abs(t.contribution) / max) * 100}%`, background: t.contribution > 0 ? 'var(--risk-high-mark)' : 'var(--risk-low-mark)' }} />
            </div>
          </div>
          <span className={cn('num text-right font-semibold', t.contribution > 0 ? 'text-risk-high' : 'text-risk-low')}>{signed(t.contribution)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Hero visual: customers on slow orbits around a live risk gauge. Hover or focus a customer to see
 * their real model score and top SHAP drivers. Falls back to a labelled illustrative sample.
 */
export function Constellation({ members, live }: { members: Member[]; live: boolean }) {
  const small = useMediaQuery('(max-width: 640px)')
  const [active, setActive] = useState(0)
  const current = members[active] ?? members[0]

  let cursor = 0
  const rings = RINGS.map((ring) => {
    const items = members.slice(cursor, cursor + ring.take)
    cursor += ring.take
    return { ...ring, items, offset: cursor - ring.take }
  })

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="constellation relative aspect-square w-full">
      {rings.map((ring, ri) => (
        <div
          key={ri}
          className="orbit absolute top-1/2 left-1/2 rounded-full border border-line-strong/50"
          style={{ width: `${ring.size}%`, height: `${ring.size}%`, marginLeft: `${-ring.size / 2}%`, marginTop: `${-ring.size / 2}%`, ['--orbit-d' as string]: `${ring.duration}s`, animationDirection: ring.reverse ? 'reverse' : 'normal' }}
        >
          {ring.items.map((m, i) => {
            const idx = ring.offset + i
            const angle = (i / ring.items.length) * Math.PI * 2 + ri * 0.9
            const isActive = idx === active
            const color = m.risk ? RISK[m.risk].markVar : 'var(--info-mark)'
            return (
              <div key={m.seed} className="absolute" style={{ left: `${50 + 50 * Math.cos(angle)}%`, top: `${50 + 50 * Math.sin(angle)}%`, transform: 'translate(-50%, -50%)' }}>
                <div className="orbit-counter" style={{ ['--orbit-d' as string]: `${ring.duration}s`, animationDirection: ring.reverse ? 'normal' : 'reverse' }}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onFocus={() => setActive(idx)}
                    onClick={() => setActive(idx)}
                    aria-label={`Show ${m.username}${m.probability !== null ? `, predicted churn probability ${Math.round(m.probability * 100)}%` : ''}`}
                    aria-pressed={isActive}
                    className="block rounded-full transition-transform duration-300 ease-out-soft hover:scale-110 focus-visible:scale-110"
                    style={{ boxShadow: `0 0 0 ${isActive ? 4 : 3}px ${color}`, transform: isActive ? 'scale(1.18)' : undefined }}
                  >
                    <Avatar seed={m.seed} name={m.username} size={small ? 38 : 52} decorative eager />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Centre: the selected customer's gauge */}
      <div className="absolute inset-0 grid place-items-center">
        {current.probability !== null && current.risk ? (
          <ProbabilityGauge probability={current.probability} risk={current.risk} size={small ? 150 : 200} caption="model estimate" />
        ) : (
          <div className="grid size-40 place-items-center rounded-full border-2 border-dashed border-line-strong text-center text-xs text-ink-3">
            Illustrative
            <br />
            sample
          </div>
        )}
      </div>

      </div>

      {/* Selected customer + live drivers: below the orbit on phones, floating over its corner on larger screens */}
      <div className="mt-6 flex justify-center sm:absolute sm:right-0 sm:bottom-0 sm:mt-0 sm:translate-y-8">
        <div className="w-full max-w-[17rem] rounded-2xl border border-line bg-paper/95 p-4 shadow-raised">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">@{current.username}</p>
            <RiskBadge risk={current.risk} />
          </div>
          {live && current.id !== null ? (
            <>
              <MiniDrivers id={current.id} />
              <Link to={`/customers/${current.id}`} className="mt-3 inline-block text-xs font-semibold text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
                Open this profile →
              </Link>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-ink-3">Illustrative sample: connect the API to see real customers, scores and SHAP drivers here.</p>
          )}
        </div>
      </div>
    </div>
  )
}
