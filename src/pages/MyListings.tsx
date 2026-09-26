import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { TrashIcon } from '../components/Icons'
import { Num, Price } from '../components/Price'
import { formatDate, GRADE_COLOR } from '../lib/format'
import { loadListings, removeListing } from '../lib/storage'

export function MyListings() {
  const { t, i18n } = useTranslation()
  const [listings, setListings] = useState(loadListings)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function remove(id: string) {
    removeListing(id)
    setListings(loadListings())
    setConfirmId(null)
    setNotice(t('listings.deleted'))
  }

  return (
    <div>
      <h1 className="display text-[1.8rem]">{t('listings.title')}</h1>
      <p className="sr-only" role="status">
        {notice}
      </p>

      {listings.length === 0 ? (
        <div className="mt-6">
          <p className="max-w-[40ch] text-[1.1rem] text-soil-soft">{t('listings.empty')}</p>
          <Link to="/list" className="btn btn-primary mt-6 w-full sm:w-auto sm:min-w-64">
            {t('home.cta')}
          </Link>
        </div>
      ) : (
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
                        {crop}, <Num value={l.quantityKg} /> {t('common.kg')}
                      </span>
                      <Price min={l.priceMin} max={l.priceMax} className="block text-[0.95rem]" />
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[0.85rem] text-soil-soft">
                        <span className={`rounded-sm px-1.5 font-bold ${l.status === 'reserved' ? 'bg-field text-paper' : 'bg-line text-soil'}`}>
                          {t(`listings.status.${l.status}`)}
                        </span>
                        <span>{formatDate(l.createdAt, i18n.language)}</span>
                      </span>
                    </span>
                    <span className="px-1" aria-label={`${t('common.grade')} ${l.grade}`}>
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
