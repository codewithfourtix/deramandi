import { useTranslation } from 'react-i18next'
import { GRADE_COLOR } from '../lib/format'
import { allBands } from '../lib/match'
import type { CropId, Grade } from '../types'
import { Num } from './Price'

/*
  All three grade bands on one shared price axis, so the farmer sees how far
  apart A and C are, and where their lot sits. Positions use inset-inline-start,
  so the axis runs right to left in Urdu, the same way the text does.
*/
export function PriceLadder({ crop, grade }: { crop: CropId; grade: Grade }) {
  const { t } = useTranslation()
  const bands = allBands(crop)
  const lo = Math.min(...bands.map((b) => b.min)) * 0.85
  const hi = Math.max(...bands.map((b) => b.max)) * 1.03
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100

  return (
    <figure className="m-0">
      <figcaption className="mb-2 font-bold">{t('result.ladderTitle')}</figcaption>
      <ul className="m-0 list-none p-0">
        {[...bands].reverse().map((band) => {
          const mine = band.grade === grade
          const color = GRADE_COLOR[band.grade]
          return (
            <li key={band.grade} className="grid grid-cols-[1.75rem_1fr_5.5rem] items-center gap-3 py-1.5">
              <span className={`num text-lg ${mine ? 'font-extrabold' : 'text-soil-soft'}`} style={mine ? { color } : undefined}>
                {band.grade}
              </span>
              <div className="relative h-6" aria-hidden="true">
                <div className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <div
                  className="absolute top-1/2 -translate-y-1/2 rounded-sm"
                  style={{
                    insetInlineStart: `${pct(band.min)}%`,
                    width: `${pct(band.max) - pct(band.min)}%`,
                    height: mine ? '0.9rem' : '0.5rem',
                    background: mine ? color : 'var(--color-line)',
                  }}
                />
              </div>
              <span className={`text-end text-[0.95rem] ${mine ? 'font-bold' : 'text-soil-soft'}`}>
                <Num value={`${band.min}–${band.max}`} />
                {mine && <span className="sr-only"> ({t('result.ladderYou')})</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
