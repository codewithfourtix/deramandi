import type { Grade } from '../types'

// Western numerals in both languages, grouped the same way everywhere.
export function fmtNum(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n)
}

export function fmtRange(min: number, max: number): string {
  return min === max ? fmtNum(min) : `${fmtNum(min)}–${fmtNum(max)}`
}

export function formatDate(iso: string, lang: string): string {
  const locale = lang === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export const GRADE_COLOR: Record<Grade, string> = {
  A: 'var(--color-field)',
  B: 'var(--color-date-deep)',
  C: 'var(--color-warn)',
}
