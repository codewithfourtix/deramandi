import { useTranslation } from 'react-i18next'
import modelCard from '../data/modelCard.json'
import { GRADE_COLOR } from '../lib/format'
import type { Grade } from '../types'
import { Num } from './Price'

const GRADES: Grade[] = ['A', 'B', 'C']

// What the khajoor model saw: how likely each grade is, and each photo's own
// grade, plus the accuracy it measured on photos it never trained on.
export function ModelBreakdown({ probabilities, perPhoto, grade }: { probabilities: Record<Grade, number>; perPhoto?: Grade[]; grade: Grade }) {
  const { t } = useTranslation()
  const pct = (g: Grade) => Math.round(probabilities[g] * 100)

  return (
    <div className="mt-5">
      <h2 className="mb-2 font-bold">{t('model.title')}</h2>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {GRADES.map((g) => (
          <li key={g} className="grid grid-cols-[1.75rem_1fr_3rem] items-center gap-3">
            <span className={`num text-lg ${g === grade ? 'font-extrabold' : 'text-soil-soft'}`} style={g === grade ? { color: GRADE_COLOR[g] } : undefined}>
              {g}
            </span>
            <span className="relative h-3 overflow-hidden rounded-sm bg-line" aria-hidden="true">
              <span
                className="absolute inset-y-0 start-0 rounded-sm"
                style={{ width: `${Math.max(2, pct(g))}%`, background: g === grade ? GRADE_COLOR[g] : 'var(--color-soil-soft)' }}
              />
            </span>
            <span className={`text-end text-[0.95rem] ${g === grade ? 'font-bold' : 'text-soil-soft'}`}>
              <Num value={`${pct(g)}%`} />
            </span>
          </li>
        ))}
      </ul>

      {perPhoto && perPhoto.length > 1 && (
        <p className="mt-3 flex flex-wrap gap-x-4 text-[0.95rem]">
          {perPhoto.map((g, i) => (
            <span key={i}>
              {t('model.photo', { n: i + 1 })}{' '}
              <span className="num font-extrabold" style={{ color: GRADE_COLOR[g] }}>
                {g}
              </span>
            </span>
          ))}
        </p>
      )}

      <p className="mt-3 rounded-md bg-indus-wash px-3 py-2 text-[0.95rem] text-indus">
        {t('model.card', {
          trained: modelCard.trainImages.toLocaleString('en-US'),
          tested: modelCard.testImages.toLocaleString('en-US'),
          accuracy: Math.round(modelCard.testAccuracy * 100),
        })}
      </p>
    </div>
  )
}
