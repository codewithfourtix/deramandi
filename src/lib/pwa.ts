import { useSyncExternalStore } from 'react'

/*
  Install-to-home-screen and online/offline state. Chrome fires
  beforeinstallprompt once the app qualifies; we keep the event so a plain
  "Install" button can show the browser's own prompt later.
*/

interface InstallEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallEvent | null = null
let installed = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  window.addEventListener('online', fn)
  window.addEventListener('offline', fn)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('online', fn)
    window.removeEventListener('offline', fn)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    notify()
  })
}

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}

/** 'available' when the browser will show an install prompt; 'installed' when running as the app. */
export function useInstallState(): 'available' | 'installed' | 'unavailable' {
  return useSyncExternalStore(
    subscribe,
    () => (installed ? 'installed' : deferred ? 'available' : 'unavailable'),
    () => 'unavailable',
  )
}

export async function promptInstall() {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  notify()
  return outcome === 'accepted'
}
