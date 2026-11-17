import { memo } from 'react'
import { motion } from 'motion/react'
import { avatarUri } from '@/lib/avatar'
import { cn } from '@/lib/utils'

interface AvatarProps {
  seed: string
  /** Pseudonym, used for the accessible name. */
  name: string
  size?: number
  className?: string
  /** Set when the name is shown right next to the avatar (screen readers then skip the image). */
  decorative?: boolean
  /** Shared-element id so the avatar glides from the directory into the profile. */
  layoutId?: string
  /** Load immediately (above-the-fold avatars) instead of lazily. */
  eager?: boolean
}

/** Deterministic illustrated avatar (DiceBear Lorelei, CC0). Same seed, same face, every time. */
export const Avatar = memo(function Avatar({ seed, name, size = 44, className, decorative, layoutId, eager }: AvatarProps) {
  const img = (
    <img
      src={avatarUri(seed)}
      alt={decorative ? '' : `Illustrated avatar of ${name}`}
      width={size}
      height={size}
      loading={eager ? "eager" : "lazy"}
      decoding={eager ? "sync" : "async"}
      draggable={false}
      className="size-full rounded-[inherit] object-cover"
    />
  )
  const base = cn('inline-block shrink-0 overflow-hidden rounded-full bg-sunken ring-1 ring-line-strong/60', className)
  const style = { width: size, height: size }
  if (layoutId) {
    return (
      <motion.span layoutId={layoutId} className={base} style={{ ...style, borderRadius: 9999 }}>
        {img}
      </motion.span>
    )
  }
  return (
    <span className={base} style={style}>
      {img}
    </span>
  )
})
