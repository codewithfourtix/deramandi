import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatDate, GRADE_COLOR } from '../lib/format'
import { Num, Price } from '../components/Price'
import { loadListings } from '../lib/storage'

export function MyListings() {
  const { t, i18n } = useTranslation()
  const listings = loadListings()

  return (
    <div>
      <h1 className="display text-[1.8rem]">{t('listings.title')}</h1>

      {listings.length === 0 ? (
        <div className="mt-6">
          <p className="max-w-[40ch] text-[1.1rem] text-soil-soft">{t('listings.empty')}</p>
          <Link to="/list" className="btn btn-primary mt-6 w-full sm:w-auto sm:min-w-64">
            {t('home.cta')}
          </Link>
        </div>
      ) : (
        <ul className="m-0 mt-5 list-none divide-y divide-line border-y border-line p-0">
          {listings.map((l) => (
            <li key={l.id}>
              <Link to={`/listing/${l.id}`} className="flex items-center gap-3 px-1 py-3 text-soil no-underline hover:bg-sheet">
                {l.photos[0] ? (
                  <img src={l.photos[0]} alt="" className="h-16 w-16 shrink-0 rounded-sm object-cover" />
                ) : (
                  <span className="h-16 w-16 shrink-0 rounded-sm bg-line" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-snug">
                    {t(`crops.${l.crop}`)}, <Num value={l.quantityKg} /> {t('common.kg')}
                  </span>
                  <Price min={l.priceMin} max={l.priceMax} className="block text-[0.95rem]" />
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[0.85rem] text-soil-soft">
                    <span
                      className={`rounded-sm px-1.5 font-bold ${l.status === 'reserved' ? 'bg-field text-paper' : 'bg-line text-soil'}`}
                    >
                      {t(`listings.status.${l.status}`)}
                    </span>
                    <span>{formatDate(l.createdAt, i18n.language)}</span>
                  </span>
                </span>
                <span className="flex flex-col items-center px-1" aria-label={`${t('common.grade')} ${l.grade}`}>
                  <span className="num display text-[2rem]" style={{ color: GRADE_COLOR[l.grade] }} aria-hidden="true">
                    {l.grade}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
