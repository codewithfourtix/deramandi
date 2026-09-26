import type { CropId, FactorLevel, Grade, GradeResult } from '../types'
import { loadImage } from './image'

/*
  gradeCrop is the one seam between the app and the grading model.
  Callers only ever see this signature, so the heuristic below can be replaced
  by the trained MobileNetV2 (TF.js) without touching any screen.

  The heuristic reads three things from each photo:
    size    - how much of the frame the produce fills (a proxy, not a measurement)
    color   - how close the produce colour is to ripe for this crop, and how even it is
    defects - share of produce pixels that look like dark spots, bruising or mould
  Same photo in, same grade out.
*/
export async function gradeCrop(images: string[], crop: CropId): Promise<GradeResult> {
  if (images.length === 0) throw new Error('gradeCrop needs at least one photo')
  const perImage = await Promise.all(images.map((src) => analyse(src, crop)))

  const avg = (k: keyof ImageScores) => perImage.reduce((s, r) => s + r[k], 0) / perImage.length
  const size = avg('size')
  const color = avg('color')
  const defects = avg('defects') // 0 = clean, 1 = heavily marked

  const score = combine(size, color, defects)
  const grade: Grade = score >= GRADE_A ? 'A' : score >= GRADE_B ? 'B' : 'C'

  // Confidence: distance from the nearest grade boundary, reduced when photos disagree.
  const boundaryGap = Math.min(Math.abs(score - GRADE_A), Math.abs(score - GRADE_B))
  const totals = perImage.map((r) => combine(r.size, r.color, r.defects))
  const spread = Math.max(...totals) - Math.min(...totals)
  const confidence = clamp(0.58 + boundaryGap * 2.2 - spread * 0.6 + (perImage.length - 1) * 0.03, 0.5, 0.94)

  return {
    grade,
    confidence: Math.round(confidence * 100) / 100,
    factors: {
      size: level(size, 0.55, 0.3),
      color: level(color, 0.62, 0.4),
      defects: level(1 - defects, 0.8, 0.6),
    },
    source: 'heuristic',
  }
}

const GRADE_A = 0.66
const GRADE_B = 0.48

function combine(size: number, color: number, defects: number) {
  return 0.2 * size + 0.45 * color + 0.35 * (1 - defects)
}

interface ImageScores {
  size: number
  color: number
  defects: number
}

// Target hue (degrees) and ideal saturation band for ripe produce, per crop.
const RIPE: Record<CropId, { hue: number; hueWidth: number; satMin: number; satMax: number }> = {
  dhakki_dates: { hue: 28, hueWidth: 22, satMin: 0.35, satMax: 0.9 }, // honey amber to deep brown
  kulachi_melon: { hue: 55, hueWidth: 28, satMin: 0.25, satMax: 0.8 }, // netted yellow-cream
  wheat: { hue: 42, hueWidth: 16, satMin: 0.3, satMax: 0.75 }, // golden grain
  sugarcane: { hue: 70, hueWidth: 45, satMin: 0.2, satMax: 0.8 }, // green-yellow stalk
  other: { hue: 40, hueWidth: 60, satMin: 0.2, satMax: 0.9 },
}

const SAMPLE = 96

async function analyse(src: string, crop: CropId): Promise<ImageScores> {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE
  canvas.height = SAMPLE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
  const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE)

  // Background estimate: mean colour of the outer border ring.
  let br = 0
  let bg = 0
  let bb = 0
  let bn = 0
  for (let y = 0; y < SAMPLE; y++) {
    for (let x = 0; x < SAMPLE; x++) {
      if (x > 3 && x < SAMPLE - 4 && y > 3 && y < SAMPLE - 4) continue
      const i = (y * SAMPLE + x) * 4
      br += data[i]
      bg += data[i + 1]
      bb += data[i + 2]
      bn++
    }
  }
  br /= bn
  bg /= bn
  bb /= bn

  const ripe = RIPE[crop]
  let fg = 0
  let colorHits = 0
  let defectHits = 0
  let lSum = 0
  let lSq = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (Math.hypot(r - br, g - bg, b - bb) < 48) continue // looks like background
    fg++
    const [h, s, v] = rgbToHsv(r, g, b)
    lSum += v
    lSq += v * v

    const hueDelta = Math.min(Math.abs(h - ripe.hue), 360 - Math.abs(h - ripe.hue))
    if (hueDelta <= ripe.hueWidth && s >= ripe.satMin && s <= ripe.satMax && v > 0.18) colorHits++

    const blackSpot = v < 0.12
    const mould = s < 0.12 && v > 0.55 && v < 0.92 // grey-white fuzz
    const unripeGreen = crop !== 'sugarcane' && h > 85 && h < 160 && s > 0.3
    if (blackSpot || mould || unripeGreen) defectHits++
  }

  const total = SAMPLE * SAMPLE
  if (fg < total * 0.05) {
    // Nothing separable from the background: a weak, uncertain photo.
    return { size: 0.2, color: 0.35, defects: 0.35 }
  }

  const coverage = fg / total
  const size = clamp((coverage - 0.15) / 0.6, 0, 1)
  const mean = lSum / fg
  const evenness = 1 - clamp(Math.sqrt(Math.max(0, lSq / fg - mean * mean)) / 0.3, 0, 1)
  const color = clamp(0.7 * (colorHits / fg) + 0.3 * evenness, 0, 1)
  const defects = clamp((defectHits / fg) * 2.5, 0, 1)

  return { size, color, defects }
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return [h, max === 0 ? 0 : d / max, max]
}

function level(value: number, good: number, fair: number): FactorLevel {
  return value >= good ? 'good' : value >= fair ? 'fair' : 'poor'
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}
