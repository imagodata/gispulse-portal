import { create } from "zustand"

export interface ExecutionResult {
  id: string
  type: "rule" | "scenario" | "job"
  name: string
  status: "running" | "completed" | "failed"
  datasetId?: string
  layerName?: string
  ruleName?: string
  capability?: string
  featureCount?: number
  durationMs?: number
  errorMessage?: string
  resultPath?: string
  createdAt: string
}

interface ResultsState {
  results: ExecutionResult[]
  addResult: (result: ExecutionResult) => void
  updateResult: (id: string, patch: Partial<ExecutionResult>) => void
  removeResult: (id: string) => void
  clearResults: () => void
}

const MAX_RESULTS = 50

export const useResultsStore = create<ResultsState>((set) => ({
  results: [],
  addResult: (result) =>
    set((s) => ({ results: [result, ...s.results].slice(0, MAX_RESULTS) })),
  updateResult: (id, patch) =>
    set((s) => ({
      results: s.results.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  removeResult: (id) =>
    set((s) => ({ results: s.results.filter((r) => r.id !== id) })),
  clearResults: () => set({ results: [] }),
}))
