import { describe, expect, it } from 'vitest'
import { scorePixels } from '../lib/grader'

const SIDE = 96
type RGB = [number, number, number]

// Build a 96x96 frame: a plain cloth, with an optional blob of produce in the middle.
function frame(bg: RGB, blob?: { color: RGB; radius: number; spots?: RGB; spotEvery?: number }) {
  const data = new Uint8ClampedArray(SIDE * SIDE * 4)
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      const i = (y * SIDE + x) * 4
      let c = bg
      if (blob && Math.hypot(x - 48, y - 48) < blob.radius) {
        c = blob.color
        if (blob.spots && blob.spotEvery && (x * 7 + y * 13) % blob.spotEvery === 0) c = blob.spots
      }
      data[i] = c[0]
      data[i + 1] = c[1]
      data[i + 2] = c[2]
      data[i + 3] = 255
    }
  }
  return data
}

const CLOTH: RGB = [233, 228, 218]
const RIPE_DATE: RGB = [170, 95, 35] // honey amber
const PALE: RGB = [205, 200, 170]

describe('photo checks', () => {
  it('rejects a photo that is nearly black', () => {
    expect(scorePixels(frame([10, 8, 6]), 'dhakki_dates').issue).toBe('too_dark')
  })

  it('rejects a washed-out photo', () => {
    expect(scorePixels(frame([252, 252, 252]), 'dhakki_dates').issue).toBe('too_bright')
  })

  it('rejects a plain wall with no crop in it', () => {
    expect(scorePixels(frame(CLOTH), 'dhakki_dates').issue).toBe('no_crop')
  })

  it('accepts an even close-up where the crop fills the frame', () => {
    const r = scorePixels(frame(RIPE_DATE), 'dhakki_dates')
    expect(r.issue).toBeUndefined()
    expect(r.color).toBeGreaterThan(0.6)
  })
})

describe('scoring', () => {
  it('scores ripe, clean dates well on colour and defects', () => {
    const r = scorePixels(frame(CLOTH, { color: RIPE_DATE, radius: 40 }), 'dhakki_dates')
    expect(r.issue).toBeUndefined()
    expect(r.color).toBeGreaterThan(0.6)
    expect(r.defects).toBeLessThan(0.1)
  })

  it('scores pale produce lower on colour than ripe produce', () => {
    const ripe = scorePixels(frame(CLOTH, { color: RIPE_DATE, radius: 40 }), 'dhakki_dates')
    const pale = scorePixels(frame([60, 50, 40], { color: PALE, radius: 40 }), 'dhakki_dates')
    expect(pale.color).toBeLessThan(ripe.color)
  })

  it('counts dark spots and green patches as defects', () => {
    const clean = scorePixels(frame(CLOTH, { color: RIPE_DATE, radius: 40 }), 'dhakki_dates')
    const spotted = scorePixels(frame(CLOTH, { color: RIPE_DATE, radius: 40, spots: [15, 10, 6], spotEvery: 6 }), 'dhakki_dates')
    const green = scorePixels(frame(CLOTH, { color: RIPE_DATE, radius: 40, spots: [90, 150, 50], spotEvery: 6 }), 'dhakki_dates')
    expect(spotted.defects).toBeGreaterThan(clean.defects + 0.3)
    expect(green.defects).toBeGreaterThan(clean.defects + 0.3)
  })

  it('reads bigger coverage as a bigger size score', () => {
    const small = scorePixels(frame(CLOTH, { color: RIPE_DATE, radius: 20 }), 'dhakki_dates')
    const big = scorePixels(frame(CLOTH, { color: RIPE_DATE, radius: 45 }), 'dhakki_dates')
    expect(big.size).toBeGreaterThan(small.size)
  })

  it('is deterministic', () => {
    const data = frame(CLOTH, { color: RIPE_DATE, radius: 35, spots: [15, 10, 6], spotEvery: 11 })
    expect(scorePixels(data, 'dhakki_dates')).toEqual(scorePixels(data, 'dhakki_dates'))
  })
})
