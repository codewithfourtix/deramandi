import { useSyncExternalStore } from 'react'

/*
  Per-phone preferences. Small, so localStorage is fine. Screens read them with
  useSettings(); changes re-render every subscriber.
*/

export interface Settings {
  /** Requests go to the demo WhatsApp number instead of a buyer. On by default: buyers are sample data. */
  demoMode: boolean
  largeText: boolean
  voice: boolean
  /** The voice offer has been shown once (spoken after the first tap). */
  voiceOffered: boolean
  helperMode: boolean
  activeFarmerId?: string
}

export const DEMO_NUMBER = '923134870456' // WhatsApp format
// isolated LTR so the two digit groups keep their order inside Urdu sentences
export const DEMO_NUMBER_DISPLAY = '⁦0313 4870456⁩'

const KEY = 'deramandi.settings'
const DEFAULTS: Settings = { demoMode: true, largeText: false, voice: false, voiceOffered: false, helperMode: false }

let current: Settings = read()
const listeners = new Set<() => void>()

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

export function getSettings() {
  return current
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* private mode: keep in memory */
  }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}
