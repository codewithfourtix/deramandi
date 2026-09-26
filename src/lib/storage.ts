import type { Listing } from '../types'

const LISTINGS_KEY = 'deramandi.listings.v1'

export class StorageFullError extends Error {
  constructor() {
    super('storage full')
    this.name = 'StorageFullError'
  }
}

export function loadListings(): Listing[] {
  try {
    const raw = localStorage.getItem(LISTINGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Listing[]) : []
  } catch {
    return []
  }
}

function saveListings(listings: Listing[]) {
  try {
    localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings))
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
      throw new StorageFullError()
    }
    throw err
  }
}

export function getListing(id: string): Listing | undefined {
  return loadListings().find((l) => l.id === id)
}

export function addListing(listing: Listing) {
  saveListings([listing, ...loadListings()])
}

export function updateListing(id: string, patch: Partial<Listing>): Listing | undefined {
  const all = loadListings()
  const idx = all.findIndex((l) => l.id === id)
  if (idx === -1) return undefined
  all[idx] = { ...all[idx], ...patch }
  saveListings(all)
  return all[idx]
}

export function newId(): string {
  const rand = Math.random().toString(36).slice(2, 7)
  return `${Date.now().toString(36)}${rand}`
}
