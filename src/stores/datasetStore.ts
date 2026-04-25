import { create } from "zustand"
import type { DatasetMeta, LayerMeta } from "@/types/dataset"
import { listDatasets } from "@/api/client"

interface DatasetState {
  /** All loaded datasets */
  datasets: DatasetMeta[]
  /** Currently selected dataset id */
  selectedDatasetId: string | null
  /** Currently selected layer name */
  selectedLayerName: string | null
  /** Loading state */
  loading: boolean
  /** Last fetch error message, or null if none (#212) */
  fetchError: string | null

  // Actions
  fetchDatasets: () => Promise<void>
  addDataset: (ds: DatasetMeta) => void
  setDatasets: (ds: DatasetMeta[]) => void
  removeDataset: (id: string) => void
  renameDataset: (id: string, name: string) => void
  selectDataset: (id: string | null) => void
  selectLayer: (datasetId: string, layerName: string) => void
  setLoading: (loading: boolean) => void
}

export const useDatasetStore = create<DatasetState>((set) => ({
  datasets: [],
  selectedDatasetId: null,
  selectedLayerName: null,
  loading: false,
  fetchError: null,

  fetchDatasets: async () => {
    set({ loading: true, fetchError: null })
    try {
      const datasets = await listDatasets()
      set({ datasets })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch datasets"
      set({ fetchError: msg })
    } finally {
      set({ loading: false })
    }
  },

  addDataset: (ds) =>
    set((s) => ({ datasets: [...s.datasets, ds] })),

  setDatasets: (datasets) => set({ datasets }),

  removeDataset: (id) =>
    set((s) => ({
      datasets: s.datasets.filter((d) => d.id !== id),
      selectedDatasetId: s.selectedDatasetId === id ? null : s.selectedDatasetId,
      selectedLayerName: s.selectedDatasetId === id ? null : s.selectedLayerName,
    })),

  renameDataset: (id, name) =>
    set((s) => ({
      datasets: s.datasets.map((d) => (d.id === id ? { ...d, name } : d)),
    })),

  selectDataset: (id) =>
    set({ selectedDatasetId: id, selectedLayerName: null }),

  selectLayer: (datasetId, layerName) =>
    set({ selectedDatasetId: datasetId, selectedLayerName: layerName }),

  setLoading: (loading) => set({ loading }),
}))

/** Derived selector: get currently selected dataset */
export const useSelectedDataset = (): DatasetMeta | null => {
  const selectedDatasetId = useDatasetStore((s) => s.selectedDatasetId)
  const dataset = useDatasetStore((s) =>
    s.datasets.find((d) => d.id === s.selectedDatasetId) ?? null
  )
  if (!selectedDatasetId) return null
  return dataset
}

/** Derived selector: get currently selected layer */
export const useSelectedLayer = (): LayerMeta | null => {
  const ds = useSelectedDataset()
  const layerName = useDatasetStore((s) => s.selectedLayerName)
  if (!ds || !layerName) return null
  return (ds.layers ?? []).find((l) => l.name === layerName) ?? null
}
