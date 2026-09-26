import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { GradeStamp } from '../components/GradeStamp'
import { Num, Price } from '../components/Price'
import { decodePayload, referenceCode } from '../lib/checkCode'
import { graderFor, pct } from '../lib/modelInfo'

/*
  Opened from the certificate's QR code: shows what the certificate says, so a
  buyer can compare it with the paper. It proves nothing on its own (anyone can
  make such a link), and says so.
*/
export function Check() {
  const { t } = useTranslation()
  const { hash } = useLocation()
  const payload = decodePayload(hash.replace(/^#/, ''))

  if (!payload) {
    return (
      <div className="grid gap-4">
        <h1 className="display text-[1.8rem]">{t('check.title')}</h1>
        <p className="font-bold text-warn">{t('check.invalid')}</p>
        <Link to="/" className="btn btn-primary w-full sm:w-auto">
          {t('home.cta')}
        </Link>
      </div>
    )
  }

  const grader = graderFor(payload.c, payload.s)
  const rows: [string, React.ReactNode][] = [
    [t('check.reference'), <span key="r" className="num">{referenceCode(payload)}</span>],
    [t('sent.crop'), t(`crops.${payload.c}`)],
    [t('sent.quantity'), <span key="q"><Num value={payload.q} /> {t('common.kg')}</span>],
    [t('details.location'), t(`places.${payload.l}`)],
    [t('sent.price'), <Price key="p" min={payload.pm[0]} max={payload.pm[1]} />],
    [t('check.date'), <Num key="d" value={payload.d} />],
  ]
  if (payload.p) rows.push([t('model.title'), <span key="pp" className="num">A {payload.p[0]}%, B {payload.p[1]}%, C {payload.p[2]}%</span>])
  if (payload.lot) rows.push([t('lot.title'), <span key="lot" className="num">A {payload.lot[0]}, B {payload.lot[1]}, C {payload.lot[2]}</span>])

  return (
    <div className="grid gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-[1.8rem]">{t('check.title')}</h1>
          <p className="mt-1 text-[1.1rem] font-bold">{t('result.gradeOf', { grade: payload.g, crop: t(`crops.${payload.c}`) })}</p>
        </div>
        <GradeStamp grade={payload.g} size={100} />
      </div>
      <dl className="m-0 divide-y divide-line border-y border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(7rem,40%)_1fr] gap-3 py-2.5">
            <dt className="text-soil-soft">{label}</dt>
            <dd className="m-0 font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[0.95rem]">
        {grader.kind === 'model'
          ? t('check.model', { accuracy: pct(grader.accuracy), tested: grader.tested })
          : t('check.rules')}
      </p>
      <p className="rounded-md bg-warn-wash px-3 py-2 text-[0.95rem] text-warn">{t('check.notProof')}</p>
    </div>
  )
}
