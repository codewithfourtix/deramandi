import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CropId } from '../types'
import { CloseIcon } from './Icons'

/*
  Live camera with a frame to aim at and plain warnings (too dark, too bright,
  hold still) measured from the picture itself. Photos are only taken when the
  person presses the shutter. If the camera cannot be opened, onUnavailable
  hands over to the phone's normal camera picker.
*/

type Check = 'ok' | 'dark' | 'bright' | 'blurry'
type Shape = 'circle' | 'long' | 'spread'

const SHAPE: Record<CropId, Shape> = {
  dhakki_dates: 'circle',
  kulachi_melon: 'circle',
  other: 'circle',
  sugarcane: 'long',
  wheat: 'spread',
}

interface Props {
  crop: CropId
  remaining: number
  onPhoto: (file: File) => void
  onClose: () => void
  onUnavailable: () => void
}

export function CameraGuide({ crop, remaining, onPhoto, onClose, onUnavailable }: Props) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [check, setCheck] = useState<Check>('ok')
  const [flash, setFlash] = useState(false)
  const [taken, setTaken] = useState(0)
  const shape = SHAPE[crop]
  const left = remaining - taken

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false
    const small = document.createElement('canvas')
    small.width = 96
    small.height = 96
    const sctx = small.getContext('2d', { willReadFrequently: true })

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        })
      } catch {
        if (!stopped) onUnavailable()
        return
      }
      if (stopped) return stream.getTracks().forEach((tr) => tr.stop())
      const v = video.current!
      v.srcObject = stream
      await v.play().catch(() => {})
      setReady(true)
      timer = window.setInterval(() => {
        if (!sctx || !v.videoWidth) return
        sctx.drawImage(v, 0, 0, 96, 96)
        setCheck(measure(sctx.getImageData(0, 0, 96, 96).data))
      }, 350)
    }
    start()
    return () => {
      stopped = true
      window.clearInterval(timer)
      stream?.getTracks().forEach((tr) => tr.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape closes, like any dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function shoot() {
    const v = video.current
    if (!v || !v.videoWidth || left <= 0) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    c.toBlob(
      (blob) => {
        if (!blob) return
        onPhoto(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }))
        setTaken((n) => n + 1)
        setFlash(true)
        window.setTimeout(() => setFlash(false), 180)
        if (left - 1 <= 0) window.setTimeout(onClose, 250)
      },
      'image/jpeg',
      0.9,
    )
  }

  const warn = check !== 'ok'
  return (
    <div role="dialog" aria-modal="true" aria-label={t('camera.title')} className="fixed inset-0 z-50 flex flex-col bg-black text-paper">
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        {flash && <div className="absolute inset-0 bg-white/70" aria-hidden="true" />}
        <Guide shape={shape} warn={warn} />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
          <p className="m-0 max-w-[30ch] text-[0.95rem] font-bold leading-snug">{t(`camera.aim_${shape}`)}</p>
          <button type="button" onClick={onClose} aria-label={t('camera.close')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/60">
            <CloseIcon />
          </button>
        </div>
        {!ready && <p className="absolute inset-0 flex items-center justify-center text-lg">{t('camera.starting')}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <p aria-live="polite" className={`m-0 flex-1 rounded-md px-3 py-2 text-[0.95rem] font-bold ${warn ? 'bg-warn text-paper' : 'bg-field text-paper'}`}>
          {t(`camera.check_${check}`)}
        </p>
        <button
          type="button"
          onClick={shoot}
          disabled={!ready || left <= 0}
          aria-label={t('camera.shutter')}
          className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-full border-4 border-paper bg-paper/20 p-1 disabled:opacity-40"
        >
          <span className="block h-full w-full rounded-full bg-paper" />
        </button>
        <p className="m-0 flex-1 text-end text-[0.95rem]">
          {t('camera.left', { count: Math.max(0, left) })}
          <br />
          <button type="button" onClick={onClose} className="mt-1 min-h-11 font-bold underline underline-offset-4">
            {t('camera.done')}
          </button>
        </p>
      </div>
    </div>
  )
}

function Guide({ shape, warn }: { shape: Shape; warn: boolean }) {
  const stroke = warn ? 'var(--color-warn-wash)' : 'white'
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {shape === 'circle' && <circle cx="50" cy="50" r="30" fill="none" stroke={stroke} strokeWidth="0.8" strokeDasharray="3 2" />}
      {shape === 'long' && <rect x="38" y="8" width="24" height="84" rx="3" fill="none" stroke={stroke} strokeWidth="0.8" strokeDasharray="3 2" />}
      {shape === 'spread' && <rect x="12" y="18" width="76" height="64" rx="3" fill="none" stroke={stroke} strokeWidth="0.8" strokeDasharray="3 2" />}
    </svg>
  )
}

/** Brightness and sharpness of a small frame. Rough thresholds: a warning to the person, never a block. */
export function measure(px: Uint8ClampedArray | number[]): Check {
  const side = Math.round(Math.sqrt(px.length / 4))
  const lum = new Float32Array(side * side)
  let sum = 0
  for (let i = 0; i < lum.length; i++) {
    lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
    sum += lum[i]
  }
  const mean = sum / lum.length
  if (mean < 50) return 'dark'
  if (mean > 230) return 'bright'
  // Laplacian energy: sharp frames have strong local contrast
  let energy = 0
  for (let y = 1; y < side - 1; y++) {
    for (let x = 1; x < side - 1; x++) {
      const i = y * side + x
      const lap = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - side] - lum[i + side]
      energy += lap * lap
    }
  }
  energy /= (side - 2) * (side - 2)
  return energy < 18 ? 'blurry' : 'ok'
}
