import type { ReactNode } from 'react'
import { motion } from 'motion/react'

/** Fades/slides content in once as it scrolls into view. Skipped automatically for reduced motion. */
export function Reveal({
  children,
  delay = 0,
  className,
  y = 16,
  as = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  y?: number
  /** Render as a list item when the reveal is a direct child of a list (keeps the HTML valid). */
  as?: 'div' | 'li'
}) {
  const Tag = as === 'li' ? motion.li : motion.div
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.5, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </Tag>
  )
}
