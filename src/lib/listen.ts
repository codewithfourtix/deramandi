/*
  One spoken answer through the browser's speech recognition (Chrome on
  Android sends audio to Google, so this needs internet). Not every browser has
  it: callers show the mic only when canListen() is true, and typing always works.
*/

interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function ctor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function canListen() {
  return typeof window !== 'undefined' && Boolean(ctor())
}

/** Resolves with every alternative heard (best first); rejects when nothing was heard. */
export function listenOnce(lang: 'ur' | 'en', timeoutMs = 8000): Promise<string[]> {
  const C = ctor()
  if (!C) return Promise.reject(new Error('unsupported'))
  return new Promise((resolve, reject) => {
    const r = new C()
    r.lang = lang === 'ur' ? 'ur-PK' : 'en-IN'
    r.interimResults = false
    r.maxAlternatives = 4
    let done = false
    const finish = (fn: () => void) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      fn()
    }
    const timer = window.setTimeout(() => {
      r.abort()
      finish(() => reject(new Error('timeout')))
    }, timeoutMs)
    r.onresult = (e) => {
      const first = e.results[0]
      const alts = Array.from({ length: first.length }, (_, i) => first[i].transcript)
      finish(() => resolve(alts))
    }
    r.onerror = (e) => finish(() => reject(new Error(e.error)))
    r.onend = () => finish(() => reject(new Error('no-speech')))
    r.start()
  })
}
