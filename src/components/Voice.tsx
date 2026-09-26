import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSettings, updateSettings, useSettings } from '../lib/settings'
import { currentScreenLine, setVoice, speak, stopSpeaking, unlockAudio, useVoiceState } from '../lib/voice'
import { RepeatIcon, SpeakerIcon } from './Icons'

const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role="switch"],[role="button"],[role="radio"],[contenteditable]'
const DOUBLE_TAP_MS = 380
const DOUBLE_TAP_PX = 40

let offeredThisVisit = false


/**
 * Listens on the whole page: any touch unlocks sound (and plays the spoken
 * offer on a first visit); a double tap on empty space turns the guide on or off.
 * Buttons, links and fields keep their normal behaviour.
 */
export function VoiceGuide() {
  const { t } = useTranslation()
  const settings = useSettings()
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Ask once per visit until answered. If the browser blocks sound, this waits for the first touch.
    if (!getSettings().voiceOffered && !getSettings().voice && !offeredThisVisit) {
      offeredThisVisit = true
      speak(['voice.offer'])
    }

    let last = { t: 0, x: 0, y: 0 }
    const onTapEnd = (e: PointerEvent) => {
      unlockAudio()
      if (e.button > 0) return
      const target = e.target as Element | null
      if (target?.closest(INTERACTIVE)) {
        last.t = 0
        return
      }
      const now = performance.now()
      if (now - last.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < DOUBLE_TAP_PX) {
        last.t = 0
        window.getSelection()?.removeAllRanges() // a double click selects a word on desktop
        const on = !getSettings().voice
        setVoice(on)
        window.clearTimeout(toastTimer.current)
        setToast(on ? 'voice.nowOn' : 'voice.nowOff')
        toastTimer.current = window.setTimeout(() => setToast(null), 2200)
        return
      }
      last = { t: now, x: e.clientX, y: e.clientY }
    }
    const onKey = () => unlockAudio()
    const onHide = () => document.visibilityState === 'hidden' && stopSpeaking()
    document.addEventListener('pointerdown', onKey, true)
    document.addEventListener('pointerup', onTapEnd, true)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('pointerdown', onKey, true)
      document.removeEventListener('pointerup', onTapEnd, true)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  return (
    <>
      {!settings.voice && !settings.voiceOffered && <VoiceOffer />}
      {settings.voice && <VoiceBar />}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4">
        {toast && (
          <p className="m-0 flex items-center gap-2 rounded-md bg-soil px-4 py-2 font-bold text-paper shadow-lg">
            <SpeakerIcon off={toast === 'voice.nowOff'} />
            {t(toast)}
          </p>
        )}
      </div>
    </>
  )
}

function VoiceOffer() {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="voice-offer-title" className="mb-6 rounded-md border-2 border-indus bg-indus-wash p-3">
      <h2 id="voice-offer-title" className="flex items-center gap-2 text-[1.05rem] font-bold text-indus">
        <SpeakerIcon />
        {t('voice.bannerTitle')}
      </h2>
      <p className="mt-1">{t('voice.bannerBody')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-11 px-4" onClick={() => setVoice(true)}>
          {t('voice.bannerYes')}
        </button>
        <button
          type="button"
          className="btn btn-quiet min-h-11 px-4"
          onClick={() => {
            stopSpeaking()
            updateSettings({ voiceOffered: true })
          }}
        >
          {t('voice.bannerNo')}
        </button>
      </div>
    </section>
  )
}

/** Shown while the guide is on: what is being said, and say it again / stop. */
function VoiceBar() {
  const { t } = useTranslation()
  const { speaking, caption } = useVoiceState()
  return (
    <div className="mb-5 flex items-center gap-2 rounded-md border border-line bg-sheet px-2 py-1.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${speaking ? 'bg-indus text-paper' : 'bg-indus-wash text-indus'}`} aria-hidden="true">
        <SpeakerIcon />
      </span>
      <p className="m-0 line-clamp-2 min-w-0 flex-1 text-[0.95rem] leading-snug text-soil-soft" aria-live="off">
        {speaking ? caption : t('voice.nowOn')}
      </p>
      {speaking ? (
        <button type="button" className="btn btn-quiet min-h-11 px-3 text-[0.95rem]" onClick={stopSpeaking}>
          {t('voice.stop')}
        </button>
      ) : (
        <button type="button" className="btn btn-quiet min-h-11 gap-1 px-3 text-[0.95rem]" onClick={() => speak(currentScreenLine().length ? currentScreenLine() : ['voice.on'])}>
          <RepeatIcon />
          {t('voice.repeat')}
        </button>
      )}
    </div>
  )
}

/** Header button: the visible way to switch the guide on or off. */
export function VoiceToggle() {
  const { t } = useTranslation()
  const { voice } = useSettings()
  return (
    <button
      type="button"
      onClick={() => setVoice(!voice)}
      aria-pressed={voice}
      aria-label={voice ? t('voice.toggleOn') : t('voice.toggleOff')}
      title={voice ? t('voice.toggleOn') : t('voice.toggleOff')}
      className={`flex h-11 w-10 shrink-0 items-center justify-center rounded-md ${voice ? 'bg-indus text-paper' : 'text-soil hover:bg-date-wash'}`}
    >
      <SpeakerIcon off={!voice} />
    </button>
  )
}
