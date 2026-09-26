import { buyers, cropInfo, locations, logistics, referencePrices } from '../data'
import type { Buyer, BuyerOffer, CropId, Grade, Listing, LogisticsProvider, ReferencePrice } from '../types'

export function priceBand(crop: CropId, grade: Grade): ReferencePrice {
  const band = referencePrices.find((p) => p.crop === crop && p.grade === grade)
  if (!band) throw new Error(`No reference price for ${crop} grade ${grade}`)
  return band
}

export function allBands(crop: CropId): ReferencePrice[] {
  return (['C', 'B', 'A'] as Grade[]).map((g) => priceBand(crop, g))
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
    const offer = buyer.offers.find((o) => o.crop === listing.crop && o.grade === listing.grade)
    if (!offer) continue
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
