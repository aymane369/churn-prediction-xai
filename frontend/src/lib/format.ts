const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const integer = new Intl.NumberFormat('en-US')
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

/** 0.4231 -> "42%" */
export const pct = (p: number, digits = 0) => `${(p * 100).toFixed(digits)}%`
export const money = (v: number) => usd.format(v)
export const moneyWhole = (v: number) => usdWhole.format(v)
export const int = (v: number) => integer.format(v)
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))

/** Stable display code derived from the database id. */
export const customerCode = (id: number) => `C-${String(id).padStart(5, '0')}`

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} d ago`
}

export const signed = (v: number, digits = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`

export const tenureLabel = (months: number) =>
  months < 12 ? `${months} mo` : `${Math.floor(months / 12)} y${months % 12 ? ` ${months % 12} mo` : ''}`
