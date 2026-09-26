import type { CropId, Grade, GradeResult } from '../types'
import { loadImage } from './image'
import { findObjects } from './kernels'
import { calibrateWith, cropToFruit, loadModelAt, predictTTA } from './model'

/*
  Trained models for crops other than khajoor (ml/train_crop.py, exported by
  ml/export_crop.py). A crop has a model only if its card exists in
  src/data/models/, so the app never claims a model it does not ship.

    wheat      8 kernel classes (GrainSet). The photo is a handful of grain;
               every kernel is found, classified, and the lot is graded by
               the share of sound and damaged kernels.
    sugarcane  good vs damaged billet (two levels: shown as A or C).
    melon      A/B/C, trained on other graded fruit (no public melon set).
*/

export interface CropCard {
  crop: CropId
  task: 'wheat_kernel_class' | 'binary_good_damaged' | 'grade3_proxy'
  labels: string[]
  inputSize: number
  trainImages: number
  valImages: number
  testImages: number
  testAccuracy: number
  testAccuracyWilson95: [number, number]
  majorityBaseline: number
  temperature: number
  perClass: Record<string, { precision: number; recall: number; n: number }>
  backbone: string
  dataset: string
  citation: string
  licence: string
  weightsMB: number
  kernelGroupAccuracy?: number
  kernelGroupWilson95?: [number, number]
  kernelGroupMap?: number[]
  /** Sugarcane: accuracy when all photos of one billet are averaged, over groupCount billets. */
  groupAccuracy?: number
  groupWilson95?: [number, number]
  groupCount?: number
  /** Test confusion matrix: rows are the true label, columns the prediction. */
  confusion?: number[][]
  /** Wheat: accuracy on GrainSet's scanner close-ups, before cutting out the app's way. */
  scannerAccuracy?: number
  scannerTestImages?: number
}

const cards = import.meta.glob<{ default: CropCard }>('../data/models/*.json', { eager: true })
export const MODEL_DIR: Record<string, string> = { wheat: 'wheat', sugarcane: 'sugarcane', kulachi_melon: 'melon' }

export const CROP_CARDS: Partial<Record<CropId, CropCard>> = Object.fromEntries(
  Object.values(cards).map((m) => [m.default.crop, m.default]),
)

export function hasCropModel(crop: CropId) {
  return Boolean(CROP_CARDS[crop])
}

// Wheat kernel quality groups (the GrainSet paper's own grouping):
// A = sound; B = sprouted, pest-attacked, broken; C = fusarium/shrivelled, mouldy, black point, impurity.
export const WHEAT_GROUP = [0, 2, 1, 2, 1, 1, 2, 2]

/**
 * Our lot rule for wheat (a choice, stated in the app): Grade A needs at least
 * 90% sound kernels and at most 2% seriously damaged; B at least 75% sound and
 * at most 8% seriously damaged; anything worse is C.
 */
export function wheatLotGrade(shares: [number, number, number]): Grade {
  const [sound, , serious] = shares
  if (sound >= 0.9 && serious <= 0.02) return 'A'
  if (sound >= 0.75 && serious <= 0.08) return 'B'
  return 'C'
}

/**
 * Correct counted shares for the model's known mistakes ("adjusted classify
 * and count"). The test set is balanced, but a real lot is mostly sound
 * kernels, and 14% of sound kernels are misread as damaged: raw counts would
 * pull every clean lot down a grade. With M[i][j] = P(model says group j |
 * true group i) from the test set, find true shares p (>= 0, summing to 1)
 * whose expected counts M^T p best match the observed shares q.
 */
export function adjustShares(q: number[], confusion: number[][], group: number[]): number[] {
  const G = 3
  const M = Array.from({ length: G }, () => new Array(G).fill(0))
  confusion.forEach((row, i) => row.forEach((n, j) => (M[group[i]][group[j]] += n)))
  M.forEach((row) => {
    const sum = row.reduce((a, b) => a + b, 0) || 1
    row.forEach((_, j) => (row[j] /= sum))
  })
  // projected gradient descent on ||M^T p - q||^2 over the probability simplex
  let p = [...q]
  for (let it = 0; it < 2000; it++) {
    const r = Array.from({ length: G }, (_, j) => p.reduce((s, pi, i) => s + pi * M[i][j], 0) - q[j])
    const grad = p.map((_, i) => 2 * r.reduce((s, rj, j) => s + rj * M[i][j], 0))
    p = projectSimplex(p.map((pi, i) => pi - 0.5 * grad[i]))
  }
  return p
}

function projectSimplex(v: number[]): number[] {
  const u = [...v].sort((a, b) => b - a)
  let css = 0
  let theta = 0
  for (let i = 0; i < u.length; i++) {
    css += u[i]
    const t = (css - 1) / (i + 1)
    if (u[i] - t > 0) theta = t
  }
  return v.map((x) => Math.max(0, x - theta))
}

export interface KernelSummary {
  total: number
  byClass: Record<string, number>
  skipped: number
}

export async function gradeWithCropModel(images: string[], crop: CropId): Promise<Pick<GradeResult, 'grade' | 'confidence' | 'probabilities' | 'perPhoto'> & { kernels?: KernelSummary }> {
  const card = CROP_CARDS[crop]
  if (!card) throw new Error(`no model for ${crop}`)
  const { tf, model } = await loadModelAt(`/models/${MODEL_DIR[crop]}/model.json`)
  const imgs = await Promise.all(images.map(loadImage))

  if (card.task === 'wheat_kernel_class') {
    const found = imgs.map((img) => findObjects(img, card.inputSize))
    const crops = found.flatMap((f) => f.crops)
    const probs = predictTTA(tf, model, crops).map((p) => calibrateWith(p, card.temperature))
    const classes = probs.map((p) => p.indexOf(Math.max(...p)))
    const byClass = Object.fromEntries(card.labels.map((l) => [l, 0])) as Record<string, number>
    classes.forEach((c) => (byClass[card.labels[c]] += 1))
    const groups = [0, 0, 0]
    classes.forEach((c) => (groups[WHEAT_GROUP[c]] += 1))
    const n = Math.max(1, classes.length)
    const counted = groups.map((g) => g / n)
    const shares = (card.confusion ? adjustShares(counted, card.confusion, WHEAT_GROUP) : counted) as [number, number, number]
    const grade = wheatLotGrade(shares)
    // per photo: the same rule applied to that photo's kernels
    let k = 0
    const perPhoto = found.map((f) => {
      const g = [0, 0, 0]
      for (let i = 0; i < f.crops.length; i++) g[WHEAT_GROUP[classes[k + i]]] += 1
      k += f.crops.length
      const m = Math.max(1, f.crops.length)
      const q = [g[0] / m, g[1] / m, g[2] / m]
      return wheatLotGrade((card.confusion ? adjustShares(q, card.confusion, WHEAT_GROUP) : q) as [number, number, number])
    })
    const meanTop = probs.reduce((s, p) => s + Math.max(...p), 0) / n
    return {
      grade,
      confidence: Math.round(meanTop * 100) / 100,
      // for wheat these are estimated SHARES OF KERNELS in each quality group (corrected), not probabilities
      probabilities: { A: shares[0], B: shares[1], C: shares[2] },
      perPhoto,
      kernels: { total: classes.length, byClass, skipped: found.reduce((s, f) => s + f.skipped, 0) },
    }
  }

  const pixels = imgs.map((img) => cropToFruit(img, card.inputSize).pixels)
  const perPhotoProbs = predictTTA(tf, model, pixels)
  const avg = perPhotoProbs[0].map((_, c) => perPhotoProbs.reduce((s, p) => s + p[c], 0) / perPhotoProbs.length)
  const cal = calibrateWith(avg, card.temperature)

  if (card.task === 'binary_good_damaged') {
    const good = cal[0]
    const grade: Grade = good >= 0.5 ? 'A' : 'C'
    return {
      grade,
      confidence: Math.round(Math.max(good, 1 - good) * 100) / 100,
      probabilities: { A: good, B: 0, C: 1 - good },
      perPhoto: perPhotoProbs.map((p) => (p[0] >= p[1] ? 'A' : 'C')),
    }
  }

  const order: Grade[] = ['A', 'B', 'C']
  const grade = order[cal.indexOf(Math.max(...cal))]
  return {
    grade,
    confidence: Math.round(Math.max(...cal) * 100) / 100,
    probabilities: { A: cal[0], B: cal[1], C: cal[2] },
    perPhoto: perPhotoProbs.map((p) => order[p.indexOf(Math.max(...p))]),
  }
}
