import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { GradeStamp } from '../components/GradeStamp'
import { CheckIcon, SnowIcon } from '../components/Icons'
import { PriceLadder } from '../components/PriceLadder'
import { Steps } from '../components/Steps'
import { cropInfo } from '../data'
import { GRADE_COLOR } from '../lib/format'
import { Money, Num, Price, PriceStack } from '../components/Price'
import { matchBuyers, matchLogistics } from '../lib/match'
import { getListing, updateListing } from '../lib/storage'
import type { FactorLevel, GradeFactors, Listing } from '../types'

const NO_LOGISTICS = 'none'

export function Result() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const listing = useMemo(() => getListing(id), [id])

  if (!listing) {
    return (
      <div>
        <p className="text-lg font-bold">{t('result.notFound')}</p>
        <Link to="/list" className="btn btn-primary mt-6">
          {t('home.cta')}
        </Link>
      </div>
    )
  }
  return <ResultView listing={listing} />
}

function ResultView({ listing }: { listing: Listing }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const reveal = Boolean((useLocation().state as { reveal?: boolean } | null)?.reveal)
  const lang = i18n.language as 'ur' | 'en'
  const reserved = listing.status === 'reserved'

  const { matches, tooSmallFor } = useMemo(() => matchBuyers(listing), [listing])
  const nearby = useMemo(() => matchLogistics(listing), [listing])
  const perishable = cropInfo(listing.crop).perishable

  const [buyerId, setBuyerId] = useState<string | undefined>(listing.reservedBuyerId)
  const [logisticsId, setLogisticsId] = useState<string>(listing.reservedLogisticsId ?? '')
  const [sending, setSending] = useState(false)

  const cropName = t(`crops.${listing.crop}`)
  const exporterGap = tooSmallFor.find((m) => m.buyer.type === 'exporter') ?? tooSmallFor[0]

  function send() {
    if (!buyerId || reserved) return
    setSending(true)
    updateListing(listing.id, {
      status: 'reserved',
      reservedBuyerId: buyerId,
      reservedLogisticsId: logisticsId && logisticsId !== NO_LOGISTICS ? logisticsId : undefined,
      reservedAt: new Date().toISOString(),
    })
    navigate(`/listing/${listing.id}/sent`)
  }

  return (
    <div>
      {!reserved && <Steps current={3} />}
      {reserved && (
        <div className="mb-6 flex items-start gap-2 rounded-md bg-field-wash px-3 py-2 text-field">
          <CheckIcon className="mt-1 shrink-0" />
          <p className="font-bold">
            {t('result.alreadySent')}{' '}
            <Link to={`/listing/${listing.id}/sent`} className="whitespace-nowrap text-indus underline underline-offset-4">
              {t('result.viewRequest')}
            </Link>
          </p>
        </div>
      )}

      {/* The trust moment: the grade, stamped on the farmer's own photo. */}
      <section aria-labelledby="grade-title">
        <h1 id="grade-title" className="display text-[1.7rem]">
          {t('result.gradeOf', { grade: listing.grade, crop: cropName })}
        </h1>
        {listing.variety && <p className="text-soil-soft">{listing.variety}</p>}

        <div className="relative mt-4 overflow-x-clip pb-10">
          <PhotoSet photos={listing.photos} />
          <div className="absolute -bottom-2 end-2">
            <GradeStamp grade={listing.grade} size={150} animate={reveal} backing />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-[1.15rem] font-bold" style={{ color: GRADE_COLOR[listing.grade] }}>
            {t(`result.summary${listing.grade}`)}
          </p>
        </div>
        <p className="mt-1 text-soil-soft">
          {t('result.confidence', { value: Math.round(listing.gradeConfidence * 100) })}
        </p>

        <FactorList factors={listing.gradeFactors} />
        <p className="mt-3 text-[0.95rem] text-soil-soft">{t('result.gradeNote')}</p>
      </section>

      {/* The "you are not being cheated" moment. */}
      <section className="mt-10 border-t-2 border-soil pt-5" aria-labelledby="price-title">
        <h2 id="price-title" className="text-lg font-bold">
          {t('result.priceTitle')}
        </h2>
        <Price min={listing.priceMin} max={listing.priceMax} className="display mt-1 block text-[2.2rem] text-soil" />
        <p className="mt-2 max-w-[44ch]">{t('result.priceBody', { grade: listing.grade, crop: cropName })}</p>
        <p className="mt-3 rounded-md bg-date-wash px-3 py-2">
          <span>{t('result.lotValue', { qty: listing.quantityKg.toLocaleString('en-US') })}</span>{' '}
          <Money min={listing.priceMin * listing.quantityKg} max={listing.priceMax * listing.quantityKg} className="font-bold" />
        </p>
        <div className="mt-6">
          <PriceLadder crop={listing.crop} grade={listing.grade} />
        </div>
        <p className="mt-3 text-[0.9rem] text-soil-soft">{t('result.samplePrices')}</p>
      </section>

      <section className="mt-10 border-t-2 border-soil pt-5" aria-labelledby="buyers-title">
        <h2 id="buyers-title" className="text-lg font-bold">
          {t('result.buyersTitle')}
        </h2>
        {matches.length > 0 ? (
          <>
            <p className="text-soil-soft">{t('result.buyersCount', { count: matches.length })}</p>
            <div role="radiogroup" aria-labelledby="buyers-title" className="mt-3 divide-y divide-line border-y border-line">
              {matches.map(({ buyer, offer }) => {
                const selected = buyerId === buyer.id
                return (
                  <label
                    key={buyer.id}
                    className={`relative flex cursor-pointer gap-3 px-2 py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-indus ${
                      selected ? 'bg-date-wash' : 'hover:bg-sheet'
                    } ${reserved ? 'cursor-default' : ''}`}
                  >
                    <input
                      type="radio"
                      name="buyer"
                      value={buyer.id}
                      checked={selected}
                      disabled={reserved}
                      onChange={() => setBuyerId(buyer.id)}
                      className="mt-1.5 h-5 w-5 shrink-0 accent-[var(--color-date-deep)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold leading-snug">{lang === 'ur' ? buyer.nameUr : buyer.name}</span>
                      <span className="block text-[0.95rem] text-soil-soft">
                        {t(`buyerType.${buyer.type}`)}, {t(`places.${buyer.location}`)}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-4 text-[0.9rem]">
                        {buyer.verified ? (
                          <span className="inline-flex items-center gap-1 font-bold text-field">
                            <CheckIcon /> {t('result.verified')}
                          </span>
                        ) : (
                          <span className="text-soil-soft">{t('result.notVerified')}</span>
                        )}
                        <span className="text-soil-soft">{t('result.minQty', { qty: buyer.minQuantityKg.toLocaleString('en-US') })}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block text-[0.85rem] text-soil-soft">{t('result.offers')}</span>
                      <PriceStack min={offer.min} max={offer.max} />
                    </span>
                  </label>
                )
              })}
            </div>
          </>
        ) : (
          <p className="mt-2 rounded-md bg-warn-wash px-3 py-2 font-bold text-warn">{t('result.buyersEmpty')}</p>
        )}

        {exporterGap && (
          <p className="mt-3 rounded-md bg-indus-wash px-3 py-2 text-indus">
            {t('result.aggregate', {
              qty: listing.quantityKg.toLocaleString('en-US'),
              min: exporterGap.buyer.minQuantityKg.toLocaleString('en-US'),
              name: lang === 'ur' ? exporterGap.buyer.nameUr : exporterGap.buyer.name,
            })}
          </p>
        )}
        <p className="mt-3 text-[0.9rem] text-soil-soft">{t('common.sampleProviders')}</p>
      </section>

      <section className="mt-10 border-t-2 border-soil pt-5" aria-labelledby="logistics-title">
        <h2 id="logistics-title" className="text-lg font-bold">
          {t('result.logisticsTitle', { place: t(`places.${listing.location}`) })}
        </h2>
        {perishable && <p className="text-soil-soft">{t('result.coldFirst')}</p>}
        <div role="radiogroup" aria-labelledby="logistics-title" className="mt-3 divide-y divide-line border-y border-line">
          {nearby.map(({ provider, distanceKm }) => {
            const selected = logisticsId === provider.id
            return (
              <label
                key={provider.id}
                className={`flex cursor-pointer gap-3 px-2 py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-indus ${
                  selected ? 'bg-date-wash' : 'hover:bg-sheet'
                }`}
              >
                <input
                  type="radio"
                  name="logistics"
                  value={provider.id}
                  checked={selected}
                  disabled={reserved}
                  onChange={() => setLogisticsId(provider.id)}
                  className="mt-1.5 h-5 w-5 shrink-0 accent-[var(--color-date-deep)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="font-bold leading-snug">{lang === 'ur' ? provider.nameUr : provider.name}</span>
                    {provider.coldStorage && (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-indus px-1.5 text-[0.8rem] font-bold text-paper">
                        <SnowIcon className="h-3.5 w-3.5" /> {t('result.cold')}
                      </span>
                    )}
                  </span>
                  <span className="block text-[0.95rem] text-soil-soft">
                    {t(`logisticsType.${provider.type}`)}, {t(`places.${provider.location}`)}
                  </span>
                  <span className="mt-1 block text-[0.9rem]">{provider.priceNote[lang]}</span>
                </span>
                <span className="shrink-0 text-end text-[0.9rem] text-soil-soft">
                  <Num value={distanceKm} className="block text-lg font-bold text-soil" />
                  {t('common.km')}
                </span>
              </label>
            )
          })}
          <label className={`flex cursor-pointer gap-3 px-2 py-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-indus ${logisticsId === NO_LOGISTICS ? 'bg-date-wash' : 'hover:bg-sheet'}`}>
            <input
              type="radio"
              name="logistics"
              value={NO_LOGISTICS}
              checked={logisticsId === NO_LOGISTICS}
              disabled={reserved}
              onChange={() => setLogisticsId(NO_LOGISTICS)}
              className="mt-1.5 h-5 w-5 shrink-0 accent-[var(--color-date-deep)]"
            />
            <span className="font-bold">{t('result.noLogistics')}</span>
          </label>
        </div>
        <p className="mt-3 text-[0.9rem] text-soil-soft">{t('common.sampleProviders')}</p>
      </section>

      {!reserved && matches.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-soil bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-2xl">
            {!buyerId && <p className="mb-2 text-center text-[0.95rem] text-soil-soft">{t('result.sendHint')}</p>}
            <button type="button" className="btn btn-primary w-full" disabled={!buyerId || sending} onClick={send}>
              {sending ? t('result.sending') : t('result.send')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const FACTOR_KEYS: (keyof GradeFactors)[] = ['size', 'color', 'defects']
const LEVEL_FILL: Record<FactorLevel, number> = { good: 3, fair: 2, poor: 1 }
const LEVEL_COLOR: Record<FactorLevel, string> = {
  good: 'var(--color-field)',
  fair: 'var(--color-date-deep)',
  poor: 'var(--color-warn)',
}

function FactorList({ factors }: { factors: GradeFactors }) {
  const { t } = useTranslation()
  return (
    <div className="mt-5">
      <h2 className="mb-2 font-bold">{t('result.whyTitle')}</h2>
      <dl className="m-0 divide-y divide-line border-y border-line">
        {FACTOR_KEYS.map((k) => {
          const lvl = factors[k]
          return (
            <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2">
              <dt className="text-soil-soft">{t(`result.factor.${k}`)}</dt>
              <dd className="m-0 flex items-center gap-3">
                <span className="font-bold">{t(`result.level.${k}.${lvl}`)}</span>
                <span className="flex gap-0.5" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <span key={n} className="h-3.5 w-2.5 rounded-[2px]" style={{ background: n <= LEVEL_FILL[lvl] ? LEVEL_COLOR[lvl] : 'var(--color-line)' }} />
                  ))}
                </span>
              </dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}

// One photo fills the frame; two sit side by side; three get one lead photo.
function PhotoSet({ photos }: { photos: string[] }) {
  const { t } = useTranslation()
  const layout =
    photos.length === 1
      ? ['col-span-6 aspect-[4/3]']
      : photos.length === 2
        ? ['col-span-3 aspect-[4/5]', 'col-span-3 aspect-[4/5]']
        : ['col-span-4 row-span-2', 'col-span-2 aspect-square', 'col-span-2 aspect-square']
  return (
    <div className="grid grid-cols-6 gap-1 overflow-hidden rounded-md">
      {photos.map((src, i) => (
        <img key={i} src={src} alt={t('photos.photoAlt', { n: i + 1 })} className={`h-full w-full object-cover ${layout[i]}`} />
      ))}
    </div>
  )
}
