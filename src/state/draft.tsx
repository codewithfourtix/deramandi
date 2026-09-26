import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { CropId } from '../types'

export interface Draft {
  crop?: CropId
  variety: string
  quantityKg?: number
  location: string
  photos: string[]
}

const EMPTY: Draft = { variety: '', location: '', photos: [] }
const KEY = 'deramandi.draft'

// Kept in sessionStorage so a reload on the photos step keeps the details.
function readDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

function writeDraft(d: Draft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    // quota or privacy mode: the draft simply won't survive a reload
  }
}

interface DraftCtx {
  draft: Draft
  update: (patch: Partial<Draft>) => void
  reset: () => void
}

const Ctx = createContext<DraftCtx | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(readDraft)

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      writeDraft(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    writeDraft(EMPTY)
    setDraft(EMPTY)
  }, [])

  return <Ctx.Provider value={{ draft, update, reset }}>{children}</Ctx.Provider>
}

export function useDraft() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDraft must be used inside DraftProvider')
  return ctx
}
