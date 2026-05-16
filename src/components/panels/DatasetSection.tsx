import { useCallback, useMemo, useRef, useState } from "react"
import { Pencil, Download, Trash2, Database, FileType, Link, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDatasetStore } from "@/stores/datasetStore"
import { useMapViewStore, useActiveLayerStack, layerKey } from "@/stores/mapViewStore"
import { uploadDataset, deleteDatasetApi, renameDatasetApi, exportGpkg, importDatasetFromUrl, DuplicateDatasetError } from "@/api/client"
import { SectionHeader } from "@/components/panels/SectionHeader"
import { GeomIcon } from "@/components/layers"

// ---------- Helpers ----------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// ---------- Datasets Section ----------

export function DatasetsSection() {
  const { datasets, addDataset, removeDataset, renameDataset, setLoading } = useDatasetStore()
  const { addLayer, applyImportedStyles } = useMapViewStore()
  const activeLayerStack = useActiveLayerStack()
  const fileRef = useRef<HTMLInputElement>(null)

  // URL import state
  const [urlInput, setUrlInput] = useState("")
  const [urlImporting, setUrlImporting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const VALID_EXTENSIONS = [".gpkg", ".geojson", ".json", ".shp", ".fgb", ".csv", ".parquet", ".zip"]

  const urlValidation = useMemo((): "empty" | "valid" | "invalid" => {
    if (!urlInput.trim()) return "empty"
    try {
      const u = new URL(urlInput.trim())
      if (!["http:", "https:"].includes(u.protocol)) return "invalid"
      const path = u.pathname.toLowerCase()
      if (!VALID_EXTENSIONS.some((ext) => path.endsWith(ext))) return "invalid"
      return "valid"
    } catch {
      return "invalid"
    }
  }, [urlInput])

  const handleUrlImport = useCallback(async () => {
    if (urlValidation !== "valid" || urlImporting) return
    const url = urlInput.trim()
    const name = url.split("/").pop()?.split("?")[0] ?? "import"
    setUrlImporting(true)
    try {
      const ds = await importDatasetFromUrl(url, name)
      addDataset(ds)
      // Auto-add all layers to the active map view
      for (const l of ds.layers ?? []) addLayer(layerKey(ds.id, l.name))
      setUrlInput("")
      toast.success(`Imported "${ds.name}"`)
    } catch (err) {
      toast.error("Import failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUrlImporting(false)
    }
  }, [urlValidation, urlImporting, urlInput, addDataset, addLayer])

  const doImport = useCallback(
    async (file: File, force = false) => {
      setLoading(true)
      try {
        const ds = await uploadDataset(file, force)
        addDataset(ds)
        if (ds.styles && ds.styles.length > 0) {
          applyImportedStyles(ds.id, ds.styles, ds.style_defs as any)
        } else {
          for (const l of ds.layers ?? []) addLayer(layerKey(ds.id, l.name))
        }
      } catch (err) {
        if (err instanceof DuplicateDatasetError) {
          toast.info(`"${err.existingName}" already imported`, {
            action: { label: "Import anyway", onClick: () => doImport(file, true) },
            duration: 8000,
          })
        } else {
          toast.error("Upload failed: " + (err instanceof Error ? err.message : String(err)))
        }
      } finally {
        setLoading(false)
      }
    },
    [addDataset, setLoading, addLayer, applyImportedStyles],
  )

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      await doImport(file)
      if (fileRef.current) fileRef.current.value = ""
    },
    [doImport],
  )

  const handleFileDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (!file) return
      await doImport(file)
    },
    [doImport],
  )

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleDelete = useCallback(async (ds: { id: string; name: string; layers: { name: string }[] }) => {
    try {
      await deleteDatasetApi(ds.id)
      removeDataset(ds.id)
      // Remove associated layers from all map views
      const remaining = useDatasetStore.getState().datasets
      const validKeys = new Set<string>()
      for (const d of remaining) {
        for (const l of d.layers ?? []) validKeys.add(layerKey(d.id, l.name))
      }
      useMapViewStore.getState().cleanupOrphanedLayers(validKeys)
      toast.success(`Dataset "${ds.name}" deleted`)
    } catch (err) {
      toast.error("Delete failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setConfirmDeleteId(null)
    }
  }, [removeDataset])

  const handleRename = useCallback(async (id: string) => {
    if (!editName.trim()) { setEditingId(null); return }
    try {
      await renameDatasetApi(id, editName.trim())
      renameDataset(id, editName.trim())
      toast.success("Dataset renamed")
    } catch (err) {
      toast.error("Rename failed: " + (err instanceof Error ? err.message : String(err)))
    }
    setEditingId(null)
  }, [editName, renameDataset])

  const handleExport = useCallback(async (ds: { id: string; name: string; layers: { name: string }[] }) => {
    const layers = (ds.layers ?? []).map((l) => ({
      datasetId: ds.id,
      layerName: l.name,
    }))
    try {
      await exportGpkg(layers, `${ds.name}.gpkg`)
      toast.success("Export started")
    } catch (err) {
      toast.error("Export failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [])

  const sessionDatasets = useMemo(() => datasets.filter((ds) => ds.source_type === "session"), [datasets])
  const projectDatasets = useMemo(() => datasets.filter((ds) => !ds.source_type || ds.source_type === "project"), [datasets])

  const renderDataset = (ds: typeof datasets[0]) => {
    const totalFeatures = (ds.layers ?? []).reduce((a, l) => a + l.feature_count, 0)
    const isEditing = editingId === ds.id
    const isSession = ds.source_type === "session"

    return (
      <div
        key={ds.id}
        className="rounded-md border bg-card p-2.5 space-y-1.5"
      >
        {/* Header: name + format badge */}
        <div className="flex items-center gap-1.5">
          {isSession
            ? <Database size={13} className="shrink-0 text-orange-500" />
            : <FileType size={13} className="shrink-0 text-primary/70" />
          }
          {isEditing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename(ds.id)
                if (e.key === "Escape") setEditingId(null)
              }}
              onBlur={() => handleRename(ds.id)}
              className="flex-1 min-w-0 text-xs font-medium bg-transparent border-b border-border outline-none"
            />
          ) : (
            <span className="flex-1 min-w-0 truncate text-xs font-medium">{ds.name}</span>
          )}
          {isSession ? (
            <Badge className="text-label-xs h-3.5 px-1 shrink-0 bg-amber-500/10 text-amber-600 border-amber-500/20">PG</Badge>
          ) : (
            <Badge variant="outline" className="text-label-xs h-3.5 px-1 shrink-0 uppercase">{ds.format}</Badge>
          )}
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-label text-muted-foreground">
          <span>{(ds.layers ?? []).length} layer{(ds.layers ?? []).length !== 1 ? "s" : ""}</span>
          <span>{totalFeatures.toLocaleString()} features</span>
          {ds.file_size > 0 && <span>{formatBytes(ds.file_size)}</span>}
          {ds.crs && <span>{ds.crs}</span>}
        </div>

        {/* Layers list — draggable to add to map */}
        {(ds.layers ?? []).length > 0 && (
          <div className="space-y-0.5 pt-0.5">
            {(ds.layers ?? []).map((layer) => {
              const lk = layerKey(ds.id, layer.name)
              const isOnMap = activeLayerStack.some((l) => l.key === lk)
              return (
                <div
                  key={layer.name}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/gispulse-layer",
                      JSON.stringify({ datasetId: ds.id, layerName: layer.name }),
                    )
                    e.dataTransfer.effectAllowed = "copy"
                  }}
                  className={`flex items-center gap-1.5 text-label pl-1 rounded cursor-grab active:cursor-grabbing transition-colors ${
                    isOnMap ? "text-muted-foreground/50" : "text-muted-foreground hover:bg-accent/50"
                  }`}
                >
                  <GeomIcon type={layer.geometry_type} />
                  <span className="truncate flex-1">{layer.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground/60">{layer.feature_count.toLocaleString()}</span>
                  {!isOnMap ? (
                    <button
                      onClick={() => { addLayer(lk); toast.success(`"${layer.name}" added to map`) }}
                      className="shrink-0 text-label-sm font-medium px-1 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title="Add to map"
                    >
                      + Map
                    </button>
                  ) : (
                    <span className="shrink-0 text-label-sm text-green-500/60" title="Already on map">on map</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-0.5 pt-0.5 border-t border-border/40">
          <button
            onClick={() => { setEditingId(ds.id); setEditName(ds.name) }}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Rename"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={() => handleExport(ds)}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Export as GPKG"
          >
            <Download size={11} />
          </button>
          <div className="flex-1" />
          {confirmDeleteId === ds.id ? (
            <div className="flex items-center gap-1">
              <span className="text-label text-destructive">Delete?</span>
              <button
                onClick={() => handleDelete(ds)}
                className="text-label-sm font-medium px-1.5 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="text-label-sm font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-accent transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteId(ds.id)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-destructive transition-colors"
              title="Delete dataset"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    )
  }

  const showSubHeaders = sessionDatasets.length > 0 && projectDatasets.length > 0

  return (
    <>
      <SectionHeader title="Datasets" count={datasets.length} onAdd={() => fileRef.current?.click()} />
      <ScrollArea className="flex-1">
        {/* Import zone */}
        <div
          onDrop={handleFileDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="mx-3 mt-3 mb-2 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 p-3 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          Drop file or click to import
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".gpkg,.geojson,.json,.shp,.fgb,.csv,.parquet"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* URL import */}
        <div className="mx-3 mb-3">
          <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors ${
            urlValidation === "valid" ? "border-green-500/60 bg-green-500/5" :
            urlValidation === "invalid" && urlInput ? "border-destructive/50 bg-destructive/5" :
            ""
          }`}>
            <Link size={12} className="text-muted-foreground/60 shrink-0" />
            <input
              type="url"
              placeholder="Paste URL to import..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleUrlImport() }}
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40"
            />
            {urlValidation === "valid" && (
              <span title="Valid URL"><CheckCircle2 size={12} className="shrink-0 text-green-500" /></span>
            )}
            {urlValidation === "invalid" && urlInput && (
              <span title="Invalid URL or unsupported format"><AlertCircle size={12} className="shrink-0 text-destructive/70" /></span>
            )}
            {urlValidation === "valid" && (
              <button
                onClick={handleUrlImport}
                disabled={urlImporting}
                className="shrink-0 text-label font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {urlImporting ? "\u2026" : "Import"}
              </button>
            )}
          </div>
          {urlValidation === "invalid" && urlInput && (
            <p className="mt-0.5 text-label text-destructive/70 px-1">
              Must be http(s) URL ending in .gpkg, .geojson, .shp, etc.
            </p>
          )}
        </div>

        {/* Dataset cards */}
        <div className="px-3 pb-3 space-y-2">
          {showSubHeaders && sessionDatasets.length > 0 && (
            <div className="flex items-center gap-1.5 pt-0.5 pb-0.5">
              <span className="text-label-sm font-semibold uppercase tracking-wider text-orange-500/80">Session</span>
              <div className="flex-1 h-px bg-orange-500/20" />
            </div>
          )}
          {sessionDatasets.map(renderDataset)}
          {showSubHeaders && projectDatasets.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 pb-0.5">
              <span className="text-label-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Project</span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
          )}
          {projectDatasets.map(renderDataset)}
        </div>

        {datasets.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            No datasets yet. Import a file to get started.
          </p>
        )}
      </ScrollArea>
    </>
  )
}
