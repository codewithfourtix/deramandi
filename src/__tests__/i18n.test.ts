import { describe, expect, it } from 'vitest'
import { buyers, crops, locations, logistics } from '../data'
import en from '../i18n/en.json'
import ur from '../i18n/ur.json'

type Tree = { [k: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[key] = v
    else Object.assign(out, flatten(v, key))
  }
  return out
}

const flatEn = flatten(en as Tree)
const flatUr = flatten(ur as Tree)
const vars = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort()

describe('translations', () => {
  it('have exactly the same keys in English and Urdu', () => {
    expect(Object.keys(flatUr).sort()).toEqual(Object.keys(flatEn).sort())
  })

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(flatEn)) {
      expect(vars(flatUr[key]), key).toEqual(vars(flatEn[key]))
    }
  })

  it('have no empty strings, except deliberate price affixes', () => {
    const affixes = new Set(['price.before', 'price.after', 'price.totalBefore', 'price.totalAfter'])
    for (const [key, value] of [...Object.entries(flatEn), ...Object.entries(flatUr)]) {
      if (!affixes.has(key)) expect(value.trim(), key).not.toBe('')
    }
  })

  it('keep Urdu strings in Urdu script', () => {
    const skip = new Set(['app.nameAlt', 'lang.en'])
    const urdu = /[؀-ۿ]/
    for (const [key, value] of Object.entries(flatUr)) {
      if (skip.has(key) || value.trim() === '') continue
      expect(urdu.test(value), key).toBe(true)
    }
  })

  it('name every place, crop and provider type used by the seed data', () => {
    const places = new Set([...locations.map((l) => l.id), ...buyers.map((b) => b.location), ...logistics.map((l) => l.location)])
    for (const flat of [flatEn, flatUr]) {
      for (const p of places) expect(flat[`places.${p}`], p).toBeTruthy()
      for (const c of crops) {
        expect(flat[`crops.${c.id}`]).toBeTruthy()
        expect(flat[`cropHints.${c.id}`]).toBeTruthy()
      }
      for (const b of buyers) expect(flat[`buyerType.${b.type}`]).toBeTruthy()
      for (const l of logistics) expect(flat[`logisticsType.${l.type}`]).toBeTruthy()
    }
  })

  it('give every provider an Urdu name and an Urdu price note', () => {
    for (const b of buyers) expect(b.nameUr.trim()).not.toBe('')
    for (const l of logistics) {
      expect(l.nameUr.trim()).not.toBe('')
      expect(l.priceNote.ur.trim()).not.toBe('')
      expect(l.priceNote.en.trim()).not.toBe('')
    }
  })
})
