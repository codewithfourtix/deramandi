import khajoorCard from '../data/modelCard.json'
import { CROP_CARDS } from './cropModels'
import type { CropId, Listing } from '../types'

/*
  One place that says how a grade was made and how far to trust it, for the
  certificate, the "How sure are we?" page and the result screen. Every number
  here comes from a model card written by ml/export.py; nothing is typed in.
*/

export interface GraderInfo {
  kind: 'model' | 'rules'
  crop: CropId
  /** e.g. "MobileNetV2 khajoor grade model" */
  name: string
  accuracy?: number // 0..1, held-out
  tested?: number
  ci95?: [number, number]
  baseline?: number
  trainedOn?: string
  citation?: string
  licence?: string
}

const KHAJOOR_CITATION =
  'Maitlo, A. K. et al., Date Fruit Dataset for Inspection and Grading, Mendeley Data, V3 (2023), doi:10.17632/s5zfvsw5kv.3'

export function graderFor(crop: CropId, source: Listing['gradeSource'] = 'model'): GraderInfo {
  if (crop === 'dhakki_dates' && source === 'model') {
    const c = khajoorCard
    return {
      kind: 'model',
      crop,
      name: 'MobileNetV2 khajoor grade model',
      accuracy: c.testAccuracy,
      tested: c.testImages,
      ci95: c.testAccuracyWilson95 as [number, number],
      baseline: c.majorityBaseline,
      trainedOn: `${c.trainImages.toLocaleString('en-US')} graded khajoor photos (${c.trainVarieties.join(', ')})`,
      citation: KHAJOOR_CITATION,
      licence: 'CC BY 4.0',
    }
  }
  const card = CROP_CARDS[crop]
  if (card && source === 'model') {
    const what = {
      wheat_kernel_class: `photos of single wheat kernels in 8 classes; accuracy is per kernel`,
      binary_good_damaged: `photos of sugarcane billets marked good or damaged`,
      grade3_proxy: `graded photos of other fruit (no public melon set exists; never tested on melon)`,
    }[card.task]
    const names = { wheat_kernel_class: 'wheat kernel model', binary_good_damaged: 'sugarcane billet model', grade3_proxy: 'fruit grade model (melon stand-in)' }
    return {
      kind: 'model',
      crop,
      name: `MobileNetV2 ${names[card.task]}`,
      accuracy: card.testAccuracy,
      tested: card.testImages,
      ci95: card.testAccuracyWilson95,
      baseline: card.majorityBaseline,
      trainedOn: `${card.trainImages.toLocaleString('en-US')} ${what}`,
      citation: card.citation,
      licence: card.licence,
    }
  }
  return { kind: 'rules', crop, name: 'Rule-based photo estimate (colour, coverage, dark spots)' }
}

export const pct = (x?: number) => (x === undefined ? '' : `${Math.round(x * 100)}%`)
