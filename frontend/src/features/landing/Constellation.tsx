import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { Avatar } from '@/components/Avatar'
import { ProbabilityGauge } from '@/components/ProbabilityGauge'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { Member } from '@/features/landing/data'
import { RISK } from '@/lib/risk'

// Rings: diameter as % of the container, orbit duration, direction, and which members sit on it
const RINGS = [
  { size: 52, duration: 90, reverse: false, take: 2 },
  { size: 76, duration: 140, reverse: true, take: 3 },
  { size: 100, duration: 200, reverse: false, take: 4 },
] as const

const PILL = 'inline-flex min-w-[13.5rem] max-w-full items-center gap-3 rounded-2xl border border-line-strong bg-paper px-4 py-2.5 shadow-card'

/**
 * Small read-out of the selected customer: "Churn is 76%". It sits below the orbit, never over it,
 * so it cannot hide the avatars or the animation. The risk is also written out (not only coloured).
 */
function ChurnPill({ member }: { member: Member }) {
  const { probability: p, risk } = member
  if (p === null || risk === null) {
    return <div className={`${PILL} justify-center text-sm text-ink-3`}>Illustrative sample</div>
  }

  // The visible text IS the accessible name (WCAG 2.5.3 "Label in Name"), with real spaces between
  // the parts so it reads "Churn is 74% @name · High risk"; "Open profile" is added for screen readers.
  const content = (isLink: boolean) => (
    <>
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: RISK[risk].markVar }} />
      <span className="min-w-0">
        <span className="flex items-baseline gap-1.5 leading-tight">
          <span className="text-[0.9375rem] font-semibold">Churn is</span>{' '}
          <AnimatedNumber value={p * 100} format={(v) => `${Math.round(v)}%`} className="font-display-opsz text-[1.4rem] leading-none" duration={0.5} />
        </span>{' '}
        <span className="block truncate text-xs text-ink-3">
          @{member.username} · {RISK[risk].label}
        </span>
        {isLink && <span className="sr-only">. Open profile</span>}
      </span>
    </>
  )

  if (member.id === null) return <div className={PILL}>{content(false)}</div>
  return (
    <Link to={`/customers/${member.id}`} className={`${PILL} transition-[box-shadow,border-color] duration-200 hover:border-ink hover:shadow-raised`}>
      {content(true)}
    </Link>
  )
}

/**
 * Hero visual: customers on slow orbits around a live risk gauge. Hover or focus a customer to see
 * their real model score. Falls back to a labelled illustrative sample.
 */
export function Constellation({ members }: { members: Member[]; live: boolean }) {
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

      <div className="mt-7 flex justify-center">
        <ChurnPill member={current} />
      </div>
    </div>
  )
}
