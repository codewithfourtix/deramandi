import { useTranslation } from 'react-i18next'
import { LanguageToggle } from './components/LanguageToggle'

export default function App() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <span className="display text-xl">{t('app.name')}</span>
        <LanguageToggle />
      </div>
      <h1 className="display mt-10 text-3xl">{t('home.title')}</h1>
    </main>
  )
}
