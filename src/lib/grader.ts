import type { CropId, FactorLevel, Grade, GradeResult } from '../types'
import { loadImage } from './image'

/*
  gradeCrop is the one seam between the app and the graders.

  Khajoor (Dhakki dates): a MobileNetV2 image model trained on graded Pakistani
  khajoor photos (see ml/ and src/lib/model.ts). If the model cannot load, no
  grade is given (ModelUnavailable): the rules below measured below chance on
  khajoor, so they are not used as a fallback for it.

  Every other crop: rule-based analysis, because no graded photo set exists for
  them yet. Each photo is checked first (is it lit, is there produce in it?),
  then read for:
    size    - how much of the frame the produce fills (a proxy, not a measurement)
    color   - how close the produce colour is to ripe for this crop, and how even it is
    defects - share of produce pixels that look like dark spots, bruising or mould
  Same photo in, same grade out.
*/

export type PhotoIssue = 'no_crop' | 'too_dark' | 'too_bright'

/** Thrown when a photo can't be graded fairly. The farmer should retake it. */
export class PhotoProblem extends Error {
  readonly issue: PhotoIssue
  readonly photoIndex: number
  constructor(issue: PhotoIssue, photoIndex: number) {
    super(`photo ${photoIndex + 1}: ${issue}`)
    this.name = 'PhotoProblem'
    this.issue = issue
    this.photoIndex = photoIndex
  }
}

/** The khajoor model could not load (e.g. first use while offline). */
export class ModelUnavailable extends Error {
  constructor() {
    super('grade model unavailable')
    this.name = 'ModelUnavailable'
  }
}

export async function gradeCrop(images: string[], crop: CropId): Promise<GradeResult> {
  if (images.length === 0) throw new Error('gradeCrop needs at least one photo')
  const perImage = await Promise.all(images.map((src) => analyse(src, crop)))

  const bad = perImage.findIndex((r) => r.issue)
  if (bad !== -1) throw new PhotoProblem(perImage[bad].issue as PhotoIssue, bad)

  const avg = (k: 'size' | 'color' | 'defects') => perImage.reduce((s, r) => s + r[k], 0) / perImage.length
  const factors = {
    size: level(avg('size'), 0.55, 0.3),
    color: level(avg('color'), 0.62, 0.4),
    defects: level(1 - avg('defects'), 0.8, 0.6),
  }

  if (crop === 'dhakki_dates') {
    try {
      const { gradeWithModel } = await import('./model')
      const m = await gradeWithModel(images)
      const grade = (['A', 'B', 'C'] as Grade[]).reduce((best, g) => (m.probabilities[g] > m.probabilities[best] ? g : best), 'A' as Grade)
      return {
        grade,
        confidence: Math.round(m.probabilities[grade] * 100) / 100,
        factors,
        source: 'model',
        probabilities: m.probabilities,
        perPhoto: m.perPhoto,
        unfamiliar: m.unfamiliar,
      }
    } catch (err) {
      // No silent fallback: the rules scored below chance on khajoor, so a
      // wrong-but-confident grade is worse than asking to try again.
      console.warn('Grade model unavailable', err)
      throw new ModelUnavailable()
    }
  }

  return gradeByRules(perImage, factors)
}

/** The rule-based path on its own, for comparing it with the model. */
export async function gradeCropRulesOnly(images: string[], crop: CropId): Promise<GradeResult> {
  const perImage = await Promise.all(images.map((src) => analyse(src, crop)))
  const bad = perImage.findIndex((r) => r.issue)
  if (bad !== -1) throw new PhotoProblem(perImage[bad].issue as PhotoIssue, bad)
  const avg = (k: 'size' | 'color' | 'defects') => perImage.reduce((s, r) => s + r[k], 0) / perImage.length
  return gradeByRules(perImage, {
    size: level(avg('size'), 0.55, 0.3),
    color: level(avg('color'), 0.62, 0.4),
    defects: level(1 - avg('defects'), 0.8, 0.6),
  })
}

function gradeByRules(perImage: ImageScores[], factors: GradeResult['factors']): GradeResult {
  const avg = (k: 'size' | 'color' | 'defects') => perImage.reduce((s, r) => s + r[k], 0) / perImage.length
  const score = combine(avg('size'), avg('color'), avg('defects'))
  const grade: Grade = score >= GRADE_A ? 'A' : score >= GRADE_B ? 'B' : 'C'

  // Confidence: distance from the nearest grade boundary, reduced when photos disagree.
  const boundaryGap = Math.min(Math.abs(score - GRADE_A), Math.abs(score - GRADE_B))
  const totals = perImage.map((r) => combine(r.size, r.color, r.defects))
  const spread = Math.max(...totals) - Math.min(...totals)
  const confidence = clamp(0.55 + boundaryGap * 2 - spread * 0.6 + (perImage.length - 1) * 0.03, 0.5, 0.9)

  return { grade, confidence: Math.round(confidence * 100) / 100, factors, source: 'heuristic' }
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
  issue?: PhotoIssue
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
const BACKGROUND_DISTANCE = 48

export async function analyse(src: string, crop: CropId): Promise<ImageScores> {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE
  canvas.height = SAMPLE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas unavailable')
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE)
  return scorePixels(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data, crop)
}

/** Pure pixel scoring, separated from canvas so it can be unit tested. */
export function scorePixels(data: Uint8ClampedArray, crop: CropId): ImageScores {
  const total = data.length / 4
  const side = Math.round(Math.sqrt(total))
  const ripe = RIPE[crop]
  const hsv = new Float32Array(total * 3)

  // Whole-frame lighting, plus ripe-colour share over the whole frame.
  let vAll = 0
  let ripeAll = 0
  for (let p = 0; p < total; p++) {
    const [h, s, v] = rgbToHsv(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])
    hsv[p * 3] = h
    hsv[p * 3 + 1] = s
    hsv[p * 3 + 2] = v
    vAll += v
    if (isRipe(h, s, v, ripe)) ripeAll++
  }
  const meanAll = vAll / total
  if (meanAll < 0.14) return { size: 0, color: 0, defects: 1, issue: 'too_dark' }
  if (meanAll > 0.94) return { size: 0, color: 0, defects: 1, issue: 'too_bright' }

  // Background estimate: mean and spread of the outer border ring.
  let br = 0
  let bg = 0
  let bb = 0
  let bn = 0
  const border: number[] = []
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (x > 3 && x < side - 4 && y > 3 && y < side - 4) continue
      const i = (y * side + x) * 4
      br += data[i]
      bg += data[i + 1]
      bb += data[i + 2]
      bn++
      border.push(i)
    }
  }
  br /= bn
  bg /= bn
  bb /= bn
  const borderSpread = Math.sqrt(border.reduce((s, i) => s + (data[i] - br) ** 2 + (data[i + 1] - bg) ** 2 + (data[i + 2] - bb) ** 2, 0) / bn)

  // A textured border means the produce runs to the edge of the photo (a
  // close-up), so the whole frame is produce, not background.
  const fullFrame = borderSpread > 38
  const fgMask = new Uint8Array(total)
  let fg = 0
  for (let p = 0; p < total; p++) {
    const i = p * 4
    if (fullFrame || Math.hypot(data[i] - br, data[i + 1] - bg, data[i + 2] - bb) >= BACKGROUND_DISTANCE) {
      fgMask[p] = 1
      fg++
    }
  }

  if (fg < total * 0.05) {
    // Nothing stands out from the background. Either an even close-up of the
    // crop (then most of the frame is ripe-coloured) or no crop at all.
    if (ripeAll / total > 0.4) {
      fgMask.fill(1)
      fg = total
    } else {
      return { size: 0, color: 0, defects: 1, issue: 'no_crop' }
    }
  }

  // Produce brightness. Dried Dhakki dates are dark brown and the gaps between
  // them cast deep shadows, so the dark-spot threshold scales with the produce.
  let lSum = 0
  let lSq = 0
  for (let p = 0; p < total; p++) {
    if (!fgMask[p]) continue
    const v = hsv[p * 3 + 2]
    lSum += v
    lSq += v * v
  }
  const mean = lSum / fg
  const spotBelow = Math.min(0.12, mean * 0.3)

  let colorHits = 0
  let defectHits = 0
  for (let p = 0; p < total; p++) {
    if (!fgMask[p]) continue
    const h = hsv[p * 3]
    const s = hsv[p * 3 + 1]
    const v = hsv[p * 3 + 2]
    if (isRipe(h, s, v, ripe)) colorHits++
    const blackSpot = v < spotBelow
    const mould = s < 0.12 && v > 0.55 && v < 0.92 // grey-white fuzz
    const unripeGreen = crop !== 'sugarcane' && h > 85 && h < 160 && s > 0.3
    if (blackSpot || mould || unripeGreen) defectHits++
  }

  const coverage = fg / total
  const size = clamp((coverage - 0.15) / 0.6, 0, 1)
  const evenness = 1 - clamp(Math.sqrt(Math.max(0, lSq / fg - mean * mean)) / 0.3, 0, 1)
  const color = clamp(0.7 * (colorHits / fg) + 0.3 * evenness, 0, 1)
  const defects = clamp((defectHits / fg) * 4, 0, 1)

  return { size, color, defects }
}

function isRipe(h: number, s: number, v: number, ripe: (typeof RIPE)[CropId]) {
  const hueDelta = Math.min(Math.abs(h - ripe.hue), 360 - Math.abs(h - ripe.hue))
  return hueDelta <= ripe.hueWidth && s >= ripe.satMin && s <= ripe.satMax && v > 0.13
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
