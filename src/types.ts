export type CropId = 'dhakki_dates' | 'kulachi_melon' | 'wheat' | 'sugarcane' | 'other'
export type Grade = 'A' | 'B' | 'C'
export type FactorLevel = 'good' | 'fair' | 'poor'

export interface GradeFactors {
  size: FactorLevel
  color: FactorLevel
  defects: FactorLevel
}

export interface GradeResult {
  grade: Grade
  confidence: number // 0 to 1
  factors: GradeFactors
  source: 'heuristic' | 'model'
  /** Model only: averaged probability for each grade. */
  probabilities?: Record<Grade, number>
  /** Model only: the grade each photo got on its own. */
  perPhoto?: Grade[]
  /** Model only: photo colours fall well outside the khajoor it learned from. */
  unfamiliar?: boolean
}

export interface Listing {
  id: string
  crop: CropId
  variety?: string
  quantityKg: number
  location: string // location id from locations.json
  photos: string[] // downscaled JPEG data URLs
  grade: Grade
  gradeConfidence: number
  gradeFactors: GradeFactors
  gradeSource: GradeResult['source']
  gradeProbabilities?: Record<Grade, number>
  gradePerPhoto?: Grade[]
  gradeUnfamiliar?: boolean
  priceMin: number // PKR per kg
  priceMax: number
  referencePrice: number
  status: 'listed' | 'reserved'
  reservedBuyerId?: string
  reservedLogisticsId?: string
  reservedAt?: string
  createdAt: string
}

export interface BuyerOffer {
  crop: CropId
  grade: Grade
  min: number // PKR per kg
  max: number
}

// Offers are per crop and grade, since one buyer pays very differently for
// Grade A dates and Grade C dates. "Buys crop X at grade Y" = has an offer row.
export interface Buyer {
  id: string
  name: string
  nameUr: string
  type: 'local_wholesaler' | 'national_buyer' | 'exporter'
  location: string // place key, see i18n "places"
  minQuantityKg: number
  verified: boolean
  offers: BuyerOffer[]
}

export interface LogisticsProvider {
  id: string
  name: string
  nameUr: string
  type: 'storage' | 'transport' | 'both'
  location: string // place key
  lat: number
  lng: number
  coldStorage: boolean
  capacityKg?: number
  priceNote: { en: string; ur: string }
}

export interface ReferencePrice {
  crop: CropId
  grade: Grade
  min: number
  max: number
}

export interface Location {
  id: string
  lat: number
  lng: number
}
