import i18n from '../i18n'
import type { Buyer, Farmer, Listing, LogisticsProvider } from '../types'
import { checkUrl, payloadFor, referenceCode } from './checkCode'
import { fmtNum, fmtRange, ltr } from './format'

/*
  Sharing without a server. On Android Chrome the share sheet can hand a PDF or
  an image straight to WhatsApp (chat or Status). Where it can't, we open a
  WhatsApp chat with the message typed in (wa.me) and download the file so it
  can be attached by hand. wa.me itself cannot carry a file.
*/

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

export function canShareFiles(files: File[]) {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files })
  } catch {
    return false
  }
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function shareOrDownload(files: File[], text: string, title: string): Promise<ShareOutcome> {
  if (canShareFiles(files)) {
    try {
      await navigator.share({ files, text, title })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }
  files.forEach(downloadFile)
  return 'downloaded'
}

export function whatsappUrl(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

/** Request message in Urdu and English. Demo messages say so on the first line. */
export function requestMessage(opts: { listing: Listing; buyer?: Buyer; logistics?: LogisticsProvider; farmer?: Farmer; demo: boolean }) {
  const { listing, buyer, logistics, farmer, demo } = opts
  const en = i18n.getFixedT('en')
  const ur = i18n.getFixedT('ur')
  const ref = referenceCode(payloadFor(listing))
  const lines = [
    demo ? '*DEMO REQUEST* (Dera Mandi hackathon prototype, not a real sale)' : '*Dera Mandi request*',
    '',
    `السلام علیکم۔ ${ur(`crops.${listing.crop}`)}، گریڈ ${listing.grade}، ${ltr(fmtNum(listing.quantityKg))} کلو، ${ur(`places.${listing.location}`)}۔`,
    `جائز قیمت: ${ltr(fmtRange(listing.priceMin, listing.priceMax))} روپے فی کلو۔`,
    '',
    `Crop: ${en(`crops.${listing.crop}`)}${listing.variety ? ` (${listing.variety})` : ''}`,
    `Grade: ${listing.grade}${listing.gradeProbabilities ? ` (model ${Math.round(listing.gradeProbabilities[listing.grade] * 100)}% sure)` : ''}`,
    `Quantity: ${fmtNum(listing.quantityKg)} kg`,
    `Area: ${en(`places.${listing.location}`)}`,
    `Fair price for this grade: PKR ${fmtRange(listing.priceMin, listing.priceMax)}/kg`,
  ]
  if (buyer) lines.push(`To: ${buyer.name}`)
  if (logistics) lines.push(`Storage/transport: ${logistics.name}`)
  if (farmer) lines.push(`Grower: ${farmer.name}${farmer.phone ? `, ${farmer.phone}` : ''}`)
  lines.push('', `Certificate ${ref}: ${checkUrl(listing)}`)
  return lines.join('\n')
}
