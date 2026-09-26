import { createContext, useContext } from 'react'
import type { CropId } from '../types'

export interface Draft {
  crop?: CropId
  variety: string
  quantityKg?: number
  location: string
  photos: string[]
}

export interface DraftCtx {
  draft: Draft
  update: (patch: Partial<Draft>) => void
  reset: () => void
}

export const DraftContext = createContext<DraftCtx | null>(null)

export function useDraft() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft must be used inside DraftProvider')
  return ctx
}
