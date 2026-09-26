import { describe, expect, it } from 'vitest'
import { buyers, crops, logistics } from '../data'
import { allBands, matchBuyers, matchLogistics, priceBand } from '../lib/match'
import type { Grade } from '../types'

const GRADES: Grade[] = ['A', 'B', 'C']

describe('reference prices', () => {
  it('exist for every crop and grade', () => {
    for (const c of crops) for (const g of GRADES) expect(() => priceBand(c.id, g)).not.toThrow()
  })

  it('rank grade A above B, and B above C, with no overlap', () => {
    for (const c of crops) {
      const [C, B, A] = allBands(c.id)
      expect(A.min, c.id).toBeGreaterThanOrEqual(B.max)
      expect(B.min, c.id).toBeGreaterThanOrEqual(C.max)
      expect(A.max, c.id).toBeGreaterThan(B.max)
      expect(B.max, c.id).toBeGreaterThan(C.max)
      for (const band of [A, B, C]) expect(band.min).toBeLessThan(band.max)
    }
  })
})

describe('seed buyers', () => {
  it('have sane offers', () => {
    const cropIds = new Set(crops.map((c) => c.id))
    for (const b of buyers) {
      expect(b.offers.length, b.id).toBeGreaterThan(0)
      for (const o of b.offers) {
        expect(cropIds.has(o.crop), `${b.id} ${o.crop}`).toBe(true)
        expect(GRADES).toContain(o.grade)
        expect(o.min).toBeLessThanOrEqual(o.max)
      }
    }
  })

  it('have unique ids', () => {
    expect(new Set(buyers.map((b) => b.id)).size).toBe(buyers.length)
    expect(new Set(logistics.map((l) => l.id)).size).toBe(logistics.length)
  })
})

describe('matchBuyers', () => {
  it('finds at least one buyer for every crop and grade when the lot is large', () => {
    for (const c of crops) {
      for (const g of GRADES) {
        expect(matchBuyers({ crop: c.id, grade: g, quantityKg: 10000 }).matches.length, `${c.id} ${g}`).toBeGreaterThan(0)
      }
    }
  })

  it('only returns buyers who take that crop and grade and whose minimum the lot meets', () => {
    const { matches } = matchBuyers({ crop: 'dhakki_dates', grade: 'A', quantityKg: 1200 })
    expect(matches.map((m) => m.buyer.id)).toEqual(['b08', 'b07', 'b01'])
    for (const m of matches) {
      expect(m.offer.crop).toBe('dhakki_dates')
      expect(m.offer.grade).toBe('A')
      expect(m.buyer.minQuantityKg).toBeLessThanOrEqual(1200)
    }
  })

  it('sorts by best offer first', () => {
    const { matches } = matchBuyers({ crop: 'kulachi_melon', grade: 'A', quantityKg: 5000 })
    const tops = matches.map((m) => m.offer.max)
    expect([...tops].sort((a, b) => b - a)).toEqual(tops)
  })

  it('shows the empty state for a small sugarcane lot', () => {
    const { matches } = matchBuyers({ crop: 'sugarcane', grade: 'A', quantityKg: 100 })
    expect(matches).toHaveLength(0)
  })

  it('flags the exporter a small melon lot is too small for', () => {
    const { matches, tooSmallFor } = matchBuyers({ crop: 'kulachi_melon', grade: 'A', quantityKg: 300 })
    expect(matches.map((m) => m.buyer.id)).toEqual(['b01'])
    expect(tooSmallFor.some((m) => m.buyer.type === 'exporter')).toBe(true)
  })
})

describe('matchLogistics', () => {
  it('puts cold storage first for perishable fruit', () => {
    const list = matchLogistics({ crop: 'dhakki_dates', location: 'kulachi' })
    const coldCount = list.filter((m) => m.provider.coldStorage).length
    expect(list.slice(0, coldCount).every((m) => m.provider.coldStorage)).toBe(true)
    expect(coldCount).toBeGreaterThan(0)
  })

  it('sorts purely by distance for grain', () => {
    const list = matchLogistics({ crop: 'wheat', location: 'paharpur' })
    const d = list.map((m) => m.distanceKm)
    expect([...d].sort((a, b) => a - b)).toEqual(d)
    expect(list[0].provider.id).toBe('l05') // Paharpur Goods Transport, in town
  })

  it('gives believable road distances', () => {
    const toMultan = matchLogistics({ crop: 'wheat', location: 'dik_city' }, 20).find((m) => m.provider.id === 'l08')
    expect(toMultan!.distanceKm).toBeGreaterThan(180)
    expect(toMultan!.distanceKm).toBeLessThan(320)
  })
})
