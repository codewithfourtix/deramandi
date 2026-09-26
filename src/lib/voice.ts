import { useEffect, useSyncExternalStore } from 'react'
import i18n from '../i18n'
import manifest from '../data/voiceManifest.json'
import { getSettings } from './settings'
import { numberSegs } from './spokenNumber'

/*
  The voice guide. A line is a list of segments: an i18n key (a fixed sentence)
  or a number. Urdu is played from clips recorded by scripts/make-voice.py,
  with silence trimmed so numbers join up naturally. English, and any Urdu
  line with no clip, uses the phone's own speech engine when it has one.

  Browsers only allow sound after the user touches the page, so a line asked
  for before that waits and plays on the first touch.
*/

export type Seg = string | number

const CLIPS: Record<string, string> = manifest.clips

// ---- state for the UI ----------------------------------------------------------
interface VoiceState {
  speaking: boolean
  caption: string
}
let state: VoiceState = { speaking: false, caption: '' }
const listeners = new Set<() => void>()
function set(patch: Partial<VoiceState>) {
  state = { ...state, ...patch }
  listeners.forEach((fn) => fn())
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const useVoiceState = () => useSyncExternalStore(subscribe, () => state, () => state)

/** What the line says, as text, in the current language (the on-screen caption). */
export function lineText(segs: Seg[], lang = i18n.language) {
  const t = i18n.getFixedT(lang)
  return segs
    .map((s) => (typeof s === 'number' ? (Number.isInteger(s) ? String(s) : s.toFixed(1)) : t(s)))
    .join(' ')
    .replace(/\s+([۔.,،:])/g, '$1')
}

// ---- audio ---------------------------------------------------------------------
let ctx: AudioContext | null = null
let token = 0
let sources: AudioBufferSourceNode[] = []
let pending: Seg[] | null = null
const buffers = new Map<string, Promise<{ buf: AudioBuffer; start: number; end: number } | null>>()

function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/** Call from any touch or key press: lets sound play, and plays a line that was waiting. */
export function unlockAudio() {
  const c = audioContext()
  if (c && c.state !== 'running') c.resume().catch(() => {})
  // called from inside a touch or key handler, so sound is allowed now
  const active = navigator.userActivation ? navigator.userActivation.isActive : true
  if (pending && (!c || c.state === 'running' || active)) {
    const line = pending
    pending = null
    speak(line)
  }
}

function clip(file: string) {
  let p = buffers.get(file)
  if (!p) {
    p = fetch(`/voice/ur/${file}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.arrayBuffer()
      })
      .then((data) => audioContext()!.decodeAudioData(data))
      .then((buf) => ({ buf, ...trim(buf) }))
      .catch(() => {
        buffers.delete(file)
        return null
      })
    buffers.set(file, p)
  }
  return p
}

/** Start and end of the audible part, so joined clips have no dead air. */
function trim(buf: AudioBuffer) {
  const data = buf.getChannelData(0)
  const threshold = 0.012
  let a = 0
  while (a < data.length && Math.abs(data[a]) < threshold) a++
  let b = data.length - 1
  while (b > a && Math.abs(data[b]) < threshold) b--
  const pad = 0.03 * buf.sampleRate
  return { start: Math.max(0, a - pad) / buf.sampleRate, end: Math.min(data.length, b + pad) / buf.sampleRate }
}

export function stopSpeaking() {
  token++
  pending = null
  for (const s of sources) {
    try {
      s.stop()
    } catch {
      /* already stopped */
    }
  }
  sources = []
  if ('speechSynthesis' in window) speechSynthesis.cancel()
  set({ speaking: false })
}

function urduKeys(segs: Seg[]) {
  return segs.flatMap((s) => (typeof s === 'number' ? numberSegs(s) : [s]))
}

/** Speak a line now (stopping whatever was playing). */
export function speak(segs: Seg[]) {
  if (!segs.length) return
  stopSpeaking()
  const my = token
  const lang = i18n.language === 'ur' ? 'ur' : 'en'
  set({ caption: lineText(segs, lang) })

  const c = audioContext()
  const keys = urduKeys(segs)
  const haveClips = lang === 'ur' && c && keys.every((k) => CLIPS[k])
  if (haveClips) {
    if (c.state !== 'running') {
      c.resume().catch(() => {})
      if (!navigator.userActivation?.hasBeenActive) {
        pending = segs // plays on the first touch
        return
      }
    }
    set({ speaking: true })
    Promise.all(keys.map((k) => clip(CLIPS[k]))).then((parts) => {
      if (my !== token) return
      if (parts.some((p) => !p)) return speakWithEngine(segs, lang, my) // offline and never heard: use the phone
      let at = c.currentTime + 0.05
      parts.forEach((p, i) => {
        const src = c.createBufferSource()
        src.buffer = p!.buf
        src.connect(c.destination)
        src.start(at, p!.start, p!.end - p!.start)
        sources.push(src)
        at += p!.end - p!.start
        // short joins inside a number, a breath between sentences
        const next = keys[i + 1]
        at += next && (next.startsWith('n.') || keys[i].startsWith('n.')) ? 0.04 : 0.22
        if (i === parts.length - 1) src.onended = () => my === token && set({ speaking: false })
      })
    })
    return
  }
  speakWithEngine(segs, lang, my)
}

function speakWithEngine(segs: Seg[], lang: 'ur' | 'en', my: number) {
  if (!('speechSynthesis' in window)) return set({ speaking: false })
  const voices = speechSynthesis.getVoices()
  const voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang === 'ur' ? 'ur' : 'en'))
  if (lang === 'ur' && !voice) return set({ speaking: false }) // no Urdu voice on this phone: caption only
  const u = new SpeechSynthesisUtterance(lineText(segs, lang))
  u.lang = lang === 'ur' ? 'ur-PK' : 'en-IN'
  if (voice) u.voice = voice
  u.rate = 0.95
  u.onend = u.onerror = () => my === token && set({ speaking: false })
  set({ speaking: true })
  speechSynthesis.speak(u)
}

// ---- screens -------------------------------------------------------------------
let screen: Seg[] = []

export function currentScreenLine() {
  return screen
}

/**
 * Register what this screen says. It is spoken on arrival when the voice guide
 * is on, again from "Say it again", and after the guide is switched on here.
 */
export function useVoiceLine(segs: Seg[] | null) {
  const key = segs ? JSON.stringify(segs) : ''
  useEffect(() => {
    if (!key) return
    const line = JSON.parse(key) as Seg[]
    screen = line
    if (getSettings().voice) speak(line)
    return () => {
      if (screen === line) screen = []
    }
  }, [key])
}

/** Say something once (an event, not a screen): only when the guide is on. */
export function sayIfOn(segs: Seg[]) {
  if (getSettings().voice) speak(segs)
}
