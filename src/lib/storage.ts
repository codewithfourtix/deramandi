import type { Farmer, Listing } from '../types'

/*
  Everything the grower saves stays on this phone.

  Listings (with their photos) and helper-mode farmer profiles live in
  IndexedDB, which holds far more than localStorage's ~5 MB: whole-lot grading
  stores up to 10 photos per listing. At start-up initStorage() loads it all
  into memory, so the screens can keep reading synchronously; every change is
  written through to IndexedDB in the background.

  Older versions kept listings in localStorage; they are migrated on first run.
  If IndexedDB is unavailable (some private windows), localStorage is used.
*/

const DB_NAME = 'deramandi'
const DB_VERSION = 1
const LEGACY_KEY = 'deramandi.listings.v1'
const FALLBACK_KEY = 'deramandi.store.v2'

export class StorageFullError extends Error {
  constructor() {
    super('storage full')
    this.name = 'StorageFullError'
  }
}

type StoreName = 'listings' | 'farmers'

let listings: Listing[] = []
let farmers: Farmer[] = []
let db: IDBDatabase | null = null
let useFallback = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

/** Re-render hook support: call fn whenever listings or farmers change. */
export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains('listings')) d.createObjectStore('listings', { keyPath: 'id' })
      if (!d.objectStoreNames.contains('farmers')) d.createObjectStore('farmers', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function readAll<T>(store: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db!.transaction(store, 'readonly').objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

function isQuota(err: unknown) {
  return err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)
}

function write(store: StoreName, op: 'put' | 'delete', value: unknown): Promise<void> {
  if (useFallback || !db) return writeFallback()
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(store, 'readwrite')
    const os = tx.objectStore(store)
    if (op === 'put') os.put(value)
    else os.delete(value as IDBValidKey)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(isQuota(tx.error) ? new StorageFullError() : tx.error)
    tx.onabort = () => reject(isQuota(tx.error) ? new StorageFullError() : tx.error)
  })
}

function writeFallback(): Promise<void> {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify({ listings, farmers }))
    return Promise.resolve()
  } catch (err) {
    return Promise.reject(isQuota(err) ? new StorageFullError() : err)
  }
}

function byNewest(a: { createdAt: string }, b: { createdAt: string }) {
  return b.createdAt.localeCompare(a.createdAt)
}

/** Load everything before the app renders. Never throws. */
export async function initStorage() {
  let legacy: Listing[] = []
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (raw) legacy = JSON.parse(raw)
  } catch {
    legacy = []
  }

  try {
    if (!('indexedDB' in window)) throw new Error('no indexedDB')
    db = await openDb()
    listings = (await readAll<Listing>('listings')).sort(byNewest)
    farmers = (await readAll<Farmer>('farmers')).sort(byNewest)
    if (legacy.length) {
      const known = new Set(listings.map((l) => l.id))
      for (const l of legacy) if (!known.has(l.id)) await write('listings', 'put', l)
      listings = [...listings, ...legacy.filter((l) => !known.has(l.id))].sort(byNewest)
      localStorage.removeItem(LEGACY_KEY)
    }
  } catch {
    useFallback = true
    try {
      const raw = localStorage.getItem(FALLBACK_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      listings = [...(parsed.listings ?? []), ...legacy].sort(byNewest)
      farmers = parsed.farmers ?? []
    } catch {
      listings = legacy
    }
  }
}

// ---- listings ---------------------------------------------------------------

export function loadListings(): Listing[] {
  return listings
}

export function getListing(id: string): Listing | undefined {
  return listings.find((l) => l.id === id)
}

/** Resolves once saved; rejects with StorageFullError when the phone is full. */
export async function addListing(listing: Listing) {
  const before = listings
  listings = [listing, ...listings]
  try {
    await write('listings', 'put', listing)
    notify()
  } catch (err) {
    listings = before
    throw err
  }
}

export function updateListing(id: string, patch: Partial<Listing>): Listing | undefined {
  const idx = listings.findIndex((l) => l.id === id)
  if (idx === -1) return undefined
  const next = { ...listings[idx], ...patch }
  listings = listings.map((l, i) => (i === idx ? next : l))
  write('listings', 'put', next).catch((err) => console.error('save failed', err))
  notify()
  return next
}

export function removeListing(id: string) {
  listings = listings.filter((l) => l.id !== id)
  write('listings', 'delete', id).catch((err) => console.error('delete failed', err))
  notify()
}

// ---- farmers (helper mode) ----------------------------------------------------

export function loadFarmers(): Farmer[] {
  return farmers
}

export function getFarmer(id?: string): Farmer | undefined {
  return id ? farmers.find((f) => f.id === id) : undefined
}

export async function saveFarmer(farmer: Farmer) {
  const exists = farmers.some((f) => f.id === farmer.id)
  farmers = exists ? farmers.map((f) => (f.id === farmer.id ? farmer : f)) : [farmer, ...farmers]
  await write('farmers', 'put', farmer)
  notify()
}

export function removeFarmer(id: string) {
  farmers = farmers.filter((f) => f.id !== id)
  write('farmers', 'delete', id).catch((err) => console.error('delete failed', err))
  notify()
}

// ---- backup / restore ---------------------------------------------------------

export interface Backup {
  app: 'deramandi'
  version: 2
  exportedAt: string
  listings: Listing[]
  farmers: Farmer[]
}

export function makeBackup(): Backup {
  return { app: 'deramandi', version: 2, exportedAt: new Date().toISOString(), listings, farmers }
}

/** Merge a backup into this phone. Returns how many listings and farmers were added. */
export async function restoreBackup(data: unknown): Promise<{ listings: number; farmers: number }> {
  const b = data as Partial<Backup>
  if (!b || b.app !== 'deramandi' || !Array.isArray(b.listings)) throw new Error('not a Dera Mandi backup')
  const haveL = new Set(listings.map((l) => l.id))
  const haveF = new Set(farmers.map((f) => f.id))
  const newL = b.listings.filter((l) => l && l.id && !haveL.has(l.id))
  const newF = (b.farmers ?? []).filter((f) => f && f.id && !haveF.has(f.id))
  for (const l of newL) await write('listings', 'put', l)
  for (const f of newF) await write('farmers', 'put', f)
  listings = [...listings, ...newL].sort(byNewest)
  farmers = [...farmers, ...newF].sort(byNewest)
  notify()
  return { listings: newL.length, farmers: newF.length }
}

export function newId(): string {
  const rand = Math.random().toString(36).slice(2, 7)
  return `${Date.now().toString(36)}${rand}`
}
