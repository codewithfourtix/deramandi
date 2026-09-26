import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router'
import { GradeStamp } from '../components/GradeStamp'
import { CheckIcon } from '../components/Icons'
import { Num, Price } from '../components/Price'
import { findBuyer, findLogistics } from '../lib/match'
import { getListing } from '../lib/storage'

export function Sent() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'ur' | 'en'
  const listing = getListing(id)

  if (!listing) return <Navigate to="/listings" replace />
  if (listing.status !== 'reserved') return <Navigate to={`/listing/${id}`} replace />

  const buyer = findBuyer(listing.reservedBuyerId)
  const logistics = findLogistics(listing.reservedLogisticsId)
  const buyerName = buyer ? (lang === 'ur' ? buyer.nameUr : buyer.name) : ''

  const rows: [string, React.ReactNode][] = [
    [t('sent.crop'), t(`crops.${listing.crop}`)],
    [
      t('sent.quantity'),
      <span key="q">
        <Num value={listing.quantityKg} /> {t('common.kg')}
      </span>,
    ],
    [t('sent.grade'), <span key="g" className="num font-extrabold">{listing.grade}</span>],
    [t('sent.price'), <Price key="p" min={listing.priceMin} max={listing.priceMax} />],
    [t('sent.buyer'), buyerName],
    [t('sent.logistics'), logistics ? (lang === 'ur' ? logistics.nameUr : logistics.name) : t('sent.none')],
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-field text-paper" aria-hidden="true">
            <CheckIcon className="h-7 w-7" />
          </p>
          <h1 className="display mt-3 text-[1.9rem]" tabIndex={-1}>
            {t('sent.title')}
          </h1>
        </div>
        <GradeStamp grade={listing.grade} size={96} />
      </div>
      <p className="mt-3 max-w-[40ch] text-[1.1rem]" role="status">
        {t('sent.body', { buyer: buyerName })}
      </p>

      <section className="mt-8 rounded-md border-2 border-soil bg-sheet" aria-labelledby="summary-title">
        <h2 id="summary-title" className="border-b-2 border-soil px-4 py-2 font-bold">
          {t('sent.summary')}
        </h2>
        <dl className="m-0 divide-y divide-line px-4">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[minmax(7rem,40%)_1fr] gap-3 py-2.5">
              <dt className="text-soil-soft">{label}</dt>
              <dd className="m-0 font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-4 text-[0.95rem] text-soil-soft">{t('sent.demoNote')}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link to="/listings" className="btn btn-primary">
          {t('sent.toListings')}
        </Link>
        <Link to="/list" className="btn btn-quiet">
          {t('sent.another')}
        </Link>
      </div>
    </div>
  )
}
