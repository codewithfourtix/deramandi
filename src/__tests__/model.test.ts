import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import card from '../data/modelCard.json'
import { looksUnfamiliar } from '../lib/model'

const PUBLIC = join(__dirname, '..', '..', 'public')

describe('model card (what the app tells farmers and judges)', () => {
  it('reports an accuracy that beats always guessing the most common grade', () => {
    // the Mendeley headline has ~311 test photos; a Dhakki headline will be smaller
    expect(card.testImages).toBeGreaterThan(card.includesDhakki ? 10 : 200)
    expect(card.testAccuracy).toBeGreaterThan(card.majorityBaseline)
  })

  it('has a confidence interval that contains the accuracy', () => {
    const [lo, hi] = card.testAccuracyWilson95
    expect(lo).toBeLessThanOrEqual(card.testAccuracy)
    expect(hi).toBeGreaterThanOrEqual(card.testAccuracy)
    // a big test set must give a tight interval; a small Dhakki set may not
    if (card.testImages >= 250) expect(hi - lo).toBeLessThan(0.15)
  })

  it('only claims Dhakki when Dhakki was trained and tested on', () => {
    const trained = card.trainVarieties.includes('Dhakki')
    expect(card.includesDhakki).toBe(trained && card.localVarieties !== null)
    expect(card.headlineVarieties).toEqual(card.includesDhakki ? ['Dhakki'] : ['Gajar', 'Kupro'])
    if (!card.includesDhakki) expect(card.dataset).not.toMatch(/Dhakki/)
  })

  it('derives the colour guard from the training varieties', () => {
    expect(card.colourGuard.varieties).toEqual(card.trainVarieties)
    expect(card.colourGuard.photos).toBeGreaterThan(100)
    expect(card.colourGuard.hueMax).toBeGreaterThan(15)
    expect(card.colourGuard.hueMax).toBeLessThan(90)
    expect(card.colourGuard.valMax).toBeGreaterThan(0.5)
    expect(card.colourGuard.valMax).toBeLessThan(0.95)
  })

  it('has a sane calibration temperature', () => {
    expect(card.temperature).toBeGreaterThan(0.3)
    expect(card.temperature).toBeLessThan(5)
  })

  it('never trains on the variety it reports as unseen', () => {
    expect(card.trainVarieties).not.toContain(card.unseenVariety)
  })
})

describe('unfamiliar-photo guard', () => {
  it('passes typical dried khajoor colours', () => {
    expect(looksUnfamiliar(12, 0.28)).toBe(false) // dataset median
    expect(looksUnfamiliar(-60, 0.15)).toBe(false) // dark purple-brown
  })
  it('flags yellow or green fruit and very pale photos', () => {
    expect(looksUnfamiliar(55, 0.5)).toBe(true) // yellow, like fresh doka
    expect(looksUnfamiliar(100, 0.5)).toBe(true) // green
    expect(looksUnfamiliar(10, 0.9)).toBe(true) // washed-out
  })
})

describe('shipped model files', () => {
  const manifest = JSON.parse(readFileSync(join(PUBLIC, 'model', 'model.json'), 'utf8'))

  it('is a TF.js layers model with a 3-way output', () => {
    expect(manifest.format).toBe('layers-model')
    const layers = manifest.modelTopology.config.layers
    const head = layers.find((l: { name: string }) => l.name === 'grade')
    expect(head.config.units).toBe(3)
    expect(head.config.activation).toBe('softmax')
  })

  it('has weight shards whose size matches the manifest (float16)', () => {
    const group = manifest.weightsManifest[0]
    const expected = group.weights.reduce((sum: number, w: { shape: number[] }) => sum + w.shape.reduce((a: number, b: number) => a * b, 1) * 2, 0)
    const actual = group.paths.reduce((sum: number, p: string) => sum + statSync(join(PUBLIC, 'model', p)).size, 0)
    expect(actual).toBe(expected)
  })

  it('carries no training-only config that TF.js cannot load', () => {
    expect(JSON.stringify(manifest.modelTopology)).not.toMatch(/"(kernel|bias|activity)_regularizer":\s*\{/)
  })

  it('ships two held-out sample photos per grade', () => {
    for (const g of [1, 2, 3]) for (const k of [1, 2]) expect(existsSync(join(PUBLIC, 'samples', `khajoor-g${g}-${k}.jpg`))).toBe(true)
  })
})

describe('wheat lot shares', () => {
  it('undoes known misreads: a clean lot reads clean again', async () => {
    const { adjustShares, WHEAT_GROUP } = await import('../lib/cropModels')
    // 8x8 test confusion (rows true, columns predicted): 25% of sound kernels misread as damaged
    const confusion = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => (i === j ? 75 : i === 0 ? 25 / 7 : 25 / 7)))
    const row = confusion[0]
    const total = row.reduce((a, b) => a + b, 0)
    const q = [0, 0, 0]
    row.forEach((n, j) => (q[WHEAT_GROUP[j]] += n / total))
    expect(q[0]).toBeLessThan(0.8) // raw counting would call a clean lot damaged
    const p = adjustShares(q, confusion, WHEAT_GROUP)
    expect(p[0]).toBeGreaterThan(0.97)
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
    expect(Math.min(...p)).toBeGreaterThanOrEqual(0)
  })
})
