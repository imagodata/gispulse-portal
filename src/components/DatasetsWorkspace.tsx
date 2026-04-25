/**
 * DatasetsWorkspace — Dataset inspection & data preview workspace
 *
 * Three-column layout:
 * - Left: dataset list with search
 * - Center: data table preview for selected layer
 * - Right: schema / field details panel
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import {
  HardDrive,
  Search,
  Table2,
  ChevronRight,
  RefreshCw,
  Download,
  ArrowUpDown,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  MapPin,
  Map as MapIcon,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useActiveProject } from "@/stores/projectStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { useMapViewStore, layerKey } from "@/stores/mapViewStore"
import { getFeatures, exportGpkg, deleteDatasetApi, renameDatasetApi } from "@/api/client"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { DatasetContextMenu } from "@/components/DatasetContextMenu"
import { RenameDialog } from "@/components/RenameDialog"
import type { DatasetMeta, LayerMeta, LayerField } from "@/types/dataset"

// ---------------------------------------------------------------------------
// Shared helpers (extracted to lib/geo-display.ts — audit M27)
// ---------------------------------------------------------------------------

import { formatBytes, formatNumber, FORMAT_COLORS } from "@/lib/geo-display"
import { GeomIcon } from "@/components/layers/GeomIcon"

function fieldIcon(type: string) {
  const t = type.toLowerCase()
  if (t.includes("int") || t.includes("float") || t.includes("numeric") || t.includes("double"))
    return <Hash size={11} className="text-blue-500" />
  if (t.includes("bool")) return <ToggleLeft size={11} className="text-amber-500" />
  if (t.includes("date") || t.includes("time")) return <Calendar size={11} className="text-violet-500" />
  if (t.includes("geom") || t.includes("point") || t.includes("polygon") || t.includes("line"))
    return <MapPin size={11} className="text-emerald-500" />
  return <Type size={11} className="text-muted-foreground" />
}

// DatasetContextMenu imported from @/components/DatasetContextMenu

// ---------------------------------------------------------------------------
// DatasetListItem
// ---------------------------------------------------------------------------

function DatasetListItem({
  dataset,
  selectedLayerName,
  isSelected,
  onSelectLayer,
  onContextMenu,
}: {
  dataset: DatasetMeta
  selectedLayerName: string | null
  isSelected: boolean
  onSelectLayer: (ds: DatasetMeta, layer: LayerMeta) => void
  onContextMenu: (e: React.MouseEvent, ds: DatasetMeta) => void
}) {
  const [expanded, setExpanded] = useState(isSelected)

  useEffect(() => {
    if (isSelected) setExpanded(true)
  }, [isSelected])

  return (
    <div
      className={`border-b last:border-b-0 ${isSelected ? "bg-accent/30" : ""}`}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, dataset) }}
    >
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronRight
          size={12}
          className={`shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <HardDrive size={13} className="shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-xs font-medium">{dataset.name}</span>
        <Badge
          className={`text-label-sm px-1.5 h-4 ${FORMAT_COLORS[dataset.format.toLowerCase()] ?? "bg-muted text-muted-foreground"}`}
        >
          {dataset.format.toUpperCase()}
        </Badge>
        <span className="text-label text-muted-foreground tabular-nums shrink-0">
          {dataset.layers.length}L
        </span>
      </button>

      {expanded && (
        <div className="pb-1">
          {dataset.layers.map((layer) => {
            const isLayerSel =
              isSelected && selectedLayerName === layer.name
            return (
              <button
                key={layer.name}
                className={`flex w-full items-center gap-2 pl-8 pr-3 py-1.5 text-left text-label-lg transition-colors ${
                  isLayerSel
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
                onClick={() => onSelectLayer(dataset, layer)}
              >
                <GeomIcon type={layer.geometry_type} />
                <span className="flex-1 truncate font-mono text-label">
                  {layer.name}
                </span>
                <span className="text-label tabular-nums shrink-0">
                  {formatNumber(layer.feature_count)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

function DataTable({
  features,
  fields,
  loading,
  selectedRows,
  onToggleRow,
  hasGeometry,
}: {
  features: Record<string, unknown>[]
  fields: LayerField[]
  loading: boolean
  selectedRows: Set<number>
  onToggleRow: (index: number) => void
  hasGeometry: boolean
}) {
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc((v) => !v)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const columns = fields.filter(
    (f) =>
      !f.type.toLowerCase().includes("geom") &&
      !f.type.toLowerCase().includes("polygon") &&
      !f.type.toLowerCase().includes("point") &&
      !f.type.toLowerCase().includes("line"),
  )

  // Build index-tracked sorted array
  const indexed = features.map((row, i) => ({ row, origIndex: i }))
  if (sortField) {
    indexed.sort((a, b) => {
      const va = a.row[sortField]
      const vb = b.row[sortField]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === "number" && typeof vb === "number")
        return sortAsc ? va - vb : vb - va
      return sortAsc
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va))
    })
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw size={16} className="animate-spin text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">Loading data...</span>
      </div>
    )
  }

  if (features.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <Table2 size={28} className="mb-3 text-muted-foreground/20" />
        <p className="text-xs text-muted-foreground">Select a layer to preview data</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-label-lg">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="border-b">
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-10">#</th>
            {columns.map((f) => (
              <th key={f.name} className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => handleSort(f.name)}
                >
                  {fieldIcon(f.type)}
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  {sortField === f.name && (
                    <ArrowUpDown size={10} className="shrink-0 text-primary" />
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {indexed.map(({ row, origIndex }, displayIdx) => {
            const isSelected = selectedRows.has(origIndex)
            return (
              <tr
                key={origIndex}
                className={`border-b border-border/30 transition-colors ${
                  isSelected
                    ? "bg-primary/15 hover:bg-primary/20"
                    : "hover:bg-accent/30"
                } ${hasGeometry ? "cursor-pointer" : ""}`}
                onClick={() => hasGeometry && onToggleRow(origIndex)}
              >
                <td className="px-2 py-1 text-muted-foreground tabular-nums">{displayIdx + 1}</td>
                {columns.map((f) => (
                  <td key={f.name} className="px-2 py-1 truncate max-w-[200px] font-mono">
                    {row[f.name] == null ? (
                      <span className="text-muted-foreground/40">null</span>
                    ) : (
                      String(row[f.name])
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SchemaPanel
// ---------------------------------------------------------------------------

function SchemaPanel({
  dataset,
  layer,
}: {
  dataset: DatasetMeta | null
  layer: LayerMeta | null
}) {
  if (!dataset || !layer) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">Select a layer</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-3 py-2">
        <h3 className="text-xs font-semibold truncate">{layer.name}</h3>
        <div className="flex items-center gap-2 mt-1 text-label text-muted-foreground">
          <span className="flex items-center gap-1">
            <GeomIcon type={layer.geometry_type} />
            {layer.geometry_type ?? "none"}
          </span>
          <span>{formatNumber(layer.feature_count)} features</span>
        </div>
      </div>

      {/* Dataset info */}
      <div className="border-b px-3 py-2 space-y-1">
        <div className="text-label text-muted-foreground uppercase tracking-wider font-semibold">
          Dataset
        </div>
        <div className="text-xs">{dataset.name}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-label text-muted-foreground">
          <span>{dataset.format.toUpperCase()}</span>
          {dataset.file_size > 0 && <span>{formatBytes(dataset.file_size)}</span>}
          <span>{dataset.crs}</span>
        </div>
      </div>

      {/* CRS & bbox */}
      {layer.crs && (
        <div className="border-b px-3 py-2">
          <div className="text-label text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            CRS
          </div>
          <code className="text-label font-mono bg-muted px-1.5 py-0.5 rounded">
            {layer.crs}
          </code>
        </div>
      )}

      {layer.bbox && layer.bbox.every((v) => Number.isFinite(v)) && !(layer.bbox[0] === 0 && layer.bbox[1] === 0 && layer.bbox[2] === 0 && layer.bbox[3] === 0) && (
        <div className="border-b px-3 py-2">
          <div className="text-label text-muted-foreground uppercase tracking-wider font-semibold mb-1">
            Extent
          </div>
          <div className="grid grid-cols-2 gap-1 text-label font-mono">
            <span>xmin: {layer.bbox[0].toFixed(4)}</span>
            <span>ymin: {layer.bbox[1].toFixed(4)}</span>
            <span>xmax: {layer.bbox[2].toFixed(4)}</span>
            <span>ymax: {layer.bbox[3].toFixed(4)}</span>
          </div>
        </div>
      )}

      {/* Fields */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-2">
          <div className="text-label text-muted-foreground uppercase tracking-wider font-semibold">
            Fields ({layer.fields.length})
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-3 pb-2 space-y-0.5">
            {layer.fields.map((f) => (
              <div
                key={f.name}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/40 transition-colors"
              >
                {fieldIcon(f.type)}
                <span className="flex-1 truncate text-xs font-mono">{f.name}</span>
                <Badge variant="secondary" className="text-label-sm h-4 px-1.5 font-mono">
                  {f.type}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MiniMap — inline map preview showing selected features
// ---------------------------------------------------------------------------

function layerHasGeometry(layer: LayerMeta | null): boolean {
  if (!layer?.geometry_type) return false
  const t = layer.geometry_type.toLowerCase()
  return t.includes("point") || t.includes("polygon") || t.includes("line") || t.includes("multi")
}

function MiniMap({
  rawFeatures,
  selectedRows,
  onClose,
}: {
  rawFeatures: Record<string, unknown>[]
  selectedRows: Set<number>
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  // Build the GeoJSON for selected features
  const selectedGeoJSON = useMemo(() => {
    const selected = Array.from(selectedRows)
      .map((i) => rawFeatures[i])
      .filter((f) => f?.geometry)
    return {
      type: "FeatureCollection" as const,
      features: selected,
    }
  }, [rawFeatures, selectedRows])

  // Build GeoJSON for all features (shown dimmed)
  const allGeoJSON = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: rawFeatures.filter((f) => f?.geometry),
    }
  }, [rawFeatures])

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
            tileSize: 256,
            attribution: "&copy; CartoDB",
          },
        },
        layers: [{ id: "basemap", type: "raster", source: "basemap" }],
      },
      center: [2.35, 46.85],
      zoom: 4,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    mapRef.current = map

    map.on("load", () => {
      // All features (dimmed background)
      map.addSource("all-features", { type: "geojson", data: allGeoJSON as never })
      map.addLayer({ id: "all-fill", type: "fill", source: "all-features", paint: { "fill-color": "#6366f1", "fill-opacity": 0.08 } })
      map.addLayer({ id: "all-line", type: "line", source: "all-features", paint: { "line-color": "#6366f1", "line-opacity": 0.2, "line-width": 1 } })
      map.addLayer({ id: "all-circle", type: "circle", source: "all-features", paint: { "circle-color": "#6366f1", "circle-opacity": 0.15, "circle-radius": 3 } })

      // Selected features (highlighted)
      map.addSource("selected-features", { type: "geojson", data: selectedGeoJSON as never })
      map.addLayer({ id: "sel-fill", type: "fill", source: "selected-features", paint: { "fill-color": "#f59e0b", "fill-opacity": 0.55 } })
      map.addLayer({ id: "sel-line", type: "line", source: "selected-features", paint: { "line-color": "#f59e0b", "line-opacity": 1, "line-width": 2.5 } })
      map.addLayer({ id: "sel-circle", type: "circle", source: "selected-features", paint: { "circle-color": "#f59e0b", "circle-opacity": 0.9, "circle-radius": 5, "circle-stroke-color": "#fff", "circle-stroke-width": 1 } })

      // Fit to selected features if any, otherwise all
      if (selectedGeoJSON.features.length > 0) {
        fitToFeatures(map, selectedGeoJSON.features)
      } else {
        fitToFeatures(map, allGeoJSON.features)
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update selected features data
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // If style not loaded yet, wait for the load event (handled above)
    if (!map.isStyleLoaded()) return
    const src = map.getSource("selected-features") as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(selectedGeoJSON as never)

    // Fit to selected if any, otherwise all
    if (selectedRows.size > 0) {
      fitToFeatures(map, selectedGeoJSON.features)
    } else {
      fitToFeatures(map, allGeoJSON.features)
    }
  }, [selectedGeoJSON, selectedRows.size, allGeoJSON])

  // Update all features data when rawFeatures change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const src = map.getSource("all-features") as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(allGeoJSON as never)
  }, [allGeoJSON])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1 border text-label">
        <MapIcon size={11} className="text-amber-500" />
        <span className="text-muted-foreground">
          {selectedRows.size} selected
        </span>
        <button
          onClick={onClose}
          className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Close map"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  )
}

/** Fit map bounds to a set of GeoJSON features */
function fitToFeatures(map: maplibregl.Map, features: Record<string, unknown>[]) {
  if (features.length === 0) return
  const bounds = new maplibregl.LngLatBounds()
  let hasCoords = false
  for (const f of features) {
    const geom = f.geometry as { type: string; coordinates: unknown } | undefined
    if (!geom?.coordinates) continue
    visitCoords(geom.coordinates, (lng, lat) => {
      bounds.extend([lng, lat])
      hasCoords = true
    })
  }
  if (hasCoords) {
    map.fitBounds(bounds, { padding: 30, maxZoom: 14, duration: 500 })
  }
}

/** Recursively visit all coordinate pairs in a GeoJSON geometry */
function visitCoords(coords: unknown, fn: (lng: number, lat: number) => void) {
  if (!Array.isArray(coords)) return
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    fn(coords[0] as number, coords[1] as number)
  } else {
    for (const c of coords) visitCoords(c, fn)
  }
}

// ---------------------------------------------------------------------------
// DatasetsWorkspace
// ---------------------------------------------------------------------------

export function DatasetsWorkspace() {
  const project = useActiveProject()
  const datasets = useDatasetStore((s) => s.datasets)
  const { removeDataset, renameDataset: renameInStore } = useDatasetStore()

  const [search, setSearch] = useState("")
  const [selectedDs, setSelectedDs] = useState<DatasetMeta | null>(null)
  const [selectedLayer, setSelectedLayer] = useState<LayerMeta | null>(null)
  const [features, setFeatures] = useState<Record<string, unknown>[]>([])
  const [rawFeatures, setRawFeatures] = useState<Record<string, unknown>[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [mapOpen, setMapOpen] = useState(false)
  const [loadingFeatures, setLoadingFeatures] = useState(false)

  // Context menu / delete / rename state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; dataset: DatasetMeta } | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<DatasetMeta | null>(null)

  const hasGeom = layerHasGeometry(selectedLayer)

  const filteredDatasets = search.trim()
    ? datasets.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.format.toLowerCase().includes(search.toLowerCase()),
      )
    : datasets

  const handleSelectLayer = useCallback(
    async (ds: DatasetMeta, layer: LayerMeta) => {
      setSelectedDs(ds)
      setSelectedLayer(layer)
      setFeatures([])
      setRawFeatures([])
      setSelectedRows(new Set())
      setMapOpen(false)
      setLoadingFeatures(true)
      try {
        const fc = await getFeatures(ds.id, layer.name, { limit: 200 })
        const raw = fc.features ?? []
        setRawFeatures(raw)
        const rows = raw.map((f: { properties?: Record<string, unknown> }) => f.properties ?? {})
        setFeatures(rows)
      } catch (err) {
        console.error("Failed to load features:", err)
        toast.error("Failed to load features")
      } finally {
        setLoadingFeatures(false)
      }
    },
    [],
  )

  const handleToggleRow = useCallback((index: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    setMapOpen(true)
  }, [])

  const handleExport = useCallback(async () => {
    if (!selectedDs || !selectedLayer) return
    try {
      await exportGpkg(
        [{ datasetId: selectedDs.id, layerName: selectedLayer.name }],
        `${selectedDs.name}_${selectedLayer.name}.gpkg`,
      )
      toast.success("Export started")
    } catch (err) {
      toast.error("Export failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [selectedDs, selectedLayer])

  const handleContextMenu = useCallback((e: React.MouseEvent, ds: DatasetMeta) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, dataset: ds })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteDatasetApi(id)
      removeDataset(id)
      // Cleanup orphaned layer entries from map views
      const allDatasets = useDatasetStore.getState().datasets
      const validKeys = new Set<string>()
      for (const ds of allDatasets) {
        for (const l of ds.layers ?? []) validKeys.add(layerKey(ds.id, l.name))
      }
      useMapViewStore.getState().cleanupOrphanedLayers(validKeys)
      // Clear selection if deleted dataset was selected
      if (selectedDs?.id === id) {
        setSelectedDs(null)
        setSelectedLayer(null)
        setFeatures([])
        setRawFeatures([])
      }
      toast.success("Dataset deleted")
    } catch (err) {
      toast.error("Delete failed: " + (err instanceof Error ? err.message : String(err)))
    }
    setDeleteConfirmId(null)
  }, [removeDataset, selectedDs])

  const handleRename = useCallback(async (newName: string) => {
    if (!renameTarget || !newName || newName === renameTarget.name) {
      setRenameTarget(null)
      return
    }
    try {
      await renameDatasetApi(renameTarget.id, newName)
      renameInStore(renameTarget.id, newName)
      toast.success("Dataset renamed")
    } catch (err) {
      toast.error("Rename failed: " + (err instanceof Error ? err.message : String(err)))
    }
    setRenameTarget(null)
  }, [renameTarget, renameInStore])

  const handleExportDataset = useCallback(async (ds: DatasetMeta) => {
    const stack = useMapViewStore.getState().views.find((v) => v.id === useMapViewStore.getState().activeViewId)?.state.layerStack ?? []
    const layers = (ds.layers ?? []).map((l) => {
      const style = stack.find((s) => s.key === layerKey(ds.id, l.name))
      return { datasetId: ds.id, layerName: l.name, color: style?.color, opacity: style?.opacity }
    })
    try {
      await exportGpkg(layers, `${ds.name}.gpkg`)
      toast.success("Export started")
    } catch (err) {
      toast.error("Export failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [])

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No active project
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Dataset list */}
      <div className="w-(--width-sidebar) shrink-0 flex flex-col border-r bg-background">
        <div className="border-b px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={13} className="text-muted-foreground" />
            <span className="text-xs font-semibold">Datasets</span>
            <Badge variant="secondary" className="ml-auto text-label-sm h-4 px-1.5">
              {datasets.length}
            </Badge>
          </div>
          <div className="relative">
            <Search
              size={11}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter..."
              className="w-full rounded-md border border-input bg-background pl-6 pr-2 py-1 text-label-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {filteredDatasets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <HardDrive size={20} className="mb-2 text-muted-foreground/20" />
              <p className="text-label-lg text-muted-foreground">
                {search ? "No matches" : "No datasets"}
              </p>
            </div>
          ) : (
            filteredDatasets.map((ds) => (
              <DatasetListItem
                key={ds.id}
                dataset={ds}
                isSelected={selectedDs?.id === ds.id}
                selectedLayerName={selectedLayer?.name ?? null}
                onSelectLayer={handleSelectLayer}
                onContextMenu={handleContextMenu}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* Center: Data table + mini map */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Table toolbar */}
        <div className="flex items-center gap-2 border-b px-3 py-1.5 bg-background shrink-0">
          <Table2 size={13} className="text-muted-foreground" />
          {selectedLayer ? (
            <>
              <span className="text-xs font-medium truncate">
                {selectedLayer.name}
              </span>
              <span className="text-label text-muted-foreground">
                {formatNumber(selectedLayer.feature_count)} features
              </span>
              {features.length > 0 && features.length < selectedLayer.feature_count && (
                <Badge variant="secondary" className="text-label-sm h-4 px-1.5">
                  showing {features.length}
                </Badge>
              )}
              {selectedRows.size > 0 && (
                <Badge className="text-label-sm h-4 px-1.5 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  {selectedRows.size} selected
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-1">
                {hasGeom && selectedRows.size > 0 && (
                  <button
                    onClick={() => setMapOpen((v) => !v)}
                    className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                      mapOpen
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                    title="Toggle map preview"
                  >
                    <MapIcon size={12} />
                  </button>
                )}
                {selectedRows.size > 0 && (
                  <button
                    onClick={() => setSelectedRows(new Set())}
                    className="flex h-6 items-center gap-1 rounded px-1.5 text-label text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    title="Clear selection"
                  >
                    <X size={10} />
                    Clear
                  </button>
                )}
                <button
                  onClick={() => selectedDs && handleSelectLayer(selectedDs, selectedLayer)}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  onClick={handleExport}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  title="Export layer"
                >
                  <Download size={12} />
                </button>
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Data preview</span>
          )}
        </div>

        {/* Table + Map split */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Table content */}
          <div className={`${mapOpen && hasGeom && selectedRows.size > 0 ? "flex-1 min-h-0" : "flex-1 min-h-0"}`}>
            <DataTable
              features={features}
              fields={selectedLayer?.fields ?? []}
              loading={loadingFeatures}
              selectedRows={selectedRows}
              onToggleRow={handleToggleRow}
              hasGeometry={hasGeom}
            />
          </div>

          {/* Mini map panel */}
          {mapOpen && hasGeom && selectedRows.size > 0 && (
            <div className="h-64 shrink-0 border-t bg-background">
              <MiniMap
                rawFeatures={rawFeatures}
                selectedRows={selectedRows}
                onClose={() => setMapOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: Schema panel */}
      <div className="w-(--width-inspector) shrink-0 border-l bg-background overflow-hidden">
        <SchemaPanel dataset={selectedDs} layer={selectedLayer} />
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <DatasetContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onRename={() => setRenameTarget(ctxMenu.dataset)}
          onDelete={() => setDeleteConfirmId(ctxMenu.dataset.id)}
          onExport={() => handleExportDataset(ctxMenu.dataset)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete dataset?"
        description="This will permanently remove the dataset and its data. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {/* Rename dialog */}
      {renameTarget && (
        <RenameDialog
          initialName={renameTarget.name}
          onConfirm={(name) => handleRename(name)}
          onCancel={() => setRenameTarget(null)}
        />
      )}
    </div>
  )
}
