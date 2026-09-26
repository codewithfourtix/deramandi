import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import ur from './ur.json'

export type Lang = 'ur' | 'en'

const STORAGE_KEY = 'deramandi.lang'

// Urdu first: the farmer is the primary user. No browser-language sniffing.
function readSavedLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ur') return saved
  } catch {
    // storage blocked: fall through to the default
  }
  return 'ur'
}

function applyDirection(lang: string) {
  const root = document.documentElement
  root.lang = lang
  root.dir = lang === 'ur' ? 'rtl' : 'ltr'
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ur: { translation: ur } },
  lng: readSavedLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyDirection(i18n.language)

i18n.on('languageChanged', (lang) => {
  applyDirection(lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // not fatal: language just won't persist
  }
})

export default i18n
