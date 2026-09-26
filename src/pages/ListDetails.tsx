import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { CropGlyph } from '../components/CropGlyph'
import { FarmerPicker } from '../components/FarmerPicker'
import { updateSettings, useSettings } from '../lib/settings'
import { CheckIcon, MicIcon } from '../components/Icons'
import { Steps } from '../components/Steps'
import { crops, locations } from '../data'
import { useDraft } from '../state/draftContext'
import { canListen, listenOnce } from '../lib/listen'
import { parseSpokenKg } from '../lib/spokenNumber'
import { sayIfOn, stopSpeaking, useVoiceLine } from '../lib/voice'
import type { CropId } from '../types'

type Errors = Partial<Record<'crop' | 'quantity' | 'location', string>>

const DIK_AREAS = locations.map((l) => l.id)

export function ListDetails() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  useVoiceLine(['voice.details'])
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const settings = useSettings()
  const { draft, update } = useDraft()
  const [qtyText, setQtyText] = useState(draft.quantityKg ? String(draft.quantityKg) : '')
  const [errors, setErrors] = useState<Errors>({})

  const qty = Number(qtyText.replace(/[^\d.]/g, ''))
  const maund = qty > 0 ? Math.round((qty / 40) * 10) / 10 : 0

  async function sayWeight() {
    stopSpeaking() // the mic must not hear the app
    setListening(true)
    setHeard(null)
    try {
      const alts = await listenOnce(i18n.language === 'ur' ? 'ur' : 'en')
      const kg = alts.map(parseSpokenKg).find((v) => v !== null)
      setHeard(alts[0])
      if (kg) {
        setQtyText(String(Math.min(kg, 9999999)))
        setErrors((er) => ({ ...er, quantity: undefined }))
        sayIfOn([kg])
      } else sayIfOn(['voice.micFail'])
    } catch {
      sayIfOn(['voice.micFail'])
    } finally {
      setListening(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    if (!draft.crop) next.crop = t('details.errCrop')
    if (!qty || qty <= 0) next.quantity = t('details.errQuantity')
    if (!draft.location) next.location = t('details.errLocation')
    setErrors(next)
    if (Object.keys(next).length) {
      const first = next.crop ? 'crop-group' : next.quantity ? 'qty' : 'location'
      document.getElementById(first)?.focus()
      return
    }
    update({ quantityKg: Math.round(qty), farmerId: settings.helperMode ? (draft.farmerId ?? settings.activeFarmerId) : undefined })
    navigate('/list/photos')
  }

  return (
    <form onSubmit={submit} noValidate>
      <Steps current={1} />
      <h1 className="display mb-6 text-[1.7rem]">{t('details.title')}</h1>
      {settings.helperMode && (
        <FarmerPicker
          value={draft.farmerId ?? settings.activeFarmerId}
          onChange={(id) => {
            update({ farmerId: id })
            updateSettings({ activeFarmerId: id })
          }}
        />
      )}

      <fieldset className="m-0 border-0 p-0">
        <legend className="field-label">{t('details.crop')}</legend>
        <div
          id="crop-group"
          role="radiogroup"
          tabIndex={-1}
          aria-invalid={!!errors.crop}
          aria-describedby={errors.crop ? 'crop-err' : undefined}
          className="grid grid-cols-2 gap-2"
        >
          {crops.map((c) => {
            const selected = draft.crop === c.id
            return (
              <label
                key={c.id}
                className={`relative flex cursor-pointer flex-col gap-1 rounded-md border-2 p-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indus ${
                  selected ? 'border-soil bg-date-wash' : 'border-line bg-sheet hover:border-soil-soft'
                } ${c.id === 'other' ? 'col-span-2 flex-row items-center gap-3' : ''}`}
              >
                <input
                  type="radio"
                  name="crop"
                  value={c.id}
                  checked={selected}
                  onChange={() => {
                    update({ crop: c.id as CropId })
                    setErrors((er) => ({ ...er, crop: undefined }))
                  }}
                  className="sr-only"
                />
                <CropGlyph crop={c.id} className={selected ? 'text-date-deep' : 'text-soil'} />
                <span>
                  <span className="block text-[1.05rem] font-bold leading-snug">{t(`crops.${c.id}`)}</span>
                  <span className="block text-[0.9rem] leading-snug text-soil-soft">{t(`cropHints.${c.id}`)}</span>
                </span>
                {selected && (
                  <span className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-soil text-paper">
                    <CheckIcon />
                  </span>
                )}
              </label>
            )
          })}
        </div>
        {errors.crop && (
          <p id="crop-err" className="mt-2 font-bold text-warn">
            {errors.crop}
          </p>
        )}
      </fieldset>

      <div className="mt-6">
        <label htmlFor="variety" className="field-label">
          {t('details.variety')}
        </label>
        <input
          id="variety"
          className="input"
          value={draft.variety}
          placeholder={t('details.varietyPlaceholder')}
          onChange={(e) => update({ variety: e.target.value })}
          autoComplete="off"
        />
      </div>

      <div className="mt-6">
        <label htmlFor="qty" className="field-label">
          {t('details.quantity')}
        </label>
        <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="qty"
            className="input num pe-16 text-[1.25rem]"
            inputMode="numeric"
            dir="ltr"
            value={qtyText}
            onChange={(e) => {
              setQtyText(e.target.value.replace(/[^\d]/g, '').slice(0, 7))
              setErrors((er) => ({ ...er, quantity: undefined }))
            }}
            aria-invalid={!!errors.quantity}
            aria-describedby={`qty-hint${errors.quantity ? ' qty-err' : ''}`}
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-bold text-soil-soft">{t('common.kg')}</span>
        </div>
          {canListen() && (
            <button
              type="button"
              onClick={sayWeight}
              disabled={listening}
              aria-label={t('voice.micLabel')}
              className={`btn min-h-12 shrink-0 gap-1 px-3 ${listening ? 'animate-pulse border-indus bg-indus text-paper' : 'btn-quiet'}`}
            >
              <MicIcon />
              <span className="text-[0.95rem]">{listening ? t('voice.micListen') : t('voice.mic')}</span>
            </button>
          )}
        </div>
        {heard && (
          <p className="mt-1 text-[0.9rem] text-soil-soft" aria-live="polite">
            {t('voice.micHeard', { text: heard })}
          </p>
        )}
        <p id="qty-hint" className="mt-1 text-[0.95rem] text-soil-soft">
          {maund > 0 ? t('details.maund', { count: maund }) : t('details.quantityHint')}
        </p>
        {errors.quantity && (
          <p id="qty-err" className="mt-1 font-bold text-warn">
            {errors.quantity}
          </p>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor="location" className="field-label">
          {t('details.location')}
        </label>
        <select
          id="location"
          className="input appearance-auto"
          value={draft.location}
          onChange={(e) => {
            update({ location: e.target.value })
            setErrors((er) => ({ ...er, location: undefined }))
          }}
          aria-invalid={!!errors.location}
          aria-describedby={errors.location ? 'loc-err' : undefined}
        >
          <option value="" disabled>
            {t('details.locationPlaceholder')}
          </option>
          {DIK_AREAS.map((id) => (
            <option key={id} value={id}>
              {t(`places.${id}`)}
            </option>
          ))}
        </select>
        {errors.location && (
          <p id="loc-err" className="mt-1 font-bold text-warn">
            {errors.location}
          </p>
        )}
      </div>

      <button type="submit" className="btn btn-primary mt-8 w-full">
        {t('details.next')}
      </button>
    </form>
  )
}
