import { buyers, cropInfo, locations, logistics } from '../data'
import type { Buyer, BuyerOffer, CropId, Grade, Listing, LogisticsProvider, ReferencePrice } from '../types'
import { bandFor, referenceBand } from './prices'

/** Fair band for a crop and grade: from today's market range when there is one (see prices.ts). */
export function priceBand(crop: CropId, grade: Grade): ReferencePrice {
  return bandFor(crop, grade)
}

/**
 * The band for a whole listing. A graded lot (some A, some B, some C photos)
 * gets the count-weighted mix of the three bands, so the price reflects the lot.
 */
export function listingBand(listing: Pick<Listing, 'crop' | 'grade' | 'lotCounts'>): { min: number; max: number } {
  const counts = listing.lotCounts
  const n = counts ? counts[0] + counts[1] + counts[2] : 0
  if (!counts || n === 0) return priceBand(listing.crop, listing.grade)
  const bands = (['A', 'B', 'C'] as Grade[]).map((g) => priceBand(listing.crop, g))
  const w = (k: 'min' | 'max') => bands.reduce((s, b, i) => s + b[k] * counts[i], 0) / n
  const r = (x: number) => (x >= 50 ? Math.round(x) : Math.round(x * 2) / 2)
  return { min: r(w('min')), max: r(w('max')) }
}

/** Most common grade in a lot; a tie goes to the lower grade, to stay conservative. */
export function lotGrade(counts: [number, number, number]): Grade {
  const max = Math.max(...counts)
  if (counts[2] === max) return 'C'
  if (counts[1] === max) return 'B'
  return 'A'
}

export function allBands(crop: CropId): ReferencePrice[] {
  return (['C', 'B', 'A'] as Grade[]).map((g) => priceBand(crop, g))
}

/*
  The seeded buyer offers were written against the reference table. When the
  band moves to today's market, each offer moves by the same factor, so a buyer
  who paid a little above the band still does.
*/
function scaleOffer(offer: BuyerOffer): BuyerOffer {
  const ref = referenceBand(offer.crop, offer.grade)
  const now = priceBand(offer.crop, offer.grade)
  const k = (now.min + now.max) / (ref.min + ref.max)
  if (!Number.isFinite(k) || Math.abs(k - 1) < 0.001) return offer
  const r = (x: number) => (x >= 50 ? Math.round(x) : Math.round(x * 2) / 2)
  return { ...offer, min: r(offer.min * k), max: r(offer.max * k) }
}

export interface BuyerMatch {
  buyer: Buyer
  offer: BuyerOffer
}

export interface BuyerMatches {
  matches: BuyerMatch[]
  // Buyers who want this crop and grade, but only for a bigger lot.
  // Drives the "combine with nearby lots" note, especially for exporters.
  tooSmallFor: BuyerMatch[]
}

const TYPE_ORDER: Record<Buyer['type'], number> = { exporter: 0, national_buyer: 1, local_wholesaler: 2 }

export function matchBuyers(listing: Pick<Listing, 'crop' | 'grade' | 'quantityKg'>): BuyerMatches {
  const matches: BuyerMatch[] = []
  const tooSmallFor: BuyerMatch[] = []

  for (const buyer of buyers) {
    const raw = buyer.offers.find((o) => o.crop === listing.crop && o.grade === listing.grade)
    if (!raw) continue
    const offer = scaleOffer(raw)
    if (listing.quantityKg >= buyer.minQuantityKg) matches.push({ buyer, offer })
    else tooSmallFor.push({ buyer, offer })
  }

  // Best offer first; ties go to the buyer who reaches further (export > national > local).
  matches.sort((a, b) => b.offer.max - a.offer.max || TYPE_ORDER[a.buyer.type] - TYPE_ORDER[b.buyer.type])
  tooSmallFor.sort((a, b) => a.buyer.minQuantityKg - b.buyer.minQuantityKg)
  return { matches, tooSmallFor }
}

export interface LogisticsMatch {
  provider: LogisticsProvider
  distanceKm: number
}

// Straight-line distance times a road factor. Good enough to rank nearby
// providers; shown to the farmer as an approximate figure.
const ROAD_FACTOR = 1.3

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function matchLogistics(listing: Pick<Listing, 'crop' | 'location'>, limit = 5): LogisticsMatch[] {
  const origin = locations.find((l) => l.id === listing.location) ?? locations[0]
  const perishable = cropInfo(listing.crop).perishable

  const ranked = logistics.map((provider) => ({
    provider,
    distanceKm: Math.max(1, Math.round(haversineKm(origin.lat, origin.lng, provider.lat, provider.lng) * ROAD_FACTOR)),
  }))

  ranked.sort((a, b) => {
    // Perishable fruit: cold chain first, then nearest. Everything else: nearest.
    if (perishable && a.provider.coldStorage !== b.provider.coldStorage) return a.provider.coldStorage ? -1 : 1
    return a.distanceKm - b.distanceKm
  })

  return ranked.slice(0, limit)
}

export function findBuyer(id?: string) {
  return buyers.find((b) => b.id === id)
}

export function findLogistics(id?: string) {
  return logistics.find((l) => l.id === id)
}
