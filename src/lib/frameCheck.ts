/* Live camera checks: is the frame too dark, too bright, or blurred? */

export type Check = 'ok' | 'dark' | 'bright' | 'blurry'

/** Brightness and sharpness of a small frame. Rough thresholds: a warning to the person, never a block. */
export function measure(px: Uint8ClampedArray | number[]): Check {
  const side = Math.round(Math.sqrt(px.length / 4))
  const lum = new Float32Array(side * side)
  let sum = 0
  for (let i = 0; i < lum.length; i++) {
    lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
    sum += lum[i]
  }
  const mean = sum / lum.length
  if (mean < 50) return 'dark'
  if (mean > 230) return 'bright'
  // Laplacian energy: sharp frames have strong local contrast
  let energy = 0
  for (let y = 1; y < side - 1; y++) {
    for (let x = 1; x < side - 1; x++) {
      const i = y * side + x
      const lap = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - side] - lum[i + side]
      energy += lap * lap
    }
  }
  energy /= (side - 2) * (side - 2)
  return energy < 18 ? 'blurry' : 'ok'
}
