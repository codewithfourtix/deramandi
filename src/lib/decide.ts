import { cropInfo } from '../data'
import type { CropId, Grade } from '../types'
import { priceBand } from './match'
import { getRate } from './prices'

/*
  "Sell now, store, or ship?": what the grower takes home each way, after the
  costs that eat into it. Every assumption is a named, editable number, shown
  to the user; costs come from the sample providers (logistics.json) and prices
  from today's rates (prices.ts). This is an estimate to compare options, not a
  quote.
*/

export interface Assumptions {
  commissionPct: number // commission agent's cut at the mandi
  truckCost: number // PKR per truck, D.I. Khan to Multan (Indus Right Bank Transport, l03)
  truckKg: number // load per truck
  transitLossPct: number // weight/quality lost on the road (perishables)
  storeWeeks: number
  storeCostPerKgWeek: number // cold store (Gomal Cold Store, l01) or dry godown (Paroa, l07)
  storeRisePct: number // expected price rise after storing, off-season
  storeLossPctPerWeek: number
}

export function defaultAssumptions(crop: CropId): Assumptions {
  const perishable = cropInfo(crop).perishable
  return {
    commissionPct: 5,
    truckCost: 18000,
    truckKg: 8000,
    transitLossPct: perishable ? 3 : 0.5,
    storeWeeks: 4,
    storeCostPerKgWeek: perishable ? 6 : 0.5,
    storeRisePct: 10,
    storeLossPctPerWeek: perishable ? 1 : 0.2,
  }
}

export interface Option {
  key: 'local' | 'multan' | 'store'
  pricePerKg: number // gross price the buyer pays
  kgSold: number
  gross: number
  costs: { key: string; amount: number }[]
  takeHome: number
  perKg: number // take-home per kg brought
  available: boolean
  note?: 'noMultanRate' | 'mill'
}

const mid = (a: number, b: number) => (a + b) / 2

/** Price for this grade inside a market range, using the same thirds rule as the bands. */
function gradeWithin(min: number, max: number, grade: Grade) {
  const span = max - min
  const i = { C: 0, B: 1, A: 2 }[grade]
  return min + (span * (i + 0.5)) / 3
}

export function compareOptions(crop: CropId, grade: Grade, qtyKg: number, a: Assumptions): Option[] {
  const band = priceBand(crop, grade)
  const local = mid(band.min, band.max)
  const commission = (gross: number) => ({ key: 'commission', amount: (gross * a.commissionPct) / 100 })

  const opts: Option[] = []

  // 1. sell at the local mandi today
  {
    const gross = local * qtyKg
    const costs = [commission(gross)]
    const takeHome = gross - costs.reduce((s, c) => s + c.amount, 0)
    opts.push({ key: 'local', pricePerKg: local, kgSold: qtyKg, gross, costs, takeHome, perKg: takeHome / qtyKg, available: true, note: crop === 'sugarcane' ? 'mill' : undefined })
  }

  // Sugarcane goes to the mill; trucking or storing cane only loses sugar.
  if (crop === 'sugarcane') return opts

  // 2. truck to Multan and sell there
  {
    const multan = getRate(crop)?.rate.markets?.filter((m) => m.market.toLowerCase() === 'multan') ?? []
    if (multan.length) {
      const mMin = Math.min(...multan.map((m) => m.min))
      const mMax = Math.max(...multan.map((m) => m.max))
      const price = gradeWithin(mMin, mMax, grade)
      const kgSold = qtyKg * (1 - a.transitLossPct / 100)
      const gross = price * kgSold
      const trucks = Math.max(1, Math.ceil(qtyKg / a.truckKg))
      const costs = [commission(gross), { key: 'transport', amount: trucks * a.truckCost }]
      const takeHome = gross - costs.reduce((s, c) => s + c.amount, 0)
      opts.push({ key: 'multan', pricePerKg: price, kgSold, gross, costs, takeHome, perKg: takeHome / qtyKg, available: true })
    } else {
      opts.push({ key: 'multan', pricePerKg: 0, kgSold: 0, gross: 0, costs: [], takeHome: 0, perKg: 0, available: false, note: 'noMultanRate' })
    }
  }

  // 3. store, then sell locally
  {
    const price = local * (1 + a.storeRisePct / 100)
    const kgSold = qtyKg * Math.max(0, 1 - (a.storeLossPctPerWeek * a.storeWeeks) / 100)
    const gross = price * kgSold
    const costs = [commission(gross), { key: 'storage', amount: qtyKg * a.storeCostPerKgWeek * a.storeWeeks }]
    const takeHome = gross - costs.reduce((s, c) => s + c.amount, 0)
    opts.push({ key: 'store', pricePerKg: price, kgSold, gross, costs, takeHome, perKg: takeHome / qtyKg, available: true })
  }

  return opts
}

export function bestOption(opts: Option[]) {
  return opts.filter((o) => o.available).reduce((best, o) => (o.takeHome > best.takeHome ? o : best))
}
