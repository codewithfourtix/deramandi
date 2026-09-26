import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { GradeStamp } from '../components/GradeStamp'
import { Num, Price } from '../components/Price'
import { loadListings } from '../lib/storage'

export function Home() {
  const { t } = useTranslation()
  const latest = loadListings()[0]

  const steps = [
    { title: t('home.step1'), body: t('home.step1d') },
    { title: t('home.step2'), body: t('home.step2d') },
    { title: t('home.step3'), body: t('home.step3d') },
  ]

  return (
    <div>
      <section className="relative pt-2" aria-labelledby="home-title">
        <GradeStamp grade="A" size={108} className="pointer-events-none absolute -top-1 end-0 opacity-90 sm:end-2" />
        <h1 id="home-title" className="display me-24 text-[2rem] sm:me-32 sm:text-[2.6rem]">
          {t('home.title')}
        </h1>
        <p className="mt-4 max-w-[38ch] text-[1.1rem] text-soil-soft">{t('home.lede')}</p>
        <Link to="/list" className="btn btn-primary mt-6 w-full text-[1.15rem] sm:w-auto sm:min-w-64">
          {t('home.cta')}
        </Link>
      </section>

      {latest && (
        <section className="mt-8" aria-labelledby="latest-title">
          <h2 id="latest-title" className="mb-2 text-base font-bold">
            {t('home.latest')}
          </h2>
          <Link
            to={`/listing/${latest.id}`}
            className="flex items-center gap-3 rounded-md border-2 border-line bg-sheet p-2 text-soil no-underline hover:border-soil"
          >
            {latest.photos[0] && <img src={latest.photos[0]} alt="" className="h-14 w-14 rounded-sm object-cover" />}
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {t(`crops.${latest.crop}`)}, <Num value={latest.quantityKg} /> {t('common.kg')}
              </span>
              <Price min={latest.priceMin} max={latest.priceMax} className="text-soil-soft" />
            </span>
            <span className="num px-2 text-2xl font-extrabold">{latest.grade}</span>
          </Link>
          <Link to="/listings" className="mt-2 inline-flex min-h-11 items-center font-bold text-indus underline underline-offset-4">
            {t('home.seeAll')}
          </Link>
        </section>
      )}

      <section className="mt-10 border-t border-line pt-6" aria-labelledby="how-title">
        <h2 id="how-title" className="display text-xl">
          {t('home.howTitle')}
        </h2>
        <ol className="m-0 mt-4 list-none space-y-5 p-0">
          {steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[2.5rem_1fr] gap-3">
              <span className="num display text-[1.9rem] text-date" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="text-[1.1rem] font-bold">{s.title}</h3>
                <p className="text-soil-soft">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-10 border-s-0 border-t border-line pt-6 text-[1rem] leading-relaxed text-soil-soft">{t('home.why')}</p>
    </div>
  )
}
