import { describe, expect, it } from 'vitest'
import snapshot from '../data/marketPrices.json'
import { bandFor, clearMyRate, getRate, setMyRate } from '../lib/prices'
import { matchBuyers } from '../lib/match'
import type { CropId } from '../types'

const MARKET_CROPS: CropId[] = ['dhakki_dates', 'kulachi_melon', 'wheat', 'sugarcane']

describe('market price snapshot', () => {
  it('has a dated, sourced PKR/kg range for every crop with a public rate', () => {
    for (const crop of MARKET_CROPS) {
      const r = (snapshot.crops as Record<string, { min: number; max: number; date: string; source: string }>)[crop]
      expect(r, crop).toBeTruthy()
      expect(r.min).toBeGreaterThan(0)
      expect(r.max).toBeGreaterThan(r.min)
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(r.source.length).toBeGreaterThan(5)
    }
  })

  it('splits the market range into thirds: C bottom, B middle, A top', () => {
    for (const crop of MARKET_CROPS) {
      const { rate } = getRate(crop)!
      const C = bandFor(crop, 'C')
      const A = bandFor(crop, 'A')
      expect(Math.abs(C.min - rate.min)).toBeLessThanOrEqual(1) // bands round to whole rupees above Rs 50
      expect(Math.abs(A.max - rate.max)).toBeLessThanOrEqual(1)
      expect(A.origin).not.toBe('reference')
    }
  })

  it('uses the reference table for crops with no public rate', () => {
    expect(getRate('other')).toBeNull()
    expect(bandFor('other', 'A').origin).toBe('reference')
  })
})

describe("the grower's own rate", () => {
  it('overrides the market and moves buyer offers with it', () => {
    const before = matchBuyers({ crop: 'wheat', grade: 'A', quantityKg: 10000 }).matches[0].offer
    setMyRate('wheat', 200, 260)
    expect(getRate('wheat')!.origin).toBe('mine')
    expect(bandFor('wheat', 'A')).toMatchObject({ min: 240, max: 260 })
    const after = matchBuyers({ crop: 'wheat', grade: 'A', quantityKg: 10000 }).matches[0].offer
    expect(after.max).toBeGreaterThan(before.max)
    clearMyRate('wheat')
    expect(getRate('wheat')!.origin).not.toBe('mine')
  })
})
