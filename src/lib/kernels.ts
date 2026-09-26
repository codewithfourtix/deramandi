/*
  Find the separate objects (wheat kernels) in a photo of grain spread on a
  plain cloth, and cut each one out as a square crop padded with the cloth
  colour: the same framing as the single-kernel photos the wheat model learned
  from. Works at a reduced size to find objects, then crops from the full photo.
*/

const WORK = 520
const THRESHOLD = 44
const MARGIN = 0.18

export interface FoundObjects {
  crops: ImageData[]
  /** Objects that looked like touching clumps and were skipped. */
  skipped: number
  /** True when no separate objects were found and the whole photo was used. */
  wholeImage: boolean
}

export function findObjects(img: HTMLImageElement | HTMLCanvasElement, size: number, maxObjects = 60): FoundObjects {
  const scale = Math.min(1, WORK / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const work = document.createElement('canvas')
  work.width = w
  work.height = h
  const wctx = work.getContext('2d', { willReadFrequently: true })!
  wctx.drawImage(img, 0, 0, w, h)
  const px = wctx.getImageData(0, 0, w, h).data

  // cloth colour from the border ring
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= 4 && x < w - 4 && y >= 4 && y < h - 4) continue
      const i = (y * w + x) * 4
      r += px[i]
      g += px[i + 1]
      b += px[i + 2]
      n++
    }
  }
  r /= n
  g /= n
  b /= n

  const mask = new Uint8Array(w * h)
  for (let p = 0; p < w * h; p++) {
    const i = p * 4
    if (Math.hypot(px[i] - r, px[i + 1] - g, px[i + 2] - b) >= THRESHOLD) mask[p] = 1
  }

  // connected components (4-neighbour), iterative
  const label = new Int32Array(w * h)
  const comps: { x0: number; y0: number; x1: number; y1: number; area: number }[] = []
  const stack: number[] = []
  for (let p = 0; p < w * h; p++) {
    if (!mask[p] || label[p]) continue
    const id = comps.length + 1
    const c = { x0: w, y0: h, x1: 0, y1: 0, area: 0 }
    label[p] = id
    stack.push(p)
    while (stack.length) {
      const q = stack.pop()!
      const x = q % w
      const y = (q - x) / w
      c.area++
      if (x < c.x0) c.x0 = x
      if (x > c.x1) c.x1 = x
      if (y < c.y0) c.y0 = y
      if (y > c.y1) c.y1 = y
      if (x > 0 && mask[q - 1] && !label[q - 1]) (label[q - 1] = id), stack.push(q - 1)
      if (x < w - 1 && mask[q + 1] && !label[q + 1]) (label[q + 1] = id), stack.push(q + 1)
      if (y > 0 && mask[q - w] && !label[q - w]) (label[q - w] = id), stack.push(q - w)
      if (y < h - 1 && mask[q + w] && !label[q + w]) (label[q + w] = id), stack.push(q + w)
    }
    comps.push(c)
  }

  const total = w * h
  const sized = comps.filter((c) => c.area >= total * 0.0006 && c.area <= total * 0.3)
  if (!sized.length) return { crops: [cropBox(img, 0, 0, img.width, img.height, size, r, g, b)], skipped: 0, wholeImage: true }

  // Clumps of touching kernels show up as objects far bigger than the typical one: skip them.
  const areas = sized.map((c) => c.area).sort((a, z) => a - z)
  const typical = areas[Math.floor(areas.length / 2)]
  const singles = sized.filter((c) => c.area <= typical * 2.6)
  const skipped = sized.length - singles.length
  if (singles.length === 1 && singles[0].area > total * 0.05) {
    // one big object: a close-up of a single kernel
    const c = singles[0]
    return { crops: [cropFromWork(img, c, scale, size, r, g, b)], skipped, wholeImage: false }
  }
  const crops = singles.slice(0, maxObjects).map((c) => cropFromWork(img, c, scale, size, r, g, b))
  return { crops, skipped, wholeImage: false }
}

function cropFromWork(img: HTMLImageElement | HTMLCanvasElement, c: { x0: number; y0: number; x1: number; y1: number }, scale: number, size: number, r: number, g: number, b: number) {
  const bw = (c.x1 - c.x0 + 1) / scale
  const bh = (c.y1 - c.y0 + 1) / scale
  const mx = bw * MARGIN
  const my = bh * MARGIN
  const x = Math.max(0, c.x0 / scale - mx)
  const y = Math.max(0, c.y0 / scale - my)
  const x2 = Math.min(img.width, (c.x1 + 1) / scale + mx)
  const y2 = Math.min(img.height, (c.y1 + 1) / scale + my)
  return cropBox(img, x, y, x2 - x, y2 - y, size, r, g, b)
}

function cropBox(img: HTMLImageElement | HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, size: number, r: number, g: number, b: number) {
  const side = Math.max(sw, sh)
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
  ctx.fillRect(0, 0, size, size)
  const k = size / side
  ctx.drawImage(img, sx, sy, sw, sh, ((side - sw) / 2) * k, ((side - sh) / 2) * k, sw * k, sh * k)
  return ctx.getImageData(0, 0, size, size)
}
