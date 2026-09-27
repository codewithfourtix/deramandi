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

/*
  New versions: the service worker installs a new build in the background and
  takes over (skipWaiting + clientsClaim). The generated register script never
  reloads, so the page kept showing the old build until the app was closed and
  reopened. Now: on takeover, reload at once on a quiet screen; in the middle
  of listing a crop, show an "update ready" bar instead so nothing is lost.
*/
let updateReady = false
const BUSY = ['/list', '/list/photos']

export function watchForUpdates() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const hadController = Boolean(navigator.serviceWorker.controller)
  let handled = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || handled) return // first install: the page is already current
    handled = true
    if (BUSY.includes(location.pathname)) {
      updateReady = true
      notify()
    } else {
      location.reload()
    }
  })
  // Phones keep the app open for days: look for a new build whenever it comes back.
  const check = () => navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {})
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  window.setInterval(check, 30 * 60 * 1000)
}

export function useUpdateReady() {
  return useSyncExternalStore(subscribe, () => updateReady, () => false)
}
