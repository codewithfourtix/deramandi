import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { newId, saveFarmer, useFarmers } from '../lib/storage'
import type { Farmer } from '../types'

/*
  Helper mode: one phone, several growers (a son helping his father's
  neighbours, a village helper, an arhti's clerk). Each listing is filed under
  a grower, whose name goes on the certificate and the request.
*/

export function FarmerForm({ onSaved, compact = false }: { onSaved: (f: Farmer) => void; compact?: boolean }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [village, setVillage] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState(false)

  // Enter in these fields adds the grower instead of submitting the listing form around them.
  const onEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  async function submit() {
    if (!name.trim()) {
      setError(true)
      return
    }
    const f: Farmer = { id: newId(), name: name.trim(), village: village.trim(), phone: phone.replace(/[^\d+]/g, '') || undefined, createdAt: new Date().toISOString() }
    await saveFarmer(f)
    setName('')
    setVillage('')
    setPhone('')
    setError(false)
    onSaved(f)
  }

  // A div, not a nested <form>: this sits inside the listing form.
  return (
    <div className={`mt-3 grid gap-2 rounded-md border-2 border-dashed border-line p-3 ${compact ? '' : 'sm:grid-cols-3'}`}>
      <div>
        <label htmlFor="farmer-name" className="field-label">
          {t('farmers.name')}
        </label>
        <input id="farmer-name" className="input" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} aria-invalid={error} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="farmer-village" className="field-label">
          {t('farmers.village')}
        </label>
        <input id="farmer-village" className="input" value={village} onChange={(e) => setVillage(e.target.value)} onKeyDown={onEnter} autoComplete="off" />
      </div>
      <div>
        <label htmlFor="farmer-phone" className="field-label">
          {t('farmers.phone')}
        </label>
        <input id="farmer-phone" className="input num" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={onEnter} autoComplete="off" />
      </div>
      {error && <p className="m-0 font-bold text-warn sm:col-span-3">{t('farmers.nameNeeded')}</p>}
      <button type="button" className="btn btn-quiet sm:col-span-3" onClick={submit}>
        {t('farmers.add')}
      </button>
    </div>
  )
}

/** "Whose crop is this?" on the listing form, shown only in helper mode. */
export function FarmerPicker({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
  const { t } = useTranslation()
  const farmers = useFarmers()
  const [adding, setAdding] = useState(farmers.length === 0)

  return (
    <div className="mb-6 rounded-md bg-indus-wash p-3">
      <label htmlFor="farmer" className="field-label">
        {t('farmers.whose')}
      </label>
      {farmers.length > 0 && (
        <select id="farmer" className="input appearance-auto" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">{t('farmers.none')}</option>
          {farmers.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.village ? ` (${f.village})` : ''}
            </option>
          ))}
        </select>
      )}
      {adding ? (
        <FarmerForm
          compact
          onSaved={(f) => {
            onChange(f.id)
            setAdding(false)
          }}
        />
      ) : (
        <button type="button" className="mt-2 inline-flex min-h-11 items-center font-bold text-indus underline underline-offset-4" onClick={() => setAdding(true)}>
          {t('farmers.addNew')}
        </button>
      )}
    </div>
  )
}
