import { create } from 'zustand'
import type { WeightConfig } from '../types/datum'

interface DatumStore {
  pendingWeights: WeightConfig | null
  setPendingWeights: (w: WeightConfig) => void
  clearPendingWeights: () => void
}

export const useDatumStore = create<DatumStore>(set => ({
  pendingWeights: null,
  setPendingWeights: (w) => set({ pendingWeights: w }),
  clearPendingWeights: () => set({ pendingWeights: null }),
}))
