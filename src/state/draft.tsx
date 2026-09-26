import { useCallback, useState, type ReactNode } from 'react'
import { DraftContext, type Draft } from './draftContext'

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

  return <DraftContext.Provider value={{ draft, update, reset }}>{children}</DraftContext.Provider>
}
