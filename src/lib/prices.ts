import { useSyncExternalStore } from 'react'
import snapshot from '../data/marketPrices.json'
import referencePrices from '../data/prices.json'
import type { CropId, Grade, ReferencePrice } from '../types'

/*
  Where every price in the app comes from, most trusted first:
    1. "mine":     today's rate the grower or helper typed in for their own mandi
    2. "live":     /api/prices, AMIS Punjab rates fetched on the server (cached 6 h)
    3. "snapshot": the same AMIS data built into the app, for offline use
    4. "reference": the illustrative table in prices.json (crops with no public rate)
  Each rate carries its source and date, and the screens show them.

  AMIS gives one range per market, not per grade. The app splits the range of
  typical markets into thirds: Grade C is the bottom third, B the middle, A
  the top. That rule is shown to the user wherever a band is shown.
*/

export interface MarketRate {
  min: number // PKR per kg
  max: number
  median?: number
  date: string | null
  source: string
  urls?: string[]
  markets?: { market: string; commodity: string; min: number; max: number }[]
  commodities?: string[]
}

export type RateOrigin = 'mine' | 'live' | 'snapshot' | 'reference'

interface LiveCache {
  fetchedAt: string
  crops: Record<string, MarketRate>
}

const MINE_KEY = 'deramandi.myRates'
const LIVE_KEY = 'deramandi.livePrices'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

let mine: Partial<Record<CropId, MarketRate>> = readJson(MINE_KEY) ?? {}
let live: LiveCache | null = readJson(LIVE_KEY)
let version = 0
const listeners = new Set<() => void>()

function changed() {
  version++
  listeners.forEach((fn) => fn())
}

export function useRatesVersion() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => version,
    () => version,
  )
}

const SNAPSHOT = snapshot as unknown as LiveCache

export function getRate(crop: CropId): { rate: MarketRate; origin: RateOrigin } | null {
  if (mine[crop]) return { rate: mine[crop]!, origin: 'mine' }
  if (live?.crops?.[crop]) return { rate: live.crops[crop], origin: 'live' }
  if (SNAPSHOT.crops[crop]) return { rate: SNAPSHOT.crops[crop], origin: 'snapshot' }
  return null
}

export function setMyRate(crop: CropId, min: number, max: number) {
  mine = { ...mine, [crop]: { min, max, median: (min + max) / 2, date: new Date().toISOString().slice(0, 10), source: 'mine' } }
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(mine))
  } catch {
    /* keep in memory */
  }
  changed()
}

export function clearMyRate(crop: CropId) {
  const next = { ...mine }
  delete next[crop]
  mine = next
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(mine))
  } catch {
    /* ignore */
  }
  changed()
}

export function liveFetchedAt() {
  return live?.fetchedAt ?? null
}

/** Try the server for fresh AMIS rates. Quietly keeps the old ones if offline. */
export async function refreshLive(timeoutMs = 8000): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch('/api/prices', { signal: ctrl.signal })
    if (!res.ok) return false
    const body = (await res.json()) as LiveCache
    if (!body?.crops || !Object.keys(body.crops).length) return false
    live = body
    try {
      localStorage.setItem(LIVE_KEY, JSON.stringify(body))
    } catch {
      /* ignore */
    }
    changed()
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function roundPrice(x: number) {
  return x >= 50 ? Math.round(x) : Math.round(x * 2) / 2
}

/** Grade band for a crop, from the market range (thirds) or the reference table. */
export function bandFor(crop: CropId, grade: Grade): ReferencePrice & { origin: RateOrigin } {
  const r = getRate(crop)
  if (r) {
    const { min, max } = r.rate
    const span = Math.max(max - min, 0.01)
    const cuts = [min, min + span / 3, min + (2 * span) / 3, max].map(roundPrice)
    const i = { C: 0, B: 1, A: 2 }[grade]
    return { crop, grade, min: cuts[i], max: cuts[i + 1], origin: r.origin }
  }
  const ref = (referencePrices as ReferencePrice[]).find((p) => p.crop === crop && p.grade === grade)
  if (!ref) throw new Error(`No reference price for ${crop} grade ${grade}`)
  return { ...ref, origin: 'reference' }
}

/** Reference-table band (what the seeded buyer offers were written against). */
export function referenceBand(crop: CropId, grade: Grade): ReferencePrice {
  const ref = (referencePrices as ReferencePrice[]).find((p) => p.crop === crop && p.grade === grade)
  if (!ref) throw new Error(`No reference price for ${crop} grade ${grade}`)
  return ref
}
