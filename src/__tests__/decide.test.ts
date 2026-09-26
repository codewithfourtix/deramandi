import { describe, expect, it } from 'vitest'
import { bestOption, compareOptions, defaultAssumptions } from '../lib/decide'
import { priceBand } from '../lib/match'

describe('sell now, store or ship', () => {
  it('takes commission off the local sale', () => {
    const a = defaultAssumptions('dhakki_dates')
    const [local] = compareOptions('dhakki_dates', 'A', 1000, a)
    const band = priceBand('dhakki_dates', 'A')
    const gross = ((band.min + band.max) / 2) * 1000
    expect(local.gross).toBeCloseTo(gross, 6)
    expect(local.takeHome).toBeCloseTo(gross * 0.95, 6)
  })

  it('charges one truck per 8,000 kg for Multan and loses a little weight on the road', () => {
    const a = defaultAssumptions('dhakki_dates')
    const multan = compareOptions('dhakki_dates', 'A', 9000, a).find((o) => o.key === 'multan')!
    expect(multan.available).toBe(true)
    expect(multan.costs.find((c) => c.key === 'transport')!.amount).toBe(2 * 18000)
    expect(multan.kgSold).toBeCloseTo(9000 * 0.97, 6)
  })

  it('makes storing worse when the price rise is zero', () => {
    const a = { ...defaultAssumptions('kulachi_melon'), storeRisePct: 0 }
    const opts = compareOptions('kulachi_melon', 'B', 2000, a)
    const local = opts.find((o) => o.key === 'local')!
    const store = opts.find((o) => o.key === 'store')!
    expect(store.takeHome).toBeLessThan(local.takeHome)
  })

  it('only offers the mill for sugarcane', () => {
    const opts = compareOptions('sugarcane', 'A', 5000, defaultAssumptions('sugarcane'))
    expect(opts.map((o) => o.key)).toEqual(['local'])
    expect(opts[0].note).toBe('mill')
  })

  it('picks the option with the most money in hand', () => {
    const opts = compareOptions('dhakki_dates', 'A', 5000, defaultAssumptions('dhakki_dates'))
    const best = bestOption(opts)
    for (const o of opts) if (o.available) expect(best.takeHome).toBeGreaterThanOrEqual(o.takeHome)
  })
})
