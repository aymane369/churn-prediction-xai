import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'

/** Counts smoothly from the previous value to the new one. Instant when reduced motion is requested. */
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
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  const reduce = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (reduce || previous.current === value) {
      node.textContent = format(value)
      previous.current = value
      return
    }
    const controls = animate(previous.current, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        node.textContent = format(v)
      },
    })
    previous.current = value
    return () => controls.stop()
    // `format` is intentionally excluded: callers pass inline functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce, duration])

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {format(value)}
    </span>
  )
}
