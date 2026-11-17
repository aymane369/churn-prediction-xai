import { useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import boy from '@/assets/churn/boy.webp'
import girl from '@/assets/churn/girl.webp'
import kid2 from '@/assets/churn/kid2.webp'
import kid3 from '@/assets/churn/kid3.webp'
import kid4 from '@/assets/churn/kid4.webp'
import marks from '@/assets/churn/marks.webp'
import trail from '@/assets/churn/trail.webp'
import { CANVAS, LAYERS } from '@/assets/churn/layers'

/** The part of the 2048 x 1152 source drawing that is shown (its content, without the empty left margin). */
const VIEW = { x: 440, y: 55, w: 1610, h: 1097 }

type Name = keyof typeof LAYERS

/** Layer position as a percentage of the visible area. */
function box(name: Name) {
  const l = LAYERS[name]
  const px = { x: (l.x / 100) * CANVAS.width, y: (l.y / 100) * CANVAS.height, w: (l.w / 100) * CANVAS.width, h: (l.h / 100) * CANVAS.height }
  return {
    left: `${((px.x - VIEW.x) / VIEW.w) * 100}%`,
    top: `${((px.y - VIEW.y) / VIEW.h) * 100}%`,
    width: `${(px.w / VIEW.w) * 100}%`,
    height: `${(px.h / VIEW.h) * 100}%`,
  }
}

const LOOP = { repeat: Infinity, ease: 'easeInOut' } as const
const PULL = 4 // seconds: the boy's lean and the girl's drift share one beat, so he strains as she slips away

interface LayerSpec {
  name: Name
  src: string
  /** Where the layer starts from on entrance (px offset). */
  from: { x: number; y: number }
  delay: number
  /** Idle loop: keyframes and timing. */
  idle: { animate: Record<string, number[]>; transition: Record<string, unknown> }
  origin?: string
}

// Back to front: the boy is drawn last because his hand wraps over the girl's
const LAYER_SPECS: LayerSpec[] = [
  { name: 'trail', src: trail, from: { x: -10, y: 10 }, delay: 0.9, idle: { animate: { opacity: [0.45, 1, 0.45] }, transition: { ...LOOP, duration: PULL } } },
  { name: 'kid4', src: kid4, from: { x: -14, y: 12 }, delay: 0.7, idle: { animate: { y: [0, -3, 0], x: [0, 2, 0] }, transition: { ...LOOP, duration: 6.8, delay: 1.2 } } },
  { name: 'kid3', src: kid3, from: { x: -14, y: 12 }, delay: 0.55, idle: { animate: { y: [0, -4, 0], x: [0, 2, 0], rotate: [0, -1.5, 0] }, transition: { ...LOOP, duration: 6, delay: 0.8 } } },
  { name: 'kid2', src: kid2, from: { x: -16, y: 14 }, delay: 0.4, idle: { animate: { y: [0, -6, 0], x: [0, 3, 0], rotate: [0, -2, 0] }, transition: { ...LOOP, duration: 5.2, delay: 0.3 } } },
  { name: 'girl', src: girl, from: { x: -20, y: 16 }, delay: 0.25, idle: { animate: { x: [0, 5, 0], y: [0, -4, 0], rotate: [0, -1, 0] }, transition: { ...LOOP, duration: PULL } } },
  { name: 'marks', src: marks, from: { x: 0, y: 0 }, delay: 0.8, idle: { animate: { opacity: [0.25, 1, 0.25] }, transition: { ...LOOP, duration: PULL } } },
  { name: 'boy', src: boy, from: { x: -26, y: 0 }, delay: 0, origin: '42% 100%', idle: { animate: { rotate: [0, 1.4, 0] }, transition: { ...LOOP, duration: PULL } } },
]

/**
 * Header illustration: someone reaching for a customer who is drifting away. Each figure is its own
 * transparent layer, so they can move independently. Loops only run while the picture is on screen,
 * and not at all when the user prefers reduced motion (then it is a still picture).
 */
export function ChurnIllustration({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const visible = useInView(ref, { margin: '0px 0px -10% 0px' })
  const loop = visible && !reduce

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Illustration: a person reaching out to a customer who is drifting away"
      className={`pointer-events-none relative w-full select-none ${className ?? ''}`}
      style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}` }}
    >
      {LAYER_SPECS.map((layer) => (
        <motion.div
          key={layer.name}
          aria-hidden="true"
          className="absolute"
          style={box(layer.name)}
          initial={reduce ? false : { opacity: 0, x: layer.from.x, y: layer.from.y }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ duration: 0.8, delay: layer.delay, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <motion.img
            src={layer.src}
            alt=""
            draggable={false}
            decoding="async"
            className="block size-full"
            style={{ transformOrigin: layer.origin ?? '50% 50%' }}
            animate={loop ? layer.idle.animate : { x: 0, y: 0, rotate: 0, opacity: 1 }}
            transition={loop ? layer.idle.transition : { duration: 0.4 }}
          />
        </motion.div>
      ))}
    </div>
  )
}
