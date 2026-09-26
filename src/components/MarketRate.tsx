import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatDate } from '../lib/format'
import { clearMyRate, getRate, setMyRate, useRatesVersion } from '../lib/prices'
import type { CropId } from '../types'
import { Price } from './Price'

/*
  Says where the fair price comes from (the grower's own rate, AMIS live, or
  the built-in AMIS snapshot), when it was published, and how bands are cut.
  Lets the grower or helper type today's rate at their own mandi, per kg or
  per maund (40 kg), which then drives every band and offer for that crop.
*/
export function MarketRate({ crop, compact = false }: { crop: CropId; compact?: boolean }) {
  const { t, i18n } = useTranslation()
  useRatesVersion()
  const r = getRate(crop)
  const [editing, setEditing] = useState(false)
  const [unit, setUnit] = useState<'kg' | 'maund'>('maund')
  const [minText, setMinText] = useState('')
  const [maxText, setMaxText] = useState('')
  const [error, setError] = useState<string | null>(null)

  function save(e: FormEvent) {
    e.preventDefault()
    const k = unit === 'maund' ? 40 : 1
    const min = Number(minText.replace(/[^\d.]/g, '')) / k
    const max = Number(maxText.replace(/[^\d.]/g, '')) / k
    if (!(min > 0) || !(max > min)) {
      setError(t('rates.error'))
      return
    }
    setMyRate(crop, Math.round(min * 10) / 10, Math.round(max * 10) / 10)
    setEditing(false)
    setError(null)
  }

  const originLine = r
    ? r.origin === 'mine'
      ? t('rates.mine', { date: r.rate.date ? formatDate(r.rate.date, i18n.language) : '' })
      : t('rates.amis', {
          date: r.rate.date ? formatDate(r.rate.date, i18n.language) : '',
          what: (r.rate.commodities ?? []).map((c) => t(`rates.commodity.${c.replace(/ /g, '_').replace(/[()]/g, '')}`, { defaultValue: c })).join(t('common.sep')),
        })
    : t('rates.reference')

  return (
    <div className={`rounded-md border-2 border-line bg-sheet p-3 ${compact ? '' : 'mt-4'}`}>
      {r && (
        <p className="font-bold">
          {r.origin === 'mine' ? t('rates.yourRate') : t('rates.marketToday')}{' '}
          <Price min={r.rate.min} max={r.rate.max} />
        </p>
      )}
      <p className="text-[0.95rem] text-soil-soft">{originLine}</p>
      {r && <p className="text-[0.95rem] text-soil-soft">{t('rates.thirds')}</p>}
      {crop === 'dhakki_dates' && r?.origin !== 'mine' && <p className="text-[0.95rem] text-soil-soft">{t('rates.noDhakki')}</p>}

      {!editing ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" className="min-h-11 font-bold text-indus underline underline-offset-4" onClick={() => setEditing(true)}>
            {t('rates.setMine')}
          </button>
          {r?.origin === 'mine' && (
            <button type="button" className="min-h-11 font-bold text-indus underline underline-offset-4" onClick={() => clearMyRate(crop)}>
              {t('rates.useMarket')}
            </button>
          )}
          {!compact && (
            <Link to="/prices" className="inline-flex min-h-11 items-center font-bold text-indus underline underline-offset-4">
              {t('rates.allMarkets')}
            </Link>
          )}
        </div>
      ) : (
        <form onSubmit={save} className="mt-3 grid gap-3" noValidate>
          <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
            <legend className="field-label">{t('rates.unit')}</legend>
            {(['maund', 'kg'] as const).map((u) => (
              <label key={u} className={`btn min-h-11 px-3 text-[0.95rem] ${unit === u ? 'btn-primary' : 'btn-quiet'}`}>
                <input type="radio" name={`unit-${crop}`} value={u} checked={unit === u} onChange={() => setUnit(u)} className="sr-only" />
                {t(`rates.per_${u}`)}
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <span className="field-label">{t('rates.low')}</span>
              <input id={`rate-min-${crop}`} className="input num" inputMode="decimal" dir="ltr" value={minText} onChange={(e) => setMinText(e.target.value)} />
            </label>
            <label className="grid gap-1">
              <span className="field-label">{t('rates.high')}</span>
              <input id={`rate-max-${crop}`} className="input num" inputMode="decimal" dir="ltr" value={maxText} onChange={(e) => setMaxText(e.target.value)} />
            </label>
          </div>
          {error && (
            <p role="alert" className="font-bold text-warn">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary">
              {t('rates.save')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setEditing(false)}>
              {t('rates.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
