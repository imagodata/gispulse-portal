/**
 * ExploreTab — Feature exploration and inspection.
 *
 * Browse features from the selected layer, search by attribute,
 * zoom to feature, inspect properties.
 */

import { useCallback, useEffect, useState } from "react"
import { useDatasetStore } from "@/stores/datasetStore"
import { useFilterStore } from "@/stores/filterStore"
import { useMapStore } from "@/stores/mapStore"
import { getFeatures } from "@/api/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  SearchIcon,
  ZoomInIcon,
  Loader2Icon,
  LayersIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FeatureRow {
  fid: number
  properties: Record<string, unknown>
  bbox?: [number, number, number, number]
}

export function ExploreTab() {
  const datasets = useDatasetStore((s) => s.datasets)
  const targetDatasetId = useFilterStore((s) => s.targetDatasetId)
  const targetLayerName = useFilterStore((s) => s.targetLayerName)
  const setTarget = useFilterStore((s) => s.setTarget)
  const zoomToExtent = useMapStore((s) => s.zoomToExtent)

  const [features, setFeatures] = useState<FeatureRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedFid, setSelectedFid] = useState<number | null>(null)
  const [total, setTotal] = useState(0)

  // Find current layer meta
  const currentDataset = datasets.find((d) => d.id === targetDatasetId)
  const currentLayer = currentDataset?.layers?.find((l) => l.name === targetLayerName)

  // Fetch features when layer changes
  useEffect(() => {
    if (!targetDatasetId || !targetLayerName) {
      setFeatures([])
      setTotal(0)
      return
    }

    let cancelled = false
    setLoading(true)

    getFeatures(targetDatasetId, targetLayerName, { limit: 100 })
      .then((fc) => {
        if (cancelled) return
        const rows: FeatureRow[] = (fc.features ?? []).map((f: Record<string, unknown>, i: number) => ({
          fid: (f.id as number) ?? i,
          properties: (f.properties as Record<string, unknown>) ?? {},
          bbox: Array.isArray(f.bbox) ? (f.bbox as [number, number, number, number]) : undefined,
        }))
        setFeatures(rows)
        setTotal(fc.total_count ?? rows.length)
        setSelectedFid(null)
      })
      .catch(() => {
        if (!cancelled) setFeatures([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [targetDatasetId, targetLayerName])

  // Filter features by search
  const filtered = search
    ? features.filter((f) =>
        Object.values(f.properties).some((v) =>
          String(v).toLowerCase().includes(search.toLowerCase()),
        ),
      )
    : features

  const selectedFeature = features.find((f) => f.fid === selectedFid)

  const handleZoom = useCallback(
    (feat: FeatureRow) => {
      if (feat.bbox) {
        zoomToExtent(feat.bbox)
      }
    },
    [zoomToExtent],
  )

  // Layer selector
  const layerOptions = datasets.flatMap((ds) =>
    (ds.layers ?? [])
      .filter((l) => l.geometry_type)
      .map((l) => ({
        key: `${ds.id}::${l.name}`,
        dsId: ds.id,
        dsName: ds.name,
        layerName: l.name,
        count: l.feature_count,
      })),
  )

  const currentKey = targetDatasetId && targetLayerName ? `${targetDatasetId}::${targetLayerName}` : ""

  return (
    <div className="space-y-3">
      {/* Layer picker */}
      <div className="space-y-1">
        <label htmlFor="explore-layer" className="text-xs font-medium text-muted-foreground">Layer</label>
        <select
          id="explore-layer"
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={currentKey}
          onChange={(e) => {
            const opt = layerOptions.find((o) => o.key === e.target.value)
            if (opt) setTarget(opt.dsId, opt.layerName)
          }}
        >
          <option value="">-- Select layer --</option>
          {layerOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.dsName} / {opt.layerName} ({opt.count})
            </option>
          ))}
        </select>
      </div>

      {/* Layer info */}
      {currentLayer && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LayersIcon className="size-3.5" />
          <span>{currentLayer.geometry_type}</span>
          <Badge variant="outline" className="text-label">{currentLayer.crs}</Badge>
          <span className="ml-auto">{total} features</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search attributes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-7 text-xs"
        />
      </div>

      {/* Feature list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-1">
            {filtered.map((f) => (
              <button
                key={f.fid}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors",
                  selectedFid === f.fid
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted",
                )}
                onClick={() => setSelectedFid(f.fid)}
              >
                <span className="truncate">
                  #{f.fid} — {Object.values(f.properties).slice(0, 2).join(", ").slice(0, 40)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleZoom(f)
                  }}
                  className="shrink-0"
                >
                  <ZoomInIcon className="size-3" />
                </Button>
              </button>
            ))}
            {filtered.length === 0 && !loading && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {features.length === 0 ? "Select a layer to explore" : "No matching features"}
              </p>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Selected feature properties */}
      {selectedFeature && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Properties</label>
          <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/50 p-2">
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(selectedFeature.properties).map(([k, v]) => (
                  <tr key={k} className="border-b border-border/50 last:border-0">
                    <td className="py-0.5 pr-2 font-medium text-muted-foreground">{k}</td>
                    <td className="py-0.5 font-mono">{String(v ?? "null")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
