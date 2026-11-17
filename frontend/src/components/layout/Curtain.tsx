import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'

/**
 * Landing -> dashboard transition. A charcoal disc expands from the clicked point until it covers
 * the screen, the route changes underneath it, then the disc contracts to reveal the new page.
 * It lives above the router outlet so it survives the route change. With reduced motion it is skipped.
 */
type Phase = 'idle' | 'covering' | 'revealing'

interface CurtainApi {
  /** Navigate to `to`, starting the transition at the click position (or the screen centre). */
  go: (to: string, origin?: { x: number; y: number }) => void
}

const Ctx = createContext<CurtainApi>({ go: () => {} })
export const useCurtain = () => useContext(Ctx)

const EASE = [0.65, 0, 0.25, 1] as const

export function CurtainProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('idle')
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  const target = useRef('/')

  const go = useCallback(
    (to: string, at?: { x: number; y: number }) => {
      if (reduce || phase !== 'idle') {
        navigate(to)
        return
      }
      target.current = to
      setOrigin(at ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 })
      setPhase('covering')
    },
    [navigate, reduce, phase],
  )

  const circle = (r: string) => `circle(${r} at ${origin.x}px ${origin.y}px)`

  return (
    <Ctx.Provider value={{ go }}>
      {children}
      {phase !== 'idle' && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-auto fixed inset-0 z-[200] bg-charcoal"
          initial={{ clipPath: circle('0px') }}
          animate={{ clipPath: phase === 'covering' ? circle('160vmax') : circle('0px') }}
          transition={{ duration: phase === 'covering' ? 0.65 : 0.7, ease: EASE }}
          onAnimationComplete={() => {
            if (phase === 'covering') {
              navigate(target.current)
              window.scrollTo({ top: 0, behavior: 'instant' })
              // give the new route a frame to mount before uncovering it
              requestAnimationFrame(() => setPhase('revealing'))
            } else {
              setPhase('idle')
            }
          }}
        />
      )}
    </Ctx.Provider>
  )
}
