import { useTranslation } from 'react-i18next'
import { CROP_CARDS } from '../lib/cropModels'
import { GRADE_COLOR } from '../lib/format'
import type { Grade, Listing } from '../types'
import { Num } from './Price'

const GRADES: Grade[] = ['A', 'B', 'C']

/*
  Evidence for grades from the melon, sugarcane and wheat models: what the
  model saw, and the measured accuracy with its dataset, in plain words.
  Wheat shows kernels counted per quality group and per defect.
*/
export function CropModelBreakdown({ listing }: { listing: Listing }) {
  const { t } = useTranslation()
  const card = CROP_CARDS[listing.crop]
  if (!card || !listing.gradeProbabilities) return null
  const p = listing.gradeProbabilities
  const pct = (x: number) => Math.round(x * 100)
  const wheat = card.task === 'wheat_kernel_class'
  const binary = card.task === 'binary_good_damaged'
  const specs = listing.specs ?? []
  const kernels = Number(specs.find((s) => s.key === 'kernels')?.value ?? 0)

  return (
    <div className="mt-5">
      <h2 className="mb-2 font-bold">{wheat ? t('cropModel.kernelsTitle', { count: kernels }) : t('model.title')}</h2>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {GRADES.filter((g) => !(binary && g === 'B')).map((g) => (
          <li key={g} className="grid grid-cols-[minmax(4.5rem,auto)_1fr_3rem] items-center gap-3">
            <span className={`text-[0.95rem] ${g === listing.grade ? 'font-extrabold' : 'text-soil-soft'}`} style={g === listing.grade ? { color: GRADE_COLOR[g] } : undefined}>
              {wheat ? t(`cropModel.group_${g}`) : binary ? t(`cropModel.binary_${g}`) : g}
            </span>
            <span className="relative h-3 overflow-hidden rounded-sm bg-line" aria-hidden="true">
              <span className="absolute inset-y-0 start-0 rounded-sm" style={{ width: `${Math.max(2, pct(p[g]))}%`, background: g === listing.grade ? GRADE_COLOR[g] : 'var(--color-soil-soft)' }} />
            </span>
            <span className={`text-end text-[0.95rem] ${g === listing.grade ? 'font-bold' : 'text-soil-soft'}`}>
              <Num value={`${pct(p[g])}%`} />
            </span>
          </li>
        ))}
      </ul>

      {wheat && (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[0.95rem]">
          {specs
            .filter((s) => s.key.startsWith('wheat_'))
            .map((s) => (
              <li key={s.key}>
                {t(`specs.${s.key}`)} <Num value={s.value} className="font-bold" />
              </li>
            ))}
        </ul>
      )}

      <p className="mt-3 rounded-md bg-indus-wash px-3 py-2 text-[0.95rem] text-indus">
        {t(`cropModel.card_${card.task}`, {
          trained: card.trainImages.toLocaleString('en-US'),
          tested: card.testImages.toLocaleString('en-US'),
          accuracy: pct(card.testAccuracy),
          low: pct(card.testAccuracyWilson95[0]),
          high: pct(card.testAccuracyWilson95[1]),
          group: card.kernelGroupAccuracy !== undefined ? pct(card.kernelGroupAccuracy) : '',
        })}
        {card.groupAccuracy !== undefined && card.groupWilson95 && (
          <>
            {' '}
            {t('cropModel.card_group', {
              groupAcc: pct(card.groupAccuracy),
              groupCount: card.groupCount,
              groupLow: pct(card.groupWilson95[0]),
              groupHigh: pct(card.groupWilson95[1]),
            })}
          </>
        )}
      </p>
      {wheat && <p className="mt-2 text-[0.9rem] text-soil-soft">{t('cropModel.wheatRule')}</p>}
      {card.task === 'grade3_proxy' && <p className="mt-2 rounded-md bg-warn-wash px-3 py-2 text-[0.95rem] text-warn">{t('cropModel.melonProxy')}</p>}
    </div>
  )
}

/** "Measured from photo" list shown for every crop (not model output). */
export function MeasuredSpecs({ listing }: { listing: Listing }) {
  const { t } = useTranslation()
  const specs = (listing.specs ?? []).filter((s) => ['coverage', 'evenness', 'patches'].includes(s.key))
  if (!specs.length) return null
  return (
    <div className="mt-4">
      <h3 className="font-bold">{t('specs.title')}</h3>
      <dl className="m-0 mt-1 grid grid-cols-3 gap-2">
        {specs.map((s) => (
          <div key={s.key} className="rounded-md border border-line bg-sheet px-2 py-1.5">
            <dt className="text-[0.8rem] text-soil-soft">{t(`specs.${s.key}`)}</dt>
            <dd className="m-0 text-[1.1rem] font-bold">
              <Num value={s.value} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[0.85rem] text-soil-soft">{t('specs.note')}</p>
    </div>
  )
}
