import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import card from '../data/modelCard.json'

const PUBLIC = join(__dirname, '..', '..', 'public')

describe('model card (what the app tells farmers and judges)', () => {
  it('reports an accuracy that beats always guessing the most common grade', () => {
    expect(card.testImages).toBeGreaterThan(200)
    expect(card.testAccuracy).toBeGreaterThan(card.majorityBaseline)
  })

  it('has a confidence interval that contains the accuracy', () => {
    const [lo, hi] = card.testAccuracyWilson95
    expect(lo).toBeLessThan(card.testAccuracy)
    expect(hi).toBeGreaterThan(card.testAccuracy)
    expect(hi - lo).toBeLessThan(0.15)
  })

  it('has a sane calibration temperature', () => {
    expect(card.temperature).toBeGreaterThan(0.3)
    expect(card.temperature).toBeLessThan(5)
  })

  it('never trains on the variety it reports as unseen', () => {
    expect(card.trainVarieties).not.toContain(card.unseenVariety)
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
