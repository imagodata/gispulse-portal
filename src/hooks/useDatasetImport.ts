import { useCallback, useState } from "react"
import { toast } from "sonner"
import { useDatasetStore } from "@/stores/datasetStore"
import { useMapViewStore, layerKey } from "@/stores/mapViewStore"
import { uploadDataset, DuplicateDatasetError } from "@/api/client"

export interface PendingDuplicate {
  file: File
  existingName: string
}

export interface DatasetImport {
  isDragOver: boolean
  pendingDuplicate: PendingDuplicate | null
  clearPendingDuplicate: () => void
  importFile: (file: File, force?: boolean) => Promise<void>
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleDragOver: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => Promise<void>
  confirmDuplicate: () => Promise<void>
}

/**
 * Shared hook for dataset import via file input or drag-and-drop.
 * Handles upload, duplicate detection, GPKG style import, and layer registration.
 */
export function useDatasetImport(): DatasetImport {
  const addDataset = useDatasetStore((s) => s.addDataset)
  const setLoading = useDatasetStore((s) => s.setLoading)
  const addLayer = useMapViewStore((s) => s.addLayer)
  const applyImportedStyles = useMapViewStore((s) => s.applyImportedStyles)

  const [isDragOver, setIsDragOver] = useState(false)
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null)

  const importFile = useCallback(
    async (file: File, force = false) => {
      setLoading(true)
      try {
        const ds = await uploadDataset(file, force)
        addDataset(ds)
        if (ds.styles && ds.styles.length > 0) {
          applyImportedStyles(ds.id, ds.styles, ds.style_defs as any)
          toast.success(`"${ds.name}" imported with ${ds.styles.length} style(s)`)
        } else {
          for (const l of ds.layers ?? []) {
            addLayer(layerKey(ds.id, l.name))
          }
          toast.success(`"${ds.name}" imported`)
        }
      } finally {
        setLoading(false)
      }
    },
    [addDataset, setLoading, addLayer, applyImportedStyles],
  )

  const _tryImport = useCallback(
    async (file: File) => {
      try {
        await importFile(file)
      } catch (err) {
        if (err instanceof DuplicateDatasetError) {
          setPendingDuplicate({ file, existingName: err.existingName })
        } else {
          toast.error("Import failed: " + (err instanceof Error ? err.message : String(err)))
        }
      }
    },
    [importFile],
  )

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ""
      await _tryImport(file)
    },
    [_tryImport],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault()
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (!file) return
      await _tryImport(file)
    },
    [_tryImport],
  )

  const clearPendingDuplicate = useCallback(() => setPendingDuplicate(null), [])

  const confirmDuplicate = useCallback(async () => {
    if (!pendingDuplicate) return
    const { file } = pendingDuplicate
    setPendingDuplicate(null)
    try {
      await importFile(file, true)
    } catch (err) {
      toast.error("Import failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [pendingDuplicate, importFile])

  return {
    isDragOver,
    pendingDuplicate,
    clearPendingDuplicate,
    importFile,
    handleFileInput,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    confirmDuplicate,
  }
}
