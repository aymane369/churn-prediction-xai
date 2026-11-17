import { useState } from 'react'
import { Link } from 'react-router-dom'
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

const LABEL =
  'absolute top-full left-1/2 z-30 mt-2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-line-strong bg-paper px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-card animate-in fade-in-0 zoom-in-95 duration-200 max-sm:gap-1 max-sm:px-2 max-sm:text-[0.6875rem]'

/**
 * "Churn is 76%": a small tag attached to the selected avatar. It lives inside that avatar's own
 * counter-rotating wrapper, so it travels around the orbit with it and always stays upright.
 */
function ChurnLabel({ member }: { member: Member }) {
  const { probability: p, risk } = member
  if (p === null || risk === null) return <span className={LABEL}>Sample</span>

  const body = (
    <>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: RISK[risk].markVar }} />
      Churn is <span className="num">{Math.round(p * 100)}%</span>
    </>
  )
  if (member.id === null) return <span className={LABEL}>{body}</span>
  return (
    <Link to={`/customers/${member.id}`} className={`${LABEL} transition-colors hover:border-ink`}>
      {body}
      <span className="sr-only">. Open profile of @{member.username}</span>
    </Link>
  )
}

/**
 * Hero visual: customers on slow orbits around a live risk gauge. Point at (or focus) a customer to see
 * their real model score, both in the gauge and in a small tag that follows them round the circle.
 * Falls back to a clearly labelled illustrative sample when the API is unreachable.
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
    <div className="constellation relative mx-auto aspect-square w-full max-w-[520px]">
      {/* Decorative circle outlines and the gauge never take pointer events: only the customers do. */}
      {rings.map((ring, ri) => {
        const holdsActive = active >= ring.offset && active < ring.offset + ring.items.length
        return (
          <div
            key={ri}
            className="orbit pointer-events-none absolute top-1/2 left-1/2 rounded-full border border-line-strong/50"
            style={{
              width: `${ring.size}%`,
              height: `${ring.size}%`,
              marginLeft: `${-ring.size / 2}%`,
              marginTop: `${-ring.size / 2}%`,
              // the ring that holds the selected customer is drawn on top, so its tag is never covered
              zIndex: holdsActive ? 20 : 10,
              ['--orbit-d' as string]: `${ring.duration}s`,
              animationDirection: ring.reverse ? 'reverse' : 'normal',
            }}
          >
            {ring.items.map((m, i) => {
              const idx = ring.offset + i
              const angle = (i / ring.items.length) * Math.PI * 2 + ri * 0.9
              const isActive = idx === active
              const color = m.risk ? RISK[m.risk].markVar : 'var(--info-mark)'
              return (
                <div key={m.seed} className="absolute" style={{ left: `${50 + 50 * Math.cos(angle)}%`, top: `${50 + 50 * Math.sin(angle)}%`, transform: 'translate(-50%, -50%)' }}>
                  <div className="orbit-counter" style={{ ['--orbit-d' as string]: `${ring.duration}s`, animationDirection: ring.reverse ? 'normal' : 'reverse' }}>
                    {/* `member` is the hover target. The padding enlarges it so a moving avatar is easy to catch. */}
                    <div className="member pointer-events-auto relative p-2" onMouseEnter={() => setActive(idx)}>
                      <button
                        type="button"
                        onFocus={() => setActive(idx)}
                        onClick={() => setActive(idx)}
                        aria-label={`Show ${m.username}${m.probability !== null ? `, predicted churn probability ${Math.round(m.probability * 100)}%` : ''}`}
                        aria-pressed={isActive}
                        className="block rounded-full transition-transform duration-300 ease-out-soft"
                        style={{ boxShadow: `0 0 0 ${isActive ? 4 : 3}px ${color}`, transform: isActive ? 'scale(1.15)' : undefined }}
                      >
                        <Avatar seed={m.seed} name={m.username} size={small ? 38 : 52} decorative eager />
                      </button>
                      {isActive && <ChurnLabel member={m} />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Centre: the selected customer's gauge */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
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
  )
}
