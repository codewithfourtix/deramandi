import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation, useMatch } from 'react-router'
import { LanguageToggle } from './LanguageToggle'

function Wordmark() {
  const { t } = useTranslation()
  return (
    <Link to="/" className="flex min-h-11 items-center gap-2 text-soil no-underline" aria-label={t('app.home')}>
      <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
        <circle cx="32" cy="32" r="29" fill="none" stroke="var(--color-date)" strokeWidth="4" />
        <circle cx="32" cy="32" r="21" fill="none" stroke="var(--color-date)" strokeWidth="2" />
        <path d="M25 21h7.5c6.2 0 10 4.2 10 11s-3.8 11-10 11H25z" fill="none" stroke="var(--color-soil)" strokeWidth="4.5" strokeLinejoin="round" />
      </svg>
      <span className="display whitespace-nowrap text-[1.15rem] leading-none">{t('app.name')}</span>
    </Link>
  )
}

export function Layout() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  // The result screen has a fixed send bar; leave room so it never hides the footer.
  const hasSendBar = Boolean(useMatch('/listing/:id'))

  // New screen: start at the top, as a farmer would expect.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    document.title = i18n.language === 'ur' ? 'ڈیرہ منڈی · Dera Mandi' : 'Dera Mandi · ڈیرہ منڈی'
  }, [i18n.language])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-soil focus:px-4 focus:py-2 focus:text-paper"
      >
        {t('nav.skip')}
      </a>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2">
          <Wordmark />
          <nav aria-label={t('nav.main')} className="flex items-center gap-1 sm:gap-3">
            <NavLink
              to="/listings"
              className={({ isActive }) =>
                `flex min-h-11 items-center whitespace-nowrap rounded-md px-2 text-[0.95rem] font-bold underline-offset-4 hover:underline ${
                  isActive ? 'text-date-deep underline' : 'text-soil'
                }`
              }
            >
              {t('nav.myListings')}
            </NavLink>
            <LanguageToggle />
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-6">
        <Outlet />
      </main>
      <footer className="border-t border-line">
        <div className={`mx-auto max-w-2xl px-4 pt-5 text-[0.9rem] text-soil-soft ${hasSendBar ? 'pb-36' : 'pb-8'}`}>
          <Link to="/about" className="inline-flex min-h-11 items-center font-bold text-indus underline underline-offset-4">
            {t('footer.about')}
          </Link>
          <p className="mt-1">{t('footer.note')}</p>
          <p>{t('footer.privacy')}</p>
        </div>
      </footer>
    </div>
  )
}
