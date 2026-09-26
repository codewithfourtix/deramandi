import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { setVoice } from '../components/Voice'
import { FarmerForm } from '../components/FarmerPicker'
import { TrashIcon } from '../components/Icons'
import { listingsCsv } from '../lib/csv'
import { cropModelsMB, downloadAllModels } from '../lib/offlineModels'
import { promptInstall, useInstallState } from '../lib/pwa'
import { DEMO_NUMBER_DISPLAY, updateSettings, useSettings } from '../lib/settings'
import { downloadFile } from '../lib/share'
import { loadFarmers, loadListings, makeBackup, removeFarmer, restoreBackup, useFarmers, useListings } from '../lib/storage'

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block font-bold">{label}</span>
        <span className="block text-[0.95rem] text-soil-soft">{hint}</span>
      </label>
      <input id={id} type="checkbox" role="switch" className="switch mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  )
}

export function Settings() {
  const { t } = useTranslation()
  const s = useSettings()
  const farmers = useFarmers()
  const listings = useListings()
  const install = useInstallState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<string | null>(null)
  const [confirmFarmer, setConfirmFarmer] = useState<string | null>(null)
  const [models, setModels] = useState<{ state: 'idle' | 'busy' | 'done' | 'failed'; done: number; total: number }>({ state: 'idle', done: 0, total: 0 })
  const stamp = new Date().toISOString().slice(0, 10)

  async function restore(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const added = await restoreBackup(JSON.parse(await file.text()))
      setNote(t('settings.restored', { listings: added.listings, farmers: added.farmers }))
    } catch {
      setNote(t('settings.restoreFailed'))
    }
  }

  return (
    <div>
      <h1 className="display text-[1.8rem]">{t('settings.title')}</h1>

      <section className="mt-5 divide-y divide-line border-y border-line" aria-label={t('settings.title')}>
        <Toggle id="set-voice" label={t('voice.bannerTitle')} hint={t('settings.voiceHint')} checked={s.voice} onChange={(v) => setVoice(v)} />
        <Toggle id="set-large" label={t('settings.largeText')} hint={t('settings.largeTextHint')} checked={s.largeText} onChange={(v) => updateSettings({ largeText: v })} />
        <Toggle id="set-helper" label={t('settings.helper')} hint={t('settings.helperHint')} checked={s.helperMode} onChange={(v) => updateSettings({ helperMode: v })} />
        <Toggle
          id="set-demo"
          label={t('settings.demo')}
          hint={t('settings.demoHint', { number: DEMO_NUMBER_DISPLAY })}
          checked={s.demoMode}
          onChange={(v) => updateSettings({ demoMode: v })}
        />
      </section>

      {s.helperMode && (
        <section className="mt-8" aria-labelledby="farmers-title">
          <h2 id="farmers-title" className="display text-xl">
            {t('farmers.title')}
          </h2>
          <p className="mt-1 text-soil-soft">{t('farmers.intro')}</p>
          {farmers.length > 0 && (
            <ul className="m-0 mt-3 list-none divide-y divide-line border-y border-line p-0">
              {farmers.map((f) => {
                const count = listings.filter((l) => l.farmerId === f.id).length
                return (
                  <li key={f.id} className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{f.name}</span>
                        <span className="block text-[0.9rem] text-soil-soft">
                          {[f.village, f.phone].filter(Boolean).join(' · ')}
                          {' · '}
                          {t('farmers.crops', { count })}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmFarmer(confirmFarmer === f.id ? null : f.id)}
                        aria-expanded={confirmFarmer === f.id}
                        aria-label={t('farmers.remove', { name: f.name })}
                        className="flex h-11 w-11 items-center justify-center rounded-md text-soil-soft hover:bg-warn-wash hover:text-warn"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    {confirmFarmer === f.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-warn-wash px-3 py-2">
                        <p className="me-auto font-bold text-warn">{t('farmers.confirm')}</p>
                        <button type="button" className="btn btn-quiet min-h-11 px-3" onClick={() => setConfirmFarmer(null)}>
                          {t('listings.keep')}
                        </button>
                        <button
                          type="button"
                          className="btn min-h-11 bg-warn px-3 text-paper"
                          onClick={() => {
                            removeFarmer(f.id)
                            setConfirmFarmer(null)
                            if (s.activeFarmerId === f.id) updateSettings({ activeFarmerId: undefined })
                          }}
                        >
                          {t('farmers.confirmRemove')}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <FarmerForm onSaved={(f) => updateSettings({ activeFarmerId: f.id })} />
        </section>
      )}

      <section className="mt-8" aria-labelledby="data-title">
        <h2 id="data-title" className="display text-xl">
          {t('settings.dataTitle')}
        </h2>
        <p className="mt-1 text-soil-soft">{t('settings.dataIntro')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="btn btn-quiet"
            disabled={!listings.length}
            onClick={() => downloadFile(new File([listingsCsv(loadListings(), loadFarmers())], `dera-mandi-crops-${stamp}.csv`, { type: 'text/csv' }))}
          >
            {t('settings.exportCsv')}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => downloadFile(new File([JSON.stringify(makeBackup())], `dera-mandi-backup-${stamp}.json`, { type: 'application/json' }))}
          >
            {t('settings.backup')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => fileRef.current?.click()}>
            {t('settings.restore')}
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={restore} />
        </div>
        <p aria-live="polite" className="mt-2 font-bold text-indus">
          {note}
        </p>
      </section>

      <section className="mt-8" aria-labelledby="offline-title">
        <h2 id="offline-title" className="display text-xl">
          {t('offlineModels.title')}
        </h2>
        <p className="mt-1 text-soil-soft">{t('offlineModels.body', { mb: cropModelsMB() })}</p>
        <button
          type="button"
          className="btn btn-quiet mt-3"
          disabled={models.state === 'busy'}
          onClick={async () => {
            setModels({ state: 'busy', done: 0, total: 0 })
            try {
              await downloadAllModels((done, total) => setModels({ state: 'busy', done, total }))
              setModels((m) => ({ ...m, state: 'done' }))
            } catch {
              setModels((m) => ({ ...m, state: 'failed' }))
            }
          }}
        >
          {t('offlineModels.button')}
        </button>
        <p aria-live="polite" className="mt-2 font-bold text-indus">
          {models.state === 'busy' && t('offlineModels.busy', { done: models.done, total: models.total })}
          {models.state === 'done' && t('offlineModels.done')}
          {models.state === 'failed' && <span className="text-warn">{t('offlineModels.failed')}</span>}
        </p>
      </section>

      {install !== 'unavailable' && (
        <section className="mt-8" aria-labelledby="install-title">
          <h2 id="install-title" className="display text-xl">
            {t('install.title')}
          </h2>
          {install === 'installed' ? (
            <p className="mt-1 text-soil-soft">{t('install.done')}</p>
          ) : (
            <>
              <p className="mt-1 text-soil-soft">{t('install.body')}</p>
              <button type="button" className="btn btn-primary mt-3" onClick={() => promptInstall()}>
                {t('install.button')}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  )
}
