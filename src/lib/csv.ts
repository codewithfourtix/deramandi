import { findBuyer } from './match'
import { checkUrl, payloadFor, referenceCode } from './checkCode'
import type { Farmer, Listing } from '../types'

/* Saved crops as a spreadsheet (opens in Excel or Google Sheets, Urdu intact). */

const HEAD = ['date', 'farmer', 'farmer_village', 'farmer_phone', 'crop', 'variety', 'quantity_kg', 'area', 'grade', 'grade_certainty', 'graded_by', 'price_min_pkr_per_kg', 'price_max_pkr_per_kg', 'status', 'buyer', 'reference', 'check_link']

const BOM = String.fromCharCode(0xfeff)

function cell(v: unknown) {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function listingsCsv(listings: Listing[], farmers: Farmer[]) {
  const byId = new Map(farmers.map((f) => [f.id, f]))
  const rows = listings.map((l) => {
    const f = l.farmerId ? byId.get(l.farmerId) : undefined
    return [
      l.createdAt.slice(0, 10),
      f?.name,
      f?.village,
      f?.phone,
      l.crop,
      l.variety,
      l.quantityKg,
      l.location,
      l.grade,
      Math.round(l.gradeConfidence * 100) + '%',
      l.gradeSource ?? 'rules',
      l.priceMin,
      l.priceMax,
      l.status,
      findBuyer(l.reservedBuyerId)?.name,
      referenceCode(payloadFor(l)),
      checkUrl(l),
    ]
  })
  // BOM so Excel reads UTF-8 (Urdu names) correctly
  return BOM + [HEAD, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}
