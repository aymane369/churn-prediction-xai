import { useEffect, useState } from 'react'
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'

/**
 * Counts smoothly from the previous value to the new one. Instant when reduced motion is requested.
 *
 * React owns the text (it is plain state), and a motion value drives it. Two earlier designs had
 * problems: writing `textContent` by hand while React rendered the same text made the two fight, and
 * rendering the motion value directly only reaches the DOM on an animation frame, which browsers
 * pause in background tabs. Going through state, a final `set()` is an ordinary React update, so the
 * number is always correct once the animation window has passed, frames or not.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 0.7,
  className,
}: {
  value: number
  format: (v: number) => string
  duration?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const current = useMotionValue(value) // first render shows the value itself, no count-up from zero
  const [text, setText] = useState(() => format(value))

  useMotionValueEvent(current, 'change', (v) => setText(format(v)))

  useEffect(() => {
    if (reduce) {
      current.set(value)
      return
    }
    const controls = animate(current, value, { duration, ease: [0.2, 0.8, 0.2, 1] })
    // Backstop for background tabs, where animation frames are paused but timers still fire
    const backstop = window.setTimeout(() => {
      controls.stop()
      current.set(value)
    }, (duration + 0.2) * 1000)
    return () => {
      controls.stop()
      window.clearTimeout(backstop)
    }
  }, [value, reduce, duration, current])

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </span>
  )
}
