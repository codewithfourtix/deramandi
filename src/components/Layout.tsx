import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router'
import { refreshLive } from '../lib/prices'
import { useOnline, useUpdateReady } from '../lib/pwa'
import { useSettings } from '../lib/settings'
import { LanguageToggle } from './LanguageToggle'
import { VoiceGuide, VoiceToggle } from './Voice'

function Wordmark() {
  const { t } = useTranslation()
  return (
    <Link to="/" className="flex min-h-11 items-center gap-1.5 text-soil no-underline" aria-label={t('app.home')}>
      <svg viewBox="0 0 64 64" width="28" height="28" aria-hidden="true">
        <circle cx="32" cy="32" r="29" fill="none" stroke="var(--color-date)" strokeWidth="4" />
        <circle cx="32" cy="32" r="21" fill="none" stroke="var(--color-date)" strokeWidth="2" />
        <path d="M25 21h7.5c6.2 0 10 4.2 10 11s-3.8 11-10 11H25z" fill="none" stroke="var(--color-soil)" strokeWidth="4.5" strokeLinejoin="round" />
      </svg>
      <span className="display whitespace-nowrap text-[1rem] leading-none min-[420px]:text-[1.15rem]">{t('app.name')}</span>
    </Link>
  )
}

export function Layout() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  // The result screen has a fixed send bar; leave room so it never hides the footer.
  const hasSendBar = Boolean(useMatch('/listing/:id'))
  const online = useOnline()
  const updateReady = useUpdateReady()
  const { largeText } = useSettings()

  // Large text: every size is in rem, so one root size scales the whole app.
  useEffect(() => {
    document.documentElement.classList.toggle('large-text', largeText)
  }, [largeText])

  // New screen: start at the top, as a farmer would expect.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    document.title = i18n.language === 'ur' ? 'ڈیرہ منڈی · Dera Mandi' : 'Dera Mandi · ڈیرہ منڈی'
  }, [i18n.language])

  // Fresh AMIS rates when online; the built-in snapshot covers offline use.
  useEffect(() => {
    if (navigator.onLine) refreshLive()
  }, [])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-soil focus:px-4 focus:py-2 focus:text-paper"
      >
        {t('nav.skip')}
      </a>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-1 px-3 py-2 sm:px-4">
          <Wordmark />
          <nav aria-label={t('nav.main')} className="ms-auto flex items-center gap-0.5 sm:gap-3">
            <NavLink
              to="/listings"
              className={({ isActive }) =>
                `flex min-h-11 items-center whitespace-nowrap rounded-md px-1.5 text-[0.95rem] font-bold underline-offset-4 hover:underline ${
                  isActive ? 'text-date-deep underline' : 'text-soil'
                }`
              }
            >
              {t('nav.myListings')}
            </NavLink>
            <VoiceToggle />
            <LanguageToggle />
          </nav>
        </div>
      </header>
      {updateReady && (
        <div role="status" className="flex items-center justify-center gap-3 bg-indus px-4 py-2 text-[0.95rem] text-paper">
          <span>{t('update.ready')}</span>
          <button type="button" onClick={() => location.reload()} className="min-h-11 rounded-md border-2 border-paper px-3 font-bold">
            {t('update.reload')}
          </button>
        </div>
      )}
      {!online && (
        <p role="status" className="m-0 bg-soil px-4 py-2 text-center text-[0.95rem] text-paper">
          {t('offline.banner')}
        </p>
      )}
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-6">
        <VoiceGuide />
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className={`mx-auto max-w-2xl px-4 pt-5 text-[0.9rem] text-soil-soft ${hasSendBar ? 'pb-36' : 'pb-8'}`}>
          <div className="flex flex-wrap gap-x-5">
            <Link to="/about" className="inline-flex min-h-11 items-center font-bold text-indus underline underline-offset-4">
              {t('footer.about')}
            </Link>
            <Link to="/prices" className="inline-flex min-h-11 items-center font-bold text-indus underline underline-offset-4">
              {t('rates.title')}
            </Link>
            <Link to="/accuracy" className="inline-flex min-h-11 items-center font-bold text-indus underline underline-offset-4">
              {t('footerLinks.accuracy')}
            </Link>
            <Link to="/settings" className="inline-flex min-h-11 items-center font-bold text-indus underline underline-offset-4">
              {t('footerLinks.settings')}
            </Link>
          </div>
          <p className="mt-1">{t('footer.note')}</p>
          <p>{t('footer.privacy')}</p>
        </div>
      </footer>
    </div>
  )
}
