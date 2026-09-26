import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { TrashIcon } from '../components/Icons'
import { Num, Price } from '../components/Price'
import { listingsCsv } from '../lib/csv'
import { formatDate, GRADE_COLOR } from '../lib/format'
import { downloadFile } from '../lib/share'
import { removeListing, useFarmers, useListings } from '../lib/storage'
import { useVoiceLine } from '../lib/voice'

type StatusFilter = 'all' | 'listed' | 'reserved'

export function MyListings() {
  const { t, i18n } = useTranslation()
  useVoiceLine(['voice.listings'])
  const all = useListings()
  const farmers = useFarmers()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [farmerId, setFarmerId] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const farmerById = new Map(farmers.map((f) => [f.id, f]))

  // Search matches the crop name in both languages, variety, area, grower and village.
  const q = query.trim().toLowerCase()
  const listings = all.filter((l) => {
    if (status !== 'all' && l.status !== status) return false
    if (farmerId && l.farmerId !== farmerId) return false
    if (!q) return true
    const f = l.farmerId ? farmerById.get(l.farmerId) : undefined
    const hay = [i18n.getFixedT('en')(`crops.${l.crop}`), i18n.getFixedT('ur')(`crops.${l.crop}`), l.variety, i18n.getFixedT('en')(`places.${l.location}`), i18n.getFixedT('ur')(`places.${l.location}`), f?.name, f?.village, `grade ${l.grade}`]
    return hay.some((h) => h && h.toLowerCase().includes(q))
  })

  function remove(id: string) {
    removeListing(id)
    setConfirmId(null)
    setNotice(t('listings.deleted'))
  }

  return (
    <div>
      <h1 className="display text-[1.8rem]">{t('listings.title')}</h1>
      <p className="sr-only" role="status">
        {notice}
      </p>

      {all.length > 0 && (
        <div className="mt-4 grid gap-2">
          <label htmlFor="search" className="sr-only">
            {t('history.search')}
          </label>
          <input id="search" type="search" className="input" placeholder={t('history.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label={t('history.filterStatus')} className="flex gap-1">
              {(['all', 'listed', 'reserved'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={status === s}
                  onClick={() => setStatus(s)}
                  className={`min-h-11 rounded-md border-2 px-3 text-[0.95rem] font-bold ${status === s ? 'border-soil bg-soil text-paper' : 'border-line bg-sheet text-soil'}`}
                >
                  {s === 'all' ? t('history.status_all') : t(`listings.status.${s}`)}
                </button>
              ))}
            </div>
            {farmers.length > 0 && (
              <select aria-label={t('farmers.label')} className="input min-h-11 w-auto flex-1 appearance-auto py-1" value={farmerId} onChange={(e) => setFarmerId(e.target.value)}>
                <option value="">{t('farmers.all')}</option>
                {farmers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 text-[0.9rem] text-soil-soft">
            <span aria-live="polite">{t('history.results', { count: listings.length })}</span>
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-bold text-indus underline underline-offset-4"
              onClick={() => downloadFile(new File([listingsCsv(listings, farmers)], `dera-mandi-crops-${new Date().toISOString().slice(0, 10)}.csv`, { type: 'text/csv' }))}
            >
              {t('history.export')}
            </button>
          </div>
        </div>
      )}

      {all.length > 0 && listings.length === 0 && <p className="mt-6 text-soil-soft">{t('history.none')}</p>}

      {all.length === 0 ? (
        <div className="mt-6">
          <p className="max-w-[40ch] text-[1.1rem] text-soil-soft">{t('listings.empty')}</p>
          <Link to="/list" className="btn btn-primary mt-6 w-full sm:w-auto sm:min-w-64">
            {t('home.cta')}
          </Link>
        </div>
      ) : listings.length === 0 ? null : (
        <ul className="m-0 mt-5 list-none divide-y divide-line border-y border-line p-0">
          {listings.map((l) => {
            const crop = t(`crops.${l.crop}`)
            return (
              <li key={l.id}>
                <div className="flex items-center gap-1">
                  <Link to={`/listing/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-1 py-3 text-soil no-underline hover:bg-sheet">
                    {l.photos[0] ? (
                      <img src={l.photos[0]} alt="" className="h-16 w-16 shrink-0 rounded-sm object-cover" />
                    ) : (
                      <span className="h-16 w-16 shrink-0 rounded-sm bg-line" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold leading-snug">
                        {crop}
                        {t('common.sep')}
                        <Num value={l.quantityKg} /> {t('common.kg')}
                      </span>
                      <Price min={l.priceMin} max={l.priceMax} className="block text-[0.95rem]" />
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[0.85rem] text-soil-soft">
                        <span className={`rounded-sm px-1.5 font-bold ${l.status === 'reserved' ? 'bg-field text-paper' : 'bg-line text-soil'}`}>
                          {t(`listings.status.${l.status}`)}
                        </span>
                        <span>{formatDate(l.createdAt, i18n.language)}</span>
                        {l.farmerId && farmerById.get(l.farmerId) && <span className="font-bold text-indus">{farmerById.get(l.farmerId)!.name}</span>}
                      </span>
                    </span>
                    <span className="px-1">
                      <span className="sr-only">
                        {t('common.grade')} {l.grade}
                      </span>
                      <span className="num display text-[2rem]" style={{ color: GRADE_COLOR[l.grade] }} aria-hidden="true">
                        {l.grade}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmId(confirmId === l.id ? null : l.id)}
                    aria-expanded={confirmId === l.id}
                    aria-label={t('listings.delete', { crop })}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-soil-soft hover:bg-warn-wash hover:text-warn"
                  >
                    <TrashIcon />
                  </button>
                </div>
                {confirmId === l.id && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-warn-wash px-3 py-2">
                    <p className="me-auto font-bold text-warn">{t('listings.confirm')}</p>
                    <button type="button" className="btn btn-quiet min-h-11 px-3 text-[0.95rem]" onClick={() => setConfirmId(null)}>
                      {t('listings.keep')}
                    </button>
                    <button type="button" className="btn min-h-11 bg-warn px-3 text-[0.95rem] text-paper hover:bg-[#6f2c19]" onClick={() => remove(l.id)}>
                      {t('listings.confirmDelete')}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
