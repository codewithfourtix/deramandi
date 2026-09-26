import { useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { CameraIcon, CloseIcon, GalleryIcon } from '../components/Icons'
import { Steps } from '../components/Steps'
import { gradeCrop, PhotoProblem } from '../lib/grader'
import { fileToDataUrl } from '../lib/image'
import { priceBand } from '../lib/match'
import { addListing, newId, StorageFullError } from '../lib/storage'
import { useDraft } from '../state/draft'
import type { Listing } from '../types'

const MAX_PHOTOS = 3
// Long enough that the check registers as a real step, short enough not to annoy.
const MIN_GRADING_MS = 1400

export function ListPhotos() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { draft, update, reset } = useDraft()
  const [error, setError] = useState<string | null>(null)
  const [grading, setGrading] = useState(false)
  const [badPhoto, setBadPhoto] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  if (!finished && (!draft.crop || !draft.quantityKg || !draft.location)) {
    return <Navigate to="/list" replace />
  }

  const photos = draft.photos
  const full = photos.length >= MAX_PHOTOS

  async function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow picking the same file again
    if (!files.length) return
    setError(null)
    setBadPhoto(null)
    const room = MAX_PHOTOS - photos.length
    if (files.length > room) setError(t('photos.max'))
    const added: string[] = []
    for (const file of files.slice(0, room)) {
      try {
        added.push(await fileToDataUrl(file))
      } catch {
        setError(t('photos.readError'))
      }
    }
    if (added.length) update({ photos: [...photos, ...added] })
  }

  function removePhoto(i: number) {
    update({ photos: photos.filter((_, idx) => idx !== i) })
    setError(null)
    setBadPhoto(null)
  }

  async function grade() {
    if (!photos.length || !draft.crop || !draft.quantityKg) return
    setGrading(true)
    setError(null)
    try {
      const [result] = await Promise.all([gradeCrop(photos, draft.crop), new Promise((r) => setTimeout(r, MIN_GRADING_MS))])
      const band = priceBand(draft.crop, result.grade)
      const listing: Listing = {
        id: newId(),
        crop: draft.crop,
        variety: draft.variety.trim() || undefined,
        quantityKg: draft.quantityKg,
        location: draft.location,
        photos,
        grade: result.grade,
        gradeConfidence: result.confidence,
        gradeFactors: result.factors,
        gradeSource: result.source,
        priceMin: band.min,
        priceMax: band.max,
        referencePrice: Math.round(((band.min + band.max) / 2) * 10) / 10,
        status: 'listed',
        createdAt: new Date().toISOString(),
      }
      addListing(listing)
      setFinished(true)
      navigate(`/listing/${listing.id}`, { replace: true, state: { reveal: true } })
      reset()
    } catch (err) {
      setGrading(false)
      if (err instanceof PhotoProblem) {
        setBadPhoto(err.photoIndex)
        setError(t(`photos.issue.${err.issue}`, { n: err.photoIndex + 1 }))
      } else {
        setError(err instanceof StorageFullError ? t('photos.storageFull') : t('photos.gradeError'))
      }
    }
  }

  return (
    <div>
      <Steps current={2} />
      <h1 className="display text-[1.7rem]">{t('photos.title')}</h1>
      <p className="mt-2 text-soil-soft">{t('photos.tip')}</p>

      {/* Two inputs on purpose: `capture` alone hides the gallery on Android. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={addFiles} aria-hidden="true" />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={addFiles} aria-hidden="true" />

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-quiet flex-col gap-1 py-3" disabled={full || grading} onClick={() => cameraRef.current?.click()}>
          <CameraIcon />
          {t('photos.camera')}
        </button>
        <button type="button" className="btn btn-quiet flex-col gap-1 py-3" disabled={full || grading} onClick={() => galleryRef.current?.click()}>
          <GalleryIcon />
          {t('photos.gallery')}
        </button>
      </div>

      <p className="mt-5 text-[0.95rem] font-bold" aria-live="polite">
        {t('photos.count', { count: photos.length })}
      </p>
      <ul className="m-0 mt-2 grid list-none grid-cols-3 gap-2 p-0">
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const src = photos[i]
          return (
            <li key={i} className={`relative aspect-square overflow-hidden rounded-md ${badPhoto === i ? 'outline-4 outline-offset-2 outline-warn' : ''}`}>
              {src ? (
                <>
                  <img src={src} alt={t('photos.photoAlt', { n: i + 1 })} className="h-full w-full object-cover" />
                  {grading && (
                    <span className="absolute inset-0 bg-soil/25" aria-hidden="true">
                      <span className="scan-line absolute inset-x-0 h-0.5 bg-date shadow-[0_0_10px_2px_var(--color-date)]" />
                    </span>
                  )}
                  {!grading && (
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label={t('photos.remove', { n: i + 1 })}
                      className="absolute end-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-soil/85 text-paper hover:bg-soil"
                    >
                      <CloseIcon />
                    </button>
                  )}
                </>
              ) : (
                <span className="flex h-full w-full items-center justify-center border-2 border-dashed border-line text-2xl text-line" aria-hidden="true">
                  <span className="num">{i + 1}</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>

      {photos.length === 0 && <p className="mt-3 text-soil-soft">{t('photos.empty')}</p>}

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-warn-wash px-3 py-2 font-bold text-warn">
          {error}
        </p>
      )}

      <button
        type="button"
        className={`btn btn-primary mt-8 w-full ${grading ? 'disabled:border-soil disabled:bg-soil disabled:text-paper' : ''}`}
        disabled={!photos.length || grading}
        onClick={grade}
        aria-busy={grading}
      >
        {grading ? t('photos.grading') : t('photos.grade')}
      </button>
      {grading && (
        <p className="sr-only" role="status">
          {t('photos.grading')}
        </p>
      )}
    </div>
  )
}
