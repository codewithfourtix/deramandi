import { useTranslation } from 'react-i18next'
import { fmtNum, fmtRange } from '../lib/format'

// Every number is wrapped in <bdi> so a price like "420-520" never gets
// reordered inside right-to-left Urdu text.
export function Num({ value, className = '' }: { value: number | string; className?: string }) {
  return (
    <bdi dir="ltr" className={`num whitespace-nowrap ${className}`}>
      {typeof value === 'number' ? fmtNum(value) : value}
    </bdi>
  )
}

/** "PKR 420–520/kg" in English, "420–520 روپے فی کلو" in Urdu. */
export function Price({ min, max, className = '' }: { min: number; max: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <span className={className}>
      {t('price.before')}
      <Num value={fmtRange(min, max)} />
      {t('price.after')}
    </span>
  )
}

/** A lump sum, e.g. the whole lot value. */
export function Money({ min, max, className = '' }: { min: number; max: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <span className={className}>
      {t('price.totalBefore')}
      <Num value={fmtRange(Math.round(min), Math.round(max))} />
      {t('price.totalAfter')}
    </span>
  )
}

/** Two-line price for tight columns: the range on top, the unit underneath. */
export function PriceStack({ min, max, className = '' }: { min: number; max: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <span className={`block ${className}`}>
      <Num value={fmtRange(min, max)} className="block text-[1.1rem] font-bold" />
      <span className="block text-[0.8rem] text-soil-soft">{t('price.unit')}</span>
    </span>
  )
}
