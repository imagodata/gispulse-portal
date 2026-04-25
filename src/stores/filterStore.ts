/**
 * filterStore.ts — Zustand store for the FilterPanel.
 *
 * Manages interactive filter state: single filter, filter chain,
 * spatial predicates, buffer, history, validation, and cache stats.
 */

import { create } from "zustand"

export type SpatialPredicate =
  | "intersects"
  | "contains"
  | "within"
  | "crosses"
  | "touches"
  | "overlaps"
  | "disjoint"
  | "equals"
  | "dwithin"

export type FilterTypeId =
  | "spatial_selection"
  | "field_condition"
  | "fid_list"
  | "custom_expression"
  | "user_selection"
  | "buffer_intersect"
  | "spatial_relation"
  | "bbox_filter"
  | "materialized_view"

export type CombinationStrategyId =
  | "priority_and"
  | "priority_or"
  | "custom"
  | "replace"

export interface FilterChainItem {
  id: string
  type: FilterTypeId
  expression: string
  layerName: string
  priority: number
  operator: "AND" | "OR"
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  max_size: number
  hit_rate: number
  utilization: number
}

export interface FilterState {
  // Panel visibility
  open: boolean
  activeTab: "explore" | "filter" | "export"

  // Mode: "simple" = single filter, "chain" = multi-step
  filterMode: "simple" | "chain"

  // Source layer (reference geometry)
  sourceDatasetId: string | null
  sourceLayerName: string | null

  // Target layer (to filter)
  targetDatasetId: string | null
  targetLayerName: string | null

  // Simple mode: single filter
  expression: string
  spatialPredicate: SpatialPredicate | null
  bufferDistance: number
  bufferEnabled: boolean

  // Chain mode: multiple filters
  chainFilters: FilterChainItem[]
  combinationStrategy: CombinationStrategyId

  // Validation
  validationErrors: string[]
  isValidating: boolean

  // Results
  loading: boolean
  previewCount: number | null
  previewTotal: number | null
  previewBbox: [number, number, number, number] | null
  resultFeatures: Record<string, unknown>[] | null
  filteredCount: number | null
  error: string | null
  executionTimeMs: number | null
  isCached: boolean
  backend: string | null

  // Cache stats
  cacheStats: CacheStats | null

  // History
  history: FilterHistoryEntry[]
  historyIndex: number
}

export interface FilterHistoryEntry {
  id: string
  timestamp: number
  expression: string
  spatialPredicate: SpatialPredicate | null
  sourceLayerName: string | null
  targetLayerName: string | null
  bufferDistance: number
  resultCount: number
}

interface FilterActions {
  setOpen: (open: boolean) => void
  toggle: () => void
  setActiveTab: (tab: FilterState["activeTab"]) => void

  setFilterMode: (mode: "simple" | "chain") => void

  setSource: (datasetId: string | null, layerName: string | null) => void
  setTarget: (datasetId: string | null, layerName: string | null) => void

  // Simple mode
  setExpression: (expr: string) => void
  setSpatialPredicate: (pred: SpatialPredicate | null) => void
  togglePredicate: (pred: SpatialPredicate) => void
  setBufferDistance: (dist: number) => void
  setBufferEnabled: (enabled: boolean) => void

  // Chain mode
  addChainFilter: (filter: Omit<FilterChainItem, "id">) => void
  removeChainFilter: (id: string) => void
  updateChainFilter: (id: string, updates: Partial<FilterChainItem>) => void
  reorderChainFilter: (id: string, direction: "up" | "down") => void
  setCombinationStrategy: (strategy: CombinationStrategyId) => void
  clearChainFilters: () => void

  // Validation
  setValidationErrors: (errors: string[]) => void
  setIsValidating: (v: boolean) => void

  // Results
  setLoading: (loading: boolean) => void
  setPreview: (count: number, total: number, bbox: [number, number, number, number] | null, timeMs?: number, cached?: boolean, backend?: string) => void
  setResults: (features: Record<string, unknown>[], count: number, timeMs?: number, cached?: boolean, backend?: string) => void
  setError: (error: string | null) => void
  clearResults: () => void

  // Cache
  setCacheStats: (stats: CacheStats | null) => void

  // History
  pushHistory: (entry: Omit<FilterHistoryEntry, "id" | "timestamp">) => void
  restoreHistory: (index: number) => void

  reset: () => void
}

const initialState: FilterState = {
  open: false,
  activeTab: "filter",
  filterMode: "simple",
  sourceDatasetId: null,
  sourceLayerName: null,
  targetDatasetId: null,
  targetLayerName: null,
  expression: "",
  spatialPredicate: null,
  bufferDistance: 100,
  bufferEnabled: false,
  chainFilters: [],
  combinationStrategy: "priority_and",
  validationErrors: [],
  isValidating: false,
  loading: false,
  previewCount: null,
  previewTotal: null,
  previewBbox: null,
  resultFeatures: null,
  filteredCount: null,
  error: null,
  executionTimeMs: null,
  isCached: false,
  backend: null,
  cacheStats: null,
  history: [],
  historyIndex: -1,
}

export const useFilterStore = create<FilterState & FilterActions>((set, get) => ({
  ...initialState,

  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  setActiveTab: (activeTab) => set({ activeTab }),

  setFilterMode: (filterMode) => set({ filterMode }),

  setSource: (datasetId, layerName) =>
    set({ sourceDatasetId: datasetId, sourceLayerName: layerName }),

  setTarget: (datasetId, layerName) =>
    set({ targetDatasetId: datasetId, targetLayerName: layerName }),

  // Simple mode
  setExpression: (expression) => set({ expression, validationErrors: [] }),
  setSpatialPredicate: (spatialPredicate) => set({ spatialPredicate }),
  togglePredicate: (pred) =>
    set((s) => ({
      spatialPredicate: s.spatialPredicate === pred ? null : pred,
    })),
  setBufferDistance: (bufferDistance) => set({ bufferDistance }),
  setBufferEnabled: (bufferEnabled) => set({ bufferEnabled }),

  // Chain mode
  addChainFilter: (filter) =>
    set((s) => ({
      chainFilters: [
        ...s.chainFilters,
        { ...filter, id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
      ],
    })),

  removeChainFilter: (id) =>
    set((s) => ({ chainFilters: s.chainFilters.filter((f) => f.id !== id) })),

  updateChainFilter: (id, updates) =>
    set((s) => ({
      chainFilters: s.chainFilters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),

  reorderChainFilter: (id, direction) =>
    set((s) => {
      const idx = s.chainFilters.findIndex((f) => f.id === id)
      if (idx < 0) return s
      const newIdx = direction === "up" ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= s.chainFilters.length) return s
      const arr = [...s.chainFilters]
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return { chainFilters: arr }
    }),

  setCombinationStrategy: (combinationStrategy) => set({ combinationStrategy }),
  clearChainFilters: () => set({ chainFilters: [] }),

  // Validation
  setValidationErrors: (validationErrors) => set({ validationErrors }),
  setIsValidating: (isValidating) => set({ isValidating }),

  // Results
  setLoading: (loading) => set({ loading }),

  setPreview: (count, total, bbox, timeMs, cached, backend) =>
    set({
      previewCount: count,
      previewTotal: total,
      previewBbox: bbox,
      executionTimeMs: timeMs ?? null,
      isCached: cached ?? false,
      backend: backend ?? null,
      error: null,
    }),

  setResults: (features, count, timeMs, cached, backend) =>
    set({
      resultFeatures: features,
      filteredCount: count,
      executionTimeMs: timeMs ?? null,
      isCached: cached ?? false,
      backend: backend ?? null,
      error: null,
      loading: false,
    }),

  setError: (error) => set({ error, loading: false }),

  clearResults: () =>
    set({
      resultFeatures: null,
      filteredCount: null,
      previewCount: null,
      previewTotal: null,
      previewBbox: null,
      executionTimeMs: null,
      isCached: false,
      backend: null,
      error: null,
    }),

  // Cache
  setCacheStats: (cacheStats) => set({ cacheStats }),

  // History
  pushHistory: (entry) =>
    set((s) => {
      const item: FilterHistoryEntry = {
        ...entry,
        id: `filter-${Date.now()}`,
        timestamp: Date.now(),
      }
      const history = [...s.history, item]
      return { history, historyIndex: history.length - 1 }
    }),

  restoreHistory: (index) => {
    const { history } = get()
    const entry = history[index]
    if (!entry) return
    set({
      historyIndex: index,
      expression: entry.expression,
      spatialPredicate: entry.spatialPredicate,
      sourceLayerName: entry.sourceLayerName,
      targetLayerName: entry.targetLayerName,
      bufferDistance: entry.bufferDistance,
    })
  },

  reset: () => set({ ...initialState, open: get().open }),
}))
