import { describe, expect, it } from 'vitest'
import { measure } from '../components/CameraGuide'

function frame(fn: (x: number, y: number) => number, side = 96) {
  const px = new Uint8ClampedArray(side * side * 4)
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const v = fn(x, y)
      const i = (y * side + x) * 4
      px[i] = px[i + 1] = px[i + 2] = v
      px[i + 3] = 255
    }
  return px
}

describe('camera checks', () => {
  it('warns about dark and bright frames', () => {
    expect(measure(frame(() => 20))).toBe('dark')
    expect(measure(frame(() => 250))).toBe('bright')
  })
  it('calls a flat frame blurry and a detailed one fine', () => {
    expect(measure(frame(() => 128))).toBe('blurry')
    expect(measure(frame((x, y) => ((x >> 1) + (y >> 1)) % 2 ? 90 : 170))).toBe('ok')
  })
})
