import { describe, expect, it } from 'vitest'
import manifest from '../data/voiceManifest.json'
import clipList from '../data/voiceClips.json'
import ur from '../i18n/ur.json'
import { numberSegs, parseSpokenKg } from '../lib/spokenNumber'
import { existsSync } from 'node:fs'

const clips = manifest.clips as Record<string, string>

describe('spoken numbers', () => {
  it('reads prices the way people say them', () => {
    expect(numberSegs(250)).toEqual(['n.2', 'n.hundred', 'n.50'])
    expect(numberSegs(12.5)).toEqual(['n.sadhe', 'n.12'])
    expect(numberSegs(1.5)).toEqual(['n.derh'])
    expect(numberSegs(8000)).toEqual(['n.8', 'n.thousand'])
    expect(numberSegs(125000)).toEqual(['n.1', 'n.lakh', 'n.25', 'n.thousand'])
    expect(numberSegs(460)).toEqual(['n.4', 'n.hundred', 'n.60'])
  })

  it('has a recorded clip for every number piece and every listed line', () => {
    for (let n = 0; n < 100; n++) expect(clips[`n.${n}`]).toBeTruthy()
    for (const k of ['n.hundred', 'n.thousand', 'n.lakh', 'n.sadhe', 'n.derh', 'n.dhai', ...clipList.keys]) {
      expect(clips[k], k).toBeTruthy()
      expect(existsSync(`public/voice/ur/${clips[k]}`), k).toBe(true)
    }
  })

  it('records only fixed Urdu text', () => {
    for (const k of clipList.keys) {
      const text = k.split('.').reduce((n: unknown, p) => (n as Record<string, unknown>)[p], ur) as string
      expect(text).not.toContain('{{')
      expect(/[؀-ۿ]/.test(text)).toBe(true)
    }
  })
})

describe('spoken weight', () => {
  it('understands digits, Urdu words and maunds', () => {
    expect(parseSpokenKg('500')).toBe(500)
    expect(parseSpokenKg('۵۰۰ کلو')).toBe(500)
    expect(parseSpokenKg('پانچ سو کلو')).toBe(500)
    expect(parseSpokenKg('دو ہزار پانچ سو')).toBe(2500)
    expect(parseSpokenKg('ساڑھے تین سو')).toBe(350)
    expect(parseSpokenKg('دس من')).toBe(400)
    expect(parseSpokenKg('10 من')).toBe(400)
    expect(parseSpokenKg('2 ہزار کلو')).toBe(2000)
    expect(parseSpokenKg('two thousand five hundred kilo')).toBe(2500)
    expect(parseSpokenKg('twenty five maunds')).toBe(1000)
  })

  it('leaves the field alone when no number was heard', () => {
    expect(parseSpokenKg('منڈی')).toBeNull()
    expect(parseSpokenKg('hello')).toBeNull()
    expect(parseSpokenKg('')).toBeNull()
  })
})
