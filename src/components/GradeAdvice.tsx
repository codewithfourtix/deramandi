import { useTranslation } from 'react-i18next'
import type { Listing } from '../types'
import { ltr } from '../lib/format'
import { Num } from './Price'

/*
  What we noticed, and one practical tip to sell better. Notes only point at
  things that were actually measured or counted (defect kernels the wheat
  model found, patches and evenness measured from the photo); they are not the
  grading model's reasons. The tip is standard advice for that crop and grade.
*/
export function GradeAdvice({ listing }: { listing: Listing }) {
  const { t } = useTranslation()
  const specs = new Map((listing.specs ?? []).map((s) => [s.key, s.value]))
  const num = (k: string) => Number((specs.get(k) ?? '').replace('%', ''))
  const reasons: { text: string; value?: string }[] = []

  if (listing.crop === 'wheat') {
    const defects = [...specs.entries()]
      .filter(([k]) => k.startsWith('wheat_') && k !== 'wheat_normal')
      .map(([k, v]) => ({ k, v: Number(v.replace('%', '')) }))
      .filter((d) => d.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 2)
    for (const d of defects) reasons.push({ text: t(`specs.${d.k}`), value: `${d.v}%` })
  } else {
    if (num('patches') >= 8) reasons.push({ text: t('advice.patches', { v: ltr(specs.get('patches') ?? '') }) })
    if (specs.has('evenness') && num('evenness') < 60) reasons.push({ text: t('advice.uneven', { v: ltr(specs.get('evenness') ?? '') }) })
    if (listing.lotCounts) {
      const [, b, c] = listing.lotCounts
      if (b + c > 0) reasons.push({ text: t('advice.lotMix', { b, c }) })
    }
  }

  return (
    <div className="mt-5 grid gap-2">
      {listing.grade !== 'A' && reasons.length > 0 && (
        <div>
          <h3 className="font-bold">{t('advice.title')}</h3>
          <ul className="m-0 mt-1 list-disc space-y-0.5 ps-5">
            {reasons.map((r) => (
              <li key={r.text}>
                {r.text}
                {r.value && (
                  <>
                    {': '}
                    <Num value={r.value} className="font-bold" />
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="rounded-md bg-field-wash px-3 py-2 text-field">
        <strong>{t('advice.tipLabel')}</strong> {t(`advice.tip_${listing.crop}_${listing.grade}`)}
      </p>
    </div>
  )
}
