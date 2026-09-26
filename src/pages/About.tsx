import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-9 border-t border-line pt-5">
      <h2 id={id} className="display text-[1.3rem]">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

export function About() {
  const { t } = useTranslation()

  return (
    <article className="max-w-[62ch]">
      <h1 className="display text-[2rem]">{t('about.title')}</h1>
      <p className="mt-3 text-[1.1rem] text-soil-soft">{t('about.lede')}</p>

      <Section id="about-problem" title={t('about.problemTitle')}>
        <p>{t('about.problem1')}</p>
        <ul className="m-0 list-disc space-y-2 ps-5 marker:text-date-deep">
          {(['problemPrice', 'problemSpoil', 'problemLots'] as const).map((k) => (
            <li key={k}>
              {t(`about.${k}`)}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="about-steps" title={t('about.stepsTitle')}>
        <ol className="m-0 list-none space-y-2 p-0">
          {(['steps1', 'steps2', 'steps3', 'steps4'] as const).map((k, i) => (
            <li key={k} className="grid grid-cols-[1.75rem_1fr] gap-2">
              <span className="num font-extrabold text-date-deep" aria-hidden="true">
                {i + 1}
              </span>
              <span>{t(`about.${k}`)}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="about-grade" title={t('about.gradeTitle')}>
        <p>{t('about.grade1')}</p>
        <p className="rounded-md bg-date-wash px-3 py-2 font-bold">{t('about.grade2')}</p>
        <p>{t('about.grade3')}</p>
        <p className="text-soil-soft">{t('about.grade4')}</p>
      </Section>

      <Section id="about-lots" title={t('about.lotsTitle')}>
        <p>{t('about.lots1')}</p>
      </Section>

      <Section id="about-real" title={t('about.realTitle')}>
        <p>{t('about.real1')}</p>
        <p className="rounded-md bg-indus-wash px-3 py-2 text-indus">{t('about.real2')}</p>
        <p>{t('about.real3')}</p>
      </Section>

      <Section id="about-faq" title={t('about.faqTitle')}>
        <dl className="m-0 space-y-4">
          {([1, 2, 3] as const).map((n) => (
            <div key={n}>
              <dt className="font-bold">{t(`about.faq${n}q`)}</dt>
              <dd className="m-0 text-soil-soft">{t(`about.faq${n}a`)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <p className="mt-9 border-t border-line pt-5 text-soil-soft">{t('about.team')}</p>
      <Link to="/list" className="btn btn-primary mt-6 w-full sm:w-auto sm:min-w-64">
        {t('about.cta')}
      </Link>
    </article>
  )
}
