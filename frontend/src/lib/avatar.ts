import { createAvatar } from '@dicebear/core'
import * as lorelei from '@dicebear/lorelei'

/**
 * Deterministic illustrated avatars: the same `avatar_seed` (stored per customer in the database)
 * always produces the same face and the same background tint. Generated locally in the browser;
 * no request leaves the app. Style: DiceBear "Lorelei" by Lisa Wischofsky, CC0 1.0.
 */

/** Soft background tints, all from the brand palette family. `deep` is used for the profile banner. */
export const TINTS = [
  { bg: 'b8c6b7', deep: '#6f8f7c', soft: '#dde5db' }, // sage
  { bg: 'a9c3b8', deep: '#4f8271', soft: '#d3e1da' }, // eucalyptus
  { bg: 'e8c4b4', deep: '#c27a5c', soft: '#f4dcd1' }, // clay
  { bg: 'e7ddc8', deep: '#a88a52', soft: '#f1e9d8' }, // sand
  { bg: 'dde5db', deep: '#87a99c', soft: '#ecf0ea' }, // mist
  { bg: 'f4dcd1', deep: '#d99074', soft: '#faeee8' }, // blush
] as const

/** FNV-1a 32-bit hash: tiny, stable across sessions and platforms. */
function hash(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export const tintFor = (seed: string) => TINTS[hash(seed) % TINTS.length]

const cache = new Map<string, string>()

export function avatarUri(seed: string): string {
  const hit = cache.get(seed)
  if (hit) return hit
  const uri = createAvatar(lorelei, {
    seed,
    size: 192,
    backgroundType: ['solid'],
    backgroundColor: [tintFor(seed).bg],
  }).toDataUri()
  cache.set(seed, uri)
  return uri
}
