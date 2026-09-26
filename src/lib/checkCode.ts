import type { CropId, Grade, Listing } from '../types'

/*
  The certificate's QR code opens /check#<payload>, a page that shows what the
  certificate says. The payload is the certificate's key facts, compact and
  URL-safe. It is NOT proof: anyone could make such a link, which is why the
  page is called "check details" and says so. The reference code is a short
  checksum of the same facts, printed on the certificate so the two can be
  compared by eye.
*/

export interface CheckPayload {
  v: 1
  id: string
  c: CropId
  q: number // kg
  l: string // area id
  g: Grade
  p?: [number, number, number] // model % for A, B, C
  s: 'model' | 'heuristic'
  pm: [number, number] // PKR/kg band
  d: string // ISO date
  lot?: [number, number, number] // whole-lot counts A, B, C
}

export function payloadFor(listing: Listing): CheckPayload {
  const p = listing.gradeProbabilities
  return {
    v: 1,
    id: listing.id,
    c: listing.crop,
    q: listing.quantityKg,
    l: listing.location,
    g: listing.grade,
    p: p ? [Math.round(p.A * 100), Math.round(p.B * 100), Math.round(p.C * 100)] : undefined,
    s: listing.gradeSource,
    pm: [listing.priceMin, listing.priceMax],
    d: listing.createdAt.slice(0, 10),
    lot: listing.lotCounts,
  }
}

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function encodePayload(p: CheckPayload): string {
  return toBase64Url(JSON.stringify(p))
}

export function decodePayload(s: string): CheckPayload | null {
  try {
    const p = JSON.parse(fromBase64Url(s))
    return p && p.v === 1 && p.id && p.c && p.g ? (p as CheckPayload) : null
  } catch {
    return null
  }
}

/** FNV-1a checksum of the facts, shown as e.g. "DM-4F2A-91C0". */
export function referenceCode(p: CheckPayload): string {
  const text = JSON.stringify([p.id, p.c, p.q, p.l, p.g, p.p, p.s, p.pm, p.d, p.lot])
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  const hex = h.toString(16).toUpperCase().padStart(8, '0')
  return `DM-${hex.slice(0, 4)}-${hex.slice(4)}`
}

export const APP_ORIGIN = 'https://deramandi.vercel.app'

export function checkUrl(listing: Listing) {
  return `${APP_ORIGIN}/check#${encodePayload(payloadFor(listing))}`
}
