import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVoiceLine, type Seg } from '../lib/voice'
import { MarketRate } from '../components/MarketRate'
import { Price } from '../components/Price'
import { formatDate } from '../lib/format'
import { getRate, liveFetchedAt, refreshLive, useRatesVersion } from '../lib/prices'
import type { CropId } from '../types'

const CROPS: CropId[] = ['dhakki_dates', 'kulachi_melon', 'wheat', 'sugarcane']

/** Today's public mandi rates for each crop, nearest markets to D.I. Khan first. */
export function Prices() {
  const { t, i18n } = useTranslation()
  useRatesVersion()
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'failed'>('idle')
  const fetched = liveFetchedAt()
  const spoken: Seg[] = ['voice.pricesIntro']
  for (const crop of ['dhakki_dates', 'kulachi_melon', 'wheat', 'sugarcane'] as const) {
    const r = getRate(crop)
    if (r) spoken.push(`crops.${crop}`, r.rate.min, 'voice.to', r.rate.max, 'voice.perKg')
  }
  useVoiceLine(spoken)

  async function refresh() {
    setState('busy')
    setState((await refreshLive()) ? 'ok' : 'failed')
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-[1.8rem]">{t('rates.title')}</h1>
        <p className="mt-2 max-w-[60ch] text-soil-soft">{t('rates.lede')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-quiet" onClick={refresh} disabled={state === 'busy'} aria-busy={state === 'busy'}>
            {state === 'busy' ? t('rates.refreshing') : t('rates.refresh')}
          </button>
          <p className="text-[0.95rem] text-soil-soft" role="status">
            {state === 'failed' ? t('rates.refreshFailed') : state === 'ok' ? t('rates.refreshed') : fetched ? t('rates.lastFetched', { date: formatDate(fetched, i18n.language) }) : t('rates.builtIn')}
          </p>
        </div>
      </div>

      {CROPS.map((crop) => {
        const r = getRate(crop)
        const markets = r?.rate.markets ?? []
        return (
          <section key={crop} aria-labelledby={`p-${crop}`} className="grid gap-3 border-t-2 border-soil pt-4">
            <h2 id={`p-${crop}`} className="text-lg font-bold">
              {t(`crops.${crop}`)}
            </h2>
            <MarketRate crop={crop} compact />
            {markets.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[0.95rem]">
                  <caption className="mb-1 text-start font-bold">{t('rates.nearest')}</caption>
                  <thead>
                    <tr className="border-b border-soil text-start text-soil-soft">
                      <th className="py-1 pe-3 text-start font-normal">{t('rates.market')}</th>
                      <th className="py-1 pe-3 text-start font-normal">{t('rates.kind')}</th>
                      <th className="py-1 text-end font-normal">{t('rates.range')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {markets.slice(0, 8).map((m) => (
                      <tr key={m.market + m.commodity} className="border-b border-line">
                        <td className="py-1.5 pe-3">{m.market}</td>
                        <td className="py-1.5 pe-3 text-soil-soft">{m.commodity}</td>
                        <td className="py-1.5 text-end">
                          <Price min={m.min} max={m.max} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {r?.rate.urls?.[0] && (
              <p className="text-[0.9rem] text-soil-soft">
                {t('rates.sourceLabel')}{' '}
                <a href={r.rate.urls[0]} target="_blank" rel="noopener noreferrer" className="text-indus underline underline-offset-4" dir="ltr">
                  {new URL(r.rate.urls[0]).hostname}
                </a>
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}
