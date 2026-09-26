import { useTranslation } from 'react-i18next'
import type { Lang } from '../i18n'

// One button that names the other language, written in that language, so a
// reader who can't read the current script still recognises their own.
export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const current = i18n.language as Lang
  const other: Lang = current === 'ur' ? 'en' : 'ur'

  return (
    <button
      type="button"
      lang={other}
      onClick={() => i18n.changeLanguage(other)}
      aria-label={`${t('lang.label')}: ${t(`lang.${other}`)}`}
      className={`flex min-h-11 items-center whitespace-nowrap rounded-md border-2 border-soil px-3 font-bold leading-none text-soil hover:bg-date-wash ${
        other === 'ur' ? 'font-[family-name:var(--font-urdu)] pb-1 text-[1rem]' : 'font-[family-name:var(--font-body)] text-[0.95rem]'
      }`}
    >
      {t(`lang.${other}`)}
    </button>
  )
}
