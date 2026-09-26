import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import khajoor from '../data/modelCard.json'
import { Num } from '../components/Price'
import { CROP_CARDS, type CropCard } from '../lib/cropModels'
import type { CropId } from '../types'

/*
  "How sure are we?" Every number comes from the model cards written at export
  time (ml/export.py, ml/export_crop.py): held-out accuracy with its 95% range,
  the score of blind guessing, how often each answer was caught, the data and
  its licence, and what the model has never seen.
*/

const pct = (x: number) => Math.round(x * 100)

interface Row {
  label: string
  recall: number
  n: number
}

function Recall({ rows, note }: { rows: Row[]; note?: string }) {
  const { t } = useTranslation()
  return (
    <div className="mt-3">
      <h3 className="text-[1rem] font-bold">{t('accuracy.recallTitle')}</h3>
      {note && <p className="text-[0.85rem] text-soil-soft">{note}</p>}
      <ul className="m-0 mt-1 list-none space-y-1 p-0">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(6.5rem,auto)_1fr_3rem] items-center gap-2 text-[0.95rem]">
            <span className="truncate">{r.label}</span>
            <span className="relative h-3 overflow-hidden rounded-sm bg-line" aria-hidden="true">
              <span className="absolute inset-y-0 start-0 rounded-sm bg-indus" style={{ width: `${Math.max(2, pct(r.recall))}%` }} />
            </span>
            <span className="text-end font-bold">
              <Num value={`${pct(r.recall)}%`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Block({ crop, name, acc, ci, n, baseline, trained, dataset, citation, licence, rows, extra, recallNote, headlineKey = 'accuracy.headline' }: {
  crop: CropId
  name: string
  acc: number
  ci: [number, number]
  n: number
  baseline: number
  trained: number
  dataset: string
  citation: string
  licence: string
  rows: Row[]
  extra?: string
  recallNote?: string
  headlineKey?: string
}) {
  const { t } = useTranslation()
  return (
    <section className="border-t border-line pt-6" aria-labelledby={`acc-${crop}`}>
      <h2 id={`acc-${crop}`} className="display text-xl">
        {t(`crops.${crop}`)}
      </h2>
      <p className="text-[0.9rem] text-soil-soft">{name}</p>
      <p className="mt-3 text-[1.1rem]">
        <strong className="num display text-[2rem] text-indus">
          <Num value={`${pct(acc)}%`} />
        </strong>{' '}
        {t(headlineKey, { n: n.toLocaleString('en-US') })}
      </p>
      <p className="text-soil-soft">
        {t('accuracy.range', { low: pct(ci[0]), high: pct(ci[1]) })} {t('accuracy.baseline', { b: pct(baseline) })}
      </p>
      {extra && <p className="mt-2 rounded-md bg-indus-wash px-3 py-2 text-indus">{extra}</p>}
      <Recall rows={rows} note={recallNote} />
      <p className="mt-3 text-[0.95rem]">
        <strong>{t('accuracy.limitsTitle')}</strong> {t(`accuracy.limits_${crop}`)}
      </p>
      <p className="mt-2 text-[0.85rem] text-soil-soft [overflow-wrap:anywhere]">
        {t('accuracy.data', { n: trained.toLocaleString('en-US') })} <bdi>{dataset}</bdi>
        <br />
        <bdi>{citation}</bdi> · <bdi>{licence}</bdi>
      </p>
    </section>
  )
}

function cropRows(card: CropCard, t: (k: string) => string): Row[] {
  const name = (l: string) =>
    card.task === 'wheat_kernel_class' ? t(`specs.wheat_${l}`) : card.task === 'binary_good_damaged' ? t(l === 'good' ? 'cropModel.binary_A' : 'cropModel.binary_C') : `${t('common.grade')} ${l}`
  return card.labels.map((l) => ({ label: name(l), recall: card.perClass[l]?.recall ?? 0, n: card.perClass[l]?.n ?? 0 }))
}

export function Accuracy() {
  const { t } = useTranslation()
  const conf = khajoor.confusionAllTest
  const khajoorRows: Row[] = (['A', 'B', 'C'] as const).map((g, i) => ({
    label: `${t('common.grade')} ${g}`,
    recall: conf[i][i] / conf[i].reduce((s, x) => s + x, 0),
    n: conf[i].reduce((s, x) => s + x, 0),
  }))
  const order: CropId[] = ['wheat', 'sugarcane', 'kulachi_melon']

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="display text-[1.8rem]">{t('accuracy.title')}</h1>
        <p className="mt-3 max-w-[60ch] text-[1.05rem] text-soil-soft">{t('accuracy.intro')}</p>
        <p className="mt-2 max-w-[60ch] text-[0.95rem] text-soil-soft">{t('accuracy.howTested')}</p>
      </header>

      <Block
        crop="dhakki_dates"
        name={khajoor.backbone}
        acc={khajoor.testAccuracy}
        ci={khajoor.testAccuracyWilson95 as [number, number]}
        n={khajoor.testImages}
        baseline={khajoor.majorityBaseline}
        trained={khajoor.trainImages}
        dataset={khajoor.dataset}
        citation="Maitlo, A. K. et al. (2023), doi:10.17632/s5zfvsw5kv.3"
        licence="CC BY 4.0"
        rows={khajoorRows}
        recallNote={t('accuracy.recallAll', { n: khajoor.overallTestImages })}
      />

      {order.map((crop) => {
        const c = CROP_CARDS[crop]
        if (!c) return null
        const extra =
          c.kernelGroupAccuracy !== undefined
            ? t('accuracy.kernelGroup', { acc: pct(c.kernelGroupAccuracy) })
            : c.groupAccuracy !== undefined && c.groupWilson95
              ? t('cropModel.card_group', { groupAcc: pct(c.groupAccuracy), groupCount: c.groupCount, groupLow: pct(c.groupWilson95[0]), groupHigh: pct(c.groupWilson95[1]) })
              : undefined
        return (
          <Block
            key={crop}
            crop={crop}
            name={c.backbone}
            acc={c.testAccuracy}
            ci={c.testAccuracyWilson95}
            n={c.testImages}
            baseline={c.majorityBaseline}
            trained={c.trainImages}
            dataset={c.dataset}
            citation={c.citation}
            licence={c.licence}
            rows={cropRows(c, t)}
            extra={extra}
            headlineKey={c.task === 'grade3_proxy' ? 'accuracy.headlineProxy' : undefined}
          />
        )
      })}

      <section className="border-t border-line pt-6">
        <h2 className="display text-xl">{CROP_CARDS.wheat ? t('crops.other') : t('accuracy.rulesTitle')}</h2>
        <p className="mt-2">{t('accuracy.rules')}</p>
        {!CROP_CARDS.wheat && <p className="mt-2 text-[0.95rem] text-soil-soft">{t('accuracy.wheatTried')}</p>}
      </section>

      <Link to="/about" className="inline-flex min-h-11 items-center font-bold text-indus underline underline-offset-4">
        {t('footer.about')}
      </Link>
    </div>
  )
}
