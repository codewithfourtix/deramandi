import { useTranslation } from 'react-i18next'

const KEYS = ['details', 'photos', 'result'] as const

// The listing flow really is a sequence, so it gets numbers.
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useTranslation()
  return (
    <div className="mb-6">
      <div className="flex gap-1.5" aria-hidden="true">
        {KEYS.map((k, i) => (
          <span key={k} className={`h-1.5 flex-1 rounded-full ${i < current ? 'bg-date' : 'bg-line'}`} />
        ))}
      </div>
      <p className="mt-2 text-[0.95rem] text-soil-soft">
        <span>{t('steps.label', { n: current })}</span>
        <span aria-hidden="true">: </span>
        <span className="font-bold text-soil">{t(`steps.${KEYS[current - 1]}`)}</span>
      </p>
    </div>
  )
}
