const UK = 'Europe/London'
const MINUS = '−'

export function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return Math.round(value).toLocaleString('en-GB')
}

export function signed(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  const rounded = Math.round(value)
  const sign = rounded > 0 ? '+' : rounded < 0 ? MINUS : ''
  return sign + Math.abs(rounded).toLocaleString('en-GB')
}

export function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '–'
  return `${value.toFixed(digits)}%`
}

export function kLabel(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? MINUS : value > 0 ? '+' : ''
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs % 1000 ? 1 : 0)}k`
  return `${sign}${abs}`
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: UK, weekday: 'short', day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: UK, hour: '2-digit', minute: '2-digit', hour12: false })

/** "Sat 17 Jan" in UK time. */
export function dayLabel(value: string | number | Date): string {
  return dayFormat.format(new Date(value)).replace(',', '')
}

/** "20:00" in UK time. */
export function timeLabel(value: string | number | Date): string {
  return timeFormat.format(new Date(value))
}

/** "Sat 17 Jan, 20:00" in UK time. */
export function dateTimeLabel(value: string | number | Date): string {
  return `${dayLabel(value)}, ${timeLabel(value)}`
}

/** "Fri 2 Jan" from a plain "2026-01-02" date string. */
export function isoDayLabel(isoDate: string): string {
  return dayLabel(`${isoDate}T12:00:00Z`)
}

export function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}
