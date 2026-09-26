import type { Buyer, CropId, Location, LogisticsProvider, ReferencePrice } from '../types'
import buyersJson from './buyers.json'
import locationsJson from './locations.json'
import logisticsJson from './logistics.json'
import pricesJson from './prices.json'

// All provider data below is illustrative sample data for the prototype.
export const buyers = buyersJson as Buyer[]
export const logistics = logisticsJson as LogisticsProvider[]
export const referencePrices = pricesJson as ReferencePrice[]
export const locations = locationsJson as Location[]

export interface CropInfo {
  id: CropId
  perishable: boolean
}

export const crops: CropInfo[] = [
  { id: 'dhakki_dates', perishable: true },
  { id: 'kulachi_melon', perishable: true },
  { id: 'wheat', perishable: false },
  { id: 'sugarcane', perishable: false },
  { id: 'other', perishable: true },
]

export function cropInfo(id: CropId): CropInfo {
  return crops.find((c) => c.id === id) ?? crops[crops.length - 1]
}
