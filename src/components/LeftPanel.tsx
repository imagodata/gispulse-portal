import { useCallback, useMemo, useState } from "react"
import { Search, Eye, EyeOff, ArrowLeft, X, Pencil, FolderPlus, ChevronDown, ChevronRight, FolderInput, Download, Trash2, Database, Link, CheckCircle2, AlertCircle, Copy, ClipboardPaste, Radio } from "lucide-react"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { toast } from "sonner"
import { IconButton } from "@/components/ui/icon-button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useUIStore, type ActivitySection } from "@/stores/uiStore"
import { useMapViewStore, useActiveView, useActiveLayerStack, useActiveLayerGroups, layerKey, parseLayerKey } from "@/stores/mapViewStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { useProjectStore, useActiveProject } from "@/stores/projectStore"
import { useMapStore } from "@/stores/mapStore"
import { uploadDataset, deleteDatasetApi, renameDatasetApi, exportGpkg, importDatasetFromUrl, DuplicateDatasetError } from "@/api/client"
import { useExternalLayersStore, type ExternalLayer } from "@/stores/externalLayersStore"
import { SceneManager } from "./SceneManager"
import { GeomIcon, SortableLayerItem, LayerGroupItem, BulkActionsBar, LayerItemButton, DatasetItem } from "./layers"
import { StyleEditorPanel } from "./style"

import { SectionHeader } from "@/components/panels/SectionHeader"
import { LayerContextMenu } from "./layers/LayerContextMenu"

// LayerItemButton and DatasetItem extracted to ./layers/ (#408)

// ---------- Layers Section ----------

function ExternalLayerItem({ layer }: { layer: ExternalLayer }) {
  const setVisible = useExternalLayersStore((s) => s.setVisible)
  const setOpacity = useExternalLayersStore((s) => s.setOpacity)
  const removeLayer = useExternalLayersStore((s) => s.removeLayer)

  return (
    <div className="group flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-accent transition-colors">
      <Radio size={12} className="shrink-0 text-blue-500" />
      <span className="flex-1 truncate font-medium">{layer.name}</span>
      <Badge variant="outline" className="text-label-sm font-mono uppercase shrink-0">
        {layer.protocol}
      </Badge>
      <button
        onClick={() => setVisible(layer.id, !layer.visible)}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        title={layer.visible ? "Hide" : "Show"}
      >
        {layer.visible ? <Eye size={11} /> : <EyeOff size={11} />}
      </button>
      <button
        onClick={() => removeLayer(layer.id)}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
        title="Remove"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

function ExternalLayersSection() {
  const externalLayers = useExternalLayersStore((s) => s.layers)

  if (externalLayers.length === 0) return null

  return (
    <div className="px-2 mb-1">
      <div className="flex items-center gap-1.5 px-1 pt-2 pb-1">
        <Radio size={10} className="text-blue-500/80" />
        <span className="text-label-sm font-semibold uppercase tracking-wider text-blue-500/80">
          Flux
        </span>
        <div className="flex-1 h-px bg-blue-500/20" />
        <span className="text-label-sm text-muted-foreground">{externalLayers.length}</span>
      </div>
      {externalLayers.map((layer) => (
        <ExternalLayerItem key={layer.id} layer={layer} />
      ))}
    </div>
  )
}

function LayersSection() {
  const { datasets, selectedDatasetId, selectedLayerName, selectLayer, addDataset, setLoading } =
    useDatasetStore()
  const { setContextSelection, selectedLayers, lastSelectedLayerKey, setSelectedLayers, toggleLayerInSelection, clearLayerSelection, setLastSelectedLayerKey } = useUIStore()
  const { setLayerVisible, setLayerColor, setLayerOpacity, reorderLayers, createLayerGroup, showAllLayers, hideAllLayers, addLayer, removeLayers, applyImportedStyles } = useMapViewStore()
  const layerStack = useActiveLayerStack()
  const layerGroups = useActiveLayerGroups()
  const triggers = useProjectStore((s) => s.triggers)
  const fileRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [dragOverLayers, setDragOverLayers] = useState(false)
  const [styleEditorKey, setStyleEditorKey] = useState<string | null>(null)

  // URL import state (#83)
  const [urlInput, setUrlInput] = useState("")
  const [urlImporting, setUrlImporting] = useState(false)

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

  // Count triggers per layer name (DML triggers use conditions.table)
  const triggerCountByLayer = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of triggers) {
      if (!t.enabled) continue
      const table = (t.conditions as Record<string, unknown>)?.table as string | undefined
      if (table) counts.set(table, (counts.get(table) ?? 0) + 1)
    }
    return counts
  }, [triggers])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Build flat list of all layer keys from the active view's layerStack (already ordered)
  const allLayerKeys = useMemo(() => {
    return layerStack.map((l) => l.key)
  }, [layerStack])

  // Build a lookup for layer visibility from layerStack
  const layerVisibility = useMemo(() => {
    const vis: Record<string, { visible?: boolean; opacity?: number; color?: string; displayName?: string; strokeColor?: string; strokeWidth?: number }> = {}
    for (const l of layerStack) {
      vis[l.key] = { visible: l.visible, opacity: l.opacity, color: l.color, displayName: l.displayName, strokeColor: l.strokeColor, strokeWidth: l.strokeWidth }
    }
    return vis
  }, [layerStack])

  // Compute grouped and ungrouped layer keys
  const groupedLayerKeys = useMemo(() => {
    const set = new Set<string>()
    for (const group of Object.values(layerGroups)) {
      for (const k of group.layers) set.add(k)
    }
    return set
  }, [layerGroups])

  // Build a lookup for layer metadata by key
  const layersByKey = useMemo(() => {
    const map = new Map<string, { ds: typeof datasets[0]; layer: NonNullable<typeof datasets[0]["layers"]>[0] }>()
    for (const ds of datasets) {
      for (const layer of ds.layers ?? []) {
        map.set(layerKey(ds.id, layer.name), { ds, layer })
      }
    }
    return map
  }, [datasets])

  // Filter by search query
  const filterKey = useCallback(
    (key: string) => {
      if (!searchQuery) return true
      const entry = layersByKey.get(key)
      if (!entry) return false
      const q = searchQuery.toLowerCase()
      return entry.layer.name.toLowerCase().includes(q) || entry.ds.name?.toLowerCase().includes(q)
    },
    [searchQuery, layersByKey],
  )

  const handleCreateGroup = useCallback(() => {
    const groupCount = Object.keys(layerGroups).length
    // If layers are selected, create group with them; otherwise empty group
    const keys = selectedLayers.size > 0 ? [...selectedLayers] : []
    createLayerGroup(`Group ${groupCount + 1}`, keys)
    if (keys.length > 0) clearLayerSelection()
  }, [layerGroups, createLayerGroup, selectedLayers, clearLayerSelection])

  // Handle dropping a layer onto a group
  const addLayerToGroupFn = useMapViewStore((s) => s.addLayerToGroup)
  const removeLayerFromGroupFn = useMapViewStore((s) => s.removeLayerFromGroup)

  const handleDropLayerOnGroup = useCallback((groupId: string, lk: string) => {
    // Remove from any existing group first
    for (const [gid, group] of Object.entries(layerGroups)) {
      if (group.layers.includes(lk)) {
        removeLayerFromGroupFn(gid, lk)
      }
    }
    addLayerToGroupFn(groupId, lk)
  }, [layerGroups, addLayerToGroupFn, removeLayerFromGroupFn])

  // Multi-selection handler: Shift = range, Ctrl/Meta = toggle, plain = single
  const handleLayerClick = useCallback(
    (key: string, e: React.MouseEvent) => {
      const entry = layersByKey.get(key)
      if (!entry) return

      if (e.shiftKey && lastSelectedLayerKey && lastSelectedLayerKey !== key) {
        // Range selection from lastSelectedLayerKey to key using allLayerKeys order
        const a = allLayerKeys.indexOf(lastSelectedLayerKey)
        const b = allLayerKeys.indexOf(key)
        if (a !== -1 && b !== -1) {
          const [from, to] = a < b ? [a, b] : [b, a]
          const range = allLayerKeys.slice(from, to + 1)
          setSelectedLayers(range)
          return
        }
      }

      if (e.ctrlKey || e.metaKey) {
        toggleLayerInSelection(key)
        setLastSelectedLayerKey(key)
        return
      }

      // Plain click: single selection, update inspector
      clearLayerSelection()
      setSelectedLayers([key])
      setLastSelectedLayerKey(key)
      selectLayer(entry.ds.id, entry.layer.name)
      setContextSelection({ type: "layer", datasetId: entry.ds.id, layerName: entry.layer.name })
    },
    [allLayerKeys, layersByKey, lastSelectedLayerKey, setSelectedLayers, toggleLayerInSelection, clearLayerSelection, setLastSelectedLayerKey, selectLayer, setContextSelection],
  )

  // Keyboard navigation state
  const [focusedLayerKey, setFocusedLayerKey] = useState<string | null>(null)

  const navigableKeys = useMemo(
    () => allLayerKeys.filter(filterKey),
    [allLayerKeys, filterKey],
  )

  const handleTreeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (navigableKeys.length === 0) return
      const currentIdx = focusedLayerKey ? navigableKeys.indexOf(focusedLayerKey) : -1

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault()
          const next = currentIdx < navigableKeys.length - 1 ? currentIdx + 1 : 0
          setFocusedLayerKey(navigableKeys[next])
          break
        }
        case "ArrowUp": {
          e.preventDefault()
          const prev = currentIdx > 0 ? currentIdx - 1 : navigableKeys.length - 1
          setFocusedLayerKey(navigableKeys[prev])
          break
        }
        case "Enter": {
          if (!focusedLayerKey) break
          e.preventDefault()
          const entry = layersByKey.get(focusedLayerKey)
          if (!entry) break
          clearLayerSelection()
          setSelectedLayers([focusedLayerKey])
          setLastSelectedLayerKey(focusedLayerKey)
          selectLayer(entry.ds.id, entry.layer.name)
          setContextSelection({ type: "layer", datasetId: entry.ds.id, layerName: entry.layer.name })
          break
        }
        case " ": {
          if (!focusedLayerKey) break
          e.preventDefault()
          const focusedLayer = layerStack.find((l) => l.key === focusedLayerKey)
          setLayerVisible(focusedLayerKey, !(focusedLayer?.visible ?? true))
          break
        }
        case "Escape": {
          e.preventDefault()
          clearLayerSelection()
          setFocusedLayerKey(null)
          break
        }
      }
    },
    [navigableKeys, focusedLayerKey, layersByKey, layerVisibility, clearLayerSelection, setSelectedLayers, setLastSelectedLayerKey, selectLayer, setContextSelection, setLayerVisible],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        const oldIndex = allLayerKeys.indexOf(String(active.id))
        const newIndex = allLayerKeys.indexOf(String(over.id))
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderLayers(arrayMove(allLayerKeys, oldIndex, newIndex))
        }
      }
    },
    [allLayerKeys, reorderLayers],
  )

  const doImport = useCallback(
    async (file: File, force = false) => {
      setLoading(true)
      try {
        const ds = await uploadDataset(file, force)
        addDataset(ds)
        // Apply GPKG styles if present
        if (ds.styles && ds.styles.length > 0) {
          applyImportedStyles(ds.id, ds.styles, ds.style_defs as any)
        } else {
          // Auto-add all layers to the active map view
          for (const l of ds.layers ?? []) {
            addLayer(layerKey(ds.id, l.name))
          }
        }
      } catch (err) {
        if (err instanceof DuplicateDatasetError) {
          toast.info(`"${err.existingName}" already imported`, {
            action: {
              label: "Import anyway",
              onClick: () => doImport(file, true),
            },
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

  // Handle drop from datasets section (drag & drop to add layers to map)
  const handleLayerDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOverLayers(false)
      const data = e.dataTransfer.getData("application/gispulse-layer")
      if (!data) return
      try {
        const { datasetId, layerName: lName } = JSON.parse(data)
        addLayer(layerKey(datasetId, lName))
        toast.success(`Layer "${lName}" added to map`)
      } catch {}
    },
    [addLayer],
  )

  // Build layers grouped by dataset for tree view
  const datasetLayerKeys = useMemo(() => {
    const result = new Map<string, string[]>()
    for (const ds of datasets) {
      const keys: string[] = []
      for (const layer of ds.layers ?? []) {
        const k = layerKey(ds.id, layer.name)
        if (filterKey(k)) keys.push(k)
      }
      if (keys.length > 0 || !searchQuery) result.set(ds.id, keys)
    }
    return result
  }, [datasets, filterKey, searchQuery])

  // Export all visible layers from active view
  const handleExportAll = useCallback(async () => {
    const layers: { datasetId: string; layerName: string; color?: string; opacity?: number; styleDef?: Record<string, unknown>; geomType?: string }[] = []
    for (const l of layerStack) {
      if (!l.visible) continue
      const { datasetId, layerName: lName } = parseLayerKey(l.key)
      const ds = datasets.find((d) => d.id === datasetId)
      const meta = ds?.layers?.find((m) => m.name === lName)
      layers.push({
        datasetId, layerName: lName, color: l.color, opacity: l.opacity,
        styleDef: l.styleDef as Record<string, unknown> | undefined,
        geomType: meta?.geometry_type ?? undefined,
      })
    }
    if (layers.length === 0) {
      toast.error("No visible layers to export")
      return
    }
    try {
      await exportGpkg(layers, "gispulse-export.gpkg")
      toast.success("Export started")
    } catch (err) {
      toast.error("Export failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [layerStack])

  // If style editor is open, show it instead of the layer list
  if (styleEditorKey) {
    return (
      <StyleEditorPanel
        layerKey={styleEditorKey}
        onClose={() => setStyleEditorKey(null)}
      />
    )
  }

  return (
    <>
      <SectionHeader
        title="Map Layers"
        count={layerStack.length}
        extraActions={
          <>
            {(() => {
              const allVisible = layerStack.every((l) => l.visible)
              return (
                <button
                  onClick={allVisible ? hideAllLayers : showAllLayers}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title={allVisible ? "Hide all layers" : "Show all layers"}
                >
                  {allVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              )
            })()}
            <button
              onClick={handleExportAll}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Export visible layers as GPKG"
            >
              <Download size={12} />
            </button>
            <button
              onClick={handleCreateGroup}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="New layer group"
            >
              <FolderPlus size={12} />
            </button>
          </>
        }
      />
      {selectedLayers.size > 1 && (
        <BulkActionsBar
          selectedKeys={selectedLayers}
          layerVisibility={layerVisibility}
          setLayerVisible={setLayerVisible}
          bulkRemoveLayerEntries={(keys: string[]) => removeLayers(keys)}
          bulkRestoreLayerEntries={() => {/* no-op: layers are removed, not hidden */}}
          createLayerGroup={createLayerGroup}
          clearLayerSelection={clearLayerSelection}
        />
      )}
      <ScrollArea className="flex-1">
        {/* Drop zone for layers from datasets + file import */}
        <div
          onDrop={(e) => {
            // Check if it's a layer drag or a file drag
            if (e.dataTransfer.getData("application/gispulse-layer")) {
              handleLayerDrop(e)
            } else {
              handleFileDrop(e)
            }
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOverLayers(true) }}
          onDragLeave={() => setDragOverLayers(false)}
          onClick={() => fileRef.current?.click()}
          className={`mx-3 mt-3 mb-2 flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed p-3 text-xs text-muted-foreground transition-colors ${
            dragOverLayers
              ? "border-primary bg-primary/5 text-primary"
              : "border-muted-foreground/25 hover:border-primary/50 hover:text-primary"
          }`}
        >
          {dragOverLayers ? "Drop to add layer to map" : "Drop file or drag layer here"}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".gpkg,.geojson,.json,.shp,.fgb,.csv,.parquet"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* URL import (#83) */}
        <div className="mx-3 mb-2">
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
                {urlImporting ? "…" : "Import"}
              </button>
            )}
          </div>
          {urlValidation === "invalid" && urlInput && (
            <p className="mt-0.5 text-label text-destructive/70 px-1">
              Must be http(s) URL ending in .gpkg, .geojson, .shp, etc.
            </p>
          )}
        </div>

        {/* Layer search/filter */}
        {allLayerKeys.length > 3 && (
          <div className="mx-3 mb-2">
            <div className="flex items-center gap-1.5 rounded-md border px-2 py-1">
              <Search size={12} className="text-muted-foreground/60 shrink-0" />
              <input
                type="text"
                placeholder="Filter layers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-muted-foreground/60 hover:text-foreground">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Keyboard-navigable layer tree container */}
        <div
          tabIndex={0}
          role="listbox"
          aria-label="Layer tree"
          onKeyDown={handleTreeKeyDown}
          onBlur={() => setFocusedLayerKey(null)}
          className="outline-none"
        >

        {/* Layer groups (shown first) */}
        {Object.keys(layerGroups).length > 0 && (
          <div className="px-2 mb-1">
            {Object.entries(layerGroups).map(([groupId, group]) => {
              const filteredGroupLayers = group.layers.filter(filterKey)
              if (searchQuery && filteredGroupLayers.length === 0) return null
              return (
                <LayerGroupItem key={groupId} groupId={groupId} group={group} onDropLayer={handleDropLayerOnGroup}>
                  {(searchQuery ? filteredGroupLayers : group.layers).map((key) => {
                    const entry = layersByKey.get(key)
                    if (!entry) return null
                    return (
                      <LayerItemButton
                        key={key}
                        layerKey={key}
                        entry={entry}
                        layerVisibility={layerVisibility}
                        selectedDatasetId={selectedDatasetId}
                        selectedLayerName={selectedLayerName}
                        selectLayer={selectLayer}
                        setContextSelection={setContextSelection}
                        setLayerVisible={setLayerVisible}
                        setLayerColor={setLayerColor}
                        setLayerOpacity={setLayerOpacity}
                        layerGroups={layerGroups}
                        triggerCount={triggerCountByLayer.get(entry.layer.name) ?? 0}
                        isMultiSelected={selectedLayers.has(key)}
                        isFocused={focusedLayerKey === key}
                        onSelectWithModifiers={handleLayerClick}
                        onOpenStyleEditor={setStyleEditorKey}
                      />
                    )
                  })}
                </LayerGroupItem>
              )
            })}
          </div>
        )}

        {/* Dataset tree with sortable layers */}
        {datasets.length > 0 && (
          <div className="px-2 mb-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={allLayerKeys} strategy={verticalListSortingStrategy}>
                {(() => {
                  const sessionDatasets = datasets.filter((ds) => ds.source_type === "session")
                  const projectDatasets = datasets.filter((ds) => !ds.source_type || ds.source_type === "project")
                  const showSubHeaders = sessionDatasets.length > 0 && projectDatasets.length > 0

                  const renderDatasetList = (list: typeof datasets) =>
                    list.map((ds) => {
                      const dsKeys = datasetLayerKeys.get(ds.id)
                      if (!dsKeys || (searchQuery && dsKeys.length === 0)) return null
                      const ungroupedDsKeys = dsKeys.filter((k) => !groupedLayerKeys.has(k))
                      if (ungroupedDsKeys.length === 0 && !searchQuery) return null
                      return (
                        <DatasetItem key={ds.id} dataset={ds}>
                          {ungroupedDsKeys.map((key) => {
                            const entry = layersByKey.get(key)
                            if (!entry) return null
                            return (
                              <SortableLayerItem key={key} id={key}>
                                <LayerItemButton
                                  layerKey={key}
                                  entry={entry}
                                  layerVisibility={layerVisibility}
                                  selectedDatasetId={selectedDatasetId}
                                  selectedLayerName={selectedLayerName}
                                  selectLayer={selectLayer}
                                  setContextSelection={setContextSelection}
                                  setLayerVisible={setLayerVisible}
                                  setLayerColor={setLayerColor}
                                  setLayerOpacity={setLayerOpacity}
                                  layerGroups={layerGroups}
                                  triggerCount={triggerCountByLayer.get(entry.layer.name) ?? 0}
                                  isMultiSelected={selectedLayers.has(key)}
                                  isFocused={focusedLayerKey === key}
                                  onSelectWithModifiers={handleLayerClick}
                                  onOpenStyleEditor={setStyleEditorKey}
                                />
                              </SortableLayerItem>
                            )
                          })}
                        </DatasetItem>
                      )
                    })

                  return (
                    <div className="space-y-0.5">
                      {showSubHeaders && sessionDatasets.length > 0 && (
                        <div className="flex items-center gap-1.5 px-1 pt-1 pb-0.5">
                          <span className="text-label-sm font-semibold uppercase tracking-wider text-orange-500/80">Session</span>
                          <div className="flex-1 h-px bg-orange-500/20" />
                        </div>
                      )}
                      {renderDatasetList(sessionDatasets)}
                      {showSubHeaders && projectDatasets.length > 0 && (
                        <div className="flex items-center gap-1.5 px-1 pt-1.5 pb-0.5">
                          <span className="text-label-sm font-semibold uppercase tracking-wider text-muted-foreground/70">Project</span>
                          <div className="flex-1 h-px bg-border/60" />
                        </div>
                      )}
                      {renderDatasetList(projectDatasets)}
                    </div>
                  )
                })()}
              </SortableContext>
            </DndContext>
          </div>
        )}

        </div>{/* end keyboard-navigable container */}

        {/* External flux layers (WMS/WMTS/TMS from catalog) */}
        <ExternalLayersSection />

        {layerStack.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            Drag layers from the Datasets panel or import a file
          </p>
        )}
      </ScrollArea>
    </>
  )
}

// ---------- Extracted sections (see panels/) ----------

// ---------- Main LeftPanel ----------

import {
  DatasetsSection,
  RulesSection,
  TriggersSection,
  CatalogSection,
  SearchSection,
  NodePaletteSection,
} from "@/components/panels"

const SECTION_COMPONENTS: Record<ActivitySection, React.FC> = {
  layers: LayersSection,
  datasets: DatasetsSection,
  rules: RulesSection,
  triggers: TriggersSection,
  catalog: CatalogSection,
  search: SearchSection,
  scenes: SceneManager,
}

export function LeftPanel() {
  const { activeSection, leftPanelOpen, workspaceId } = useUIStore()
  const activeProject = useActiveProject()
  const setActiveProject = useProjectStore((s) => s.setActiveProject)

  if (!leftPanelOpen) return null

  // In Workflows view, show the NodePalette instead of the regular section
  const showNodePalette = workspaceId === "workflows" && activeSection === "layers"
  const Section = showNodePalette ? NodePaletteSection : SECTION_COMPONENTS[activeSection]

  return (
    <div className="flex h-full flex-col bg-background border-r">
      {/* Project header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <IconButton
          label="Back to projects"
          onClick={() => setActiveProject(null)}
        >
          <ArrowLeft size={14} />
        </IconButton>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-label leading-none">
            <span className="text-muted-foreground/60 shrink-0">Workspace</span>
            <ChevronRight size={9} className="text-muted-foreground/40 shrink-0" />
            <span className="font-semibold text-foreground truncate">{activeProject?.name ?? "Project"}</span>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 text-label-sm">
          {activeProject?.engine_backend ?? "duckdb"}
        </Badge>
      </div>

      {/* Active section content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Section />
      </div>
    </div>
  )
}
