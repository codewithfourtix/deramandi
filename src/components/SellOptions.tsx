import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bestOption, compareOptions, defaultAssumptions, type Assumptions } from '../lib/decide'
import { useRatesVersion } from '../lib/prices'
import type { CropId, Grade } from '../types'
import { Money, Num, Price } from './Price'

const FIELDS: { key: keyof Assumptions; step: number }[] = [
  { key: 'commissionPct', step: 0.5 },
  { key: 'truckCost', step: 500 },
  { key: 'truckKg', step: 500 },
  { key: 'transitLossPct', step: 0.5 },
  { key: 'storeWeeks', step: 1 },
  { key: 'storeCostPerKgWeek', step: 0.5 },
  { key: 'storeRisePct', step: 1 },
  { key: 'storeLossPctPerWeek', step: 0.1 },
]

/** Take-home money three ways: sell here now, truck to Multan, or store and sell later. */
export function SellOptions({ crop, grade, qtyKg }: { crop: CropId; grade: Grade; qtyKg: number }) {
  const { t } = useTranslation()
  const ratesVersion = useRatesVersion()
  const [a, setA] = useState<Assumptions>(() => defaultAssumptions(crop))
  const opts = useMemo(() => compareOptions(crop, grade, qtyKg, a), [crop, grade, qtyKg, a, ratesVersion])
  const best = bestOption(opts)
  const local = opts[0]

  return (
    <section className="mt-10 border-t-2 border-soil pt-5" aria-labelledby="sell-title">
      <h2 id="sell-title" className="text-lg font-bold">
        {t('sell.title')}
      </h2>
      <p className="text-soil-soft">{t('sell.lede', { qty: qtyKg.toLocaleString('en-US') })}</p>

      <ul className="m-0 mt-3 grid list-none gap-2 p-0">
        {opts.map((o) => {
          const isBest = o.available && o.key === best.key && opts.filter((x) => x.available).length > 1
          const diff = o.takeHome - local.takeHome
          return (
            <li key={o.key} className={`rounded-md border-2 p-3 ${isBest ? 'border-field bg-field-wash' : 'border-line bg-sheet'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold">{t(`sell.${o.key}`)}</h3>
                {isBest && <span className="rounded-sm bg-field px-2 text-[0.85rem] font-bold text-paper">{t('sell.best')}</span>}
              </div>
              {o.available ? (
                <>
                  <p className="mt-1 text-[1.25rem] font-extrabold">
                    <Money min={o.takeHome} max={o.takeHome} />
                  </p>
                  <p className="text-[0.95rem] text-soil-soft">
                    {t('sell.perKg')} <Price min={Math.round(o.perKg * 10) / 10} max={Math.round(o.perKg * 10) / 10} />
                    {o.key !== 'local' && (
                      <>
                        {' '}
                        {diff >= 0 ? t('sell.more') : t('sell.less')} <Money min={Math.abs(diff)} max={Math.abs(diff)} />
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-[0.9rem] text-soil-soft">
                    <Price min={Math.round(o.pricePerKg)} max={Math.round(o.pricePerKg)} /> <span aria-hidden="true">×</span>{' '}
                    <Num value={Math.round(o.kgSold)} /> {t('common.kg')}
                    {o.costs.map((c) => (
                      <span key={c.key}>
                        {t('common.sep')}
                        {t(`sell.cost_${c.key}`)} <Money min={c.amount} max={c.amount} />
                      </span>
                    ))}
                  </p>
                  {o.note === 'mill' && <p className="mt-1 text-[0.9rem]">{t('sell.millNote')}</p>}
                </>
              ) : (
                <p className="mt-1 text-[0.95rem] text-soil-soft">{t('sell.noMultanRate')}</p>
              )}
            </li>
          )
        })}
      </ul>

      {crop !== 'sugarcane' && (
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-bold text-indus">{t('sell.assumptions')}</summary>
          <p className="text-[0.9rem] text-soil-soft">{t('sell.assumptionsNote')}</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="grid gap-1 text-[0.95rem]">
                <span className="font-bold">{t(`sell.a_${f.key}`)}</span>
                <input
                  id={`a-${f.key}`}
                  type="number"
                  inputMode="decimal"
                  dir="ltr"
                  min={0}
                  step={f.step}
                  className="input num"
                  value={a[f.key]}
                  onChange={(e) => setA({ ...a, [f.key]: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
            ))}
          </div>
          <button type="button" className="btn btn-quiet mt-3" onClick={() => setA(defaultAssumptions(crop))}>
            {t('sell.reset')}
          </button>
        </details>
      )}
    </section>
  )
}
