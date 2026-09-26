import { useTranslation } from 'react-i18next'
import { GRADE_COLOR } from '../lib/format'
import type { Grade } from '../types'
import { Num } from './Price'

/** Whole-lot result: how many fruits came out A, B and C, as one stacked bar. */
export function LotBreakdown({ counts }: { counts: [number, number, number] }) {
  const { t } = useTranslation()
  const n = counts[0] + counts[1] + counts[2]
  const grades: Grade[] = ['A', 'B', 'C']
  return (
    <div className="mt-5">
      <h2 className="font-bold">{t('lot.resultTitle', { count: n })}</h2>
      <div className="mt-2 flex h-6 overflow-hidden rounded-sm" aria-hidden="true">
        {grades.map((g, i) => (counts[i] ? <span key={g} style={{ width: `${(counts[i] / n) * 100}%`, background: GRADE_COLOR[g] }} /> : null))}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-4 text-[0.95rem]">
        {grades.map((g, i) => (
          <span key={g}>
            <span className="num font-extrabold" style={{ color: GRADE_COLOR[g] }}>
              {g}
            </span>{' '}
            <Num value={counts[i]} /> ({<Num value={`${Math.round((counts[i] / n) * 100)}%`} />})
          </span>
        ))}
      </p>
      <p className="mt-1 text-[0.9rem] text-soil-soft">{t('lot.priceNote')}</p>
    </div>
  )
}
