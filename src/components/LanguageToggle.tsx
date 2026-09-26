import { useTranslation } from 'react-i18next'
import type { Lang } from '../i18n'

const OPTIONS: Lang[] = ['ur', 'en']

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const current = i18n.language as Lang

  return (
    <div role="group" aria-label={t('lang.label')} className="flex rounded-md border-2 border-soil p-0.5">
      {OPTIONS.map((lang) => {
        const active = current === lang
        return (
          <button
            key={lang}
            type="button"
            lang={lang}
            aria-pressed={active}
            onClick={() => i18n.changeLanguage(lang)}
            className={`min-h-10 rounded-[3px] px-3 text-[0.95rem] font-bold leading-none ${
              lang === 'ur' ? 'font-[family-name:var(--font-urdu)] pb-1' : 'font-[family-name:var(--font-body)]'
            } ${active ? 'bg-soil text-paper' : 'text-soil hover:bg-date-wash'}`}
          >
            {t(`lang.${lang}`)}
          </button>
        )
      })}
    </div>
  )
}
