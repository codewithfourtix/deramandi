import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { findBuyer, findLogistics } from '../lib/match'
import { shareOrDownload, type ShareOutcome } from '../lib/share'
import { getFarmer } from '../lib/storage'
import type { Listing } from '../types'
import { DocIcon, StatusIcon } from './Icons'

type Busy = null | 'pdf' | 'status'

/*
  Certificate PDF and WhatsApp Status image for one listing. Both are drawn on
  the phone; the heavy PDF/QR code loads only when a button is tapped.
*/
export function ShareActions({ listing }: { listing: Listing }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<string | null>(null)

  const farmer = getFarmer(listing.farmerId)

  function report(outcome: ShareOutcome, kind: 'pdf' | 'status') {
    if (outcome === 'shared') setNote(t(`share.${kind}Shared`))
    else if (outcome === 'downloaded') setNote(t(`share.${kind}Downloaded`))
    else setNote(null)
  }

  async function certificate() {
    setBusy('pdf')
    setNote(null)
    try {
      const { makeCertificatePdf } = await import('../lib/certificate')
      const file = await makeCertificatePdf({
        listing,
        buyer: findBuyer(listing.reservedBuyerId),
        logistics: findLogistics(listing.reservedLogisticsId),
        farmer,
      })
      report(await shareOrDownload([file], t('share.pdfText'), file.name), 'pdf')
    } catch (err) {
      console.error(err)
      setNote(t('share.failed'))
    } finally {
      setBusy(null)
    }
  }

  async function status() {
    setBusy('status')
    setNote(null)
    try {
      const { makeStatusImage } = await import('../lib/statusImage')
      const file = await makeStatusImage(listing, farmer)
      report(await shareOrDownload([file], t('share.statusText'), file.name), 'status')
    } catch (err) {
      console.error(err)
      setNote(t('share.failed'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby={`share-${listing.id}`} className="rounded-md border-2 border-line bg-sheet p-3">
      <h2 id={`share-${listing.id}`} className="font-bold">
        {t('share.title')}
      </h2>
      <p className="text-[0.95rem] text-soil-soft">{t('share.lede')}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" className="btn btn-quiet" onClick={certificate} disabled={busy !== null} aria-busy={busy === 'pdf'}>
          <DocIcon />
          {busy === 'pdf' ? t('share.making') : t('share.pdf')}
        </button>
        <button type="button" className="btn btn-quiet" onClick={status} disabled={busy !== null} aria-busy={busy === 'status'}>
          <StatusIcon />
          {busy === 'status' ? t('share.making') : t('share.status')}
        </button>
      </div>
      <p className="mt-2 min-h-[1.5em] text-[0.95rem] font-bold text-field" role="status">
        {note}
      </p>
    </section>
  )
}
