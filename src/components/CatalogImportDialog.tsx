/**
 * CatalogImportDialog — modal for importing catalog entries with optional bbox selection.
 *
 * Features:
 * - Interactive MapLibre mini-map with bbox draw (click+drag rectangle)
 * - CRS selector, max features, custom name
 * - Dispatches to POST /api/catalog/import
 */

import { useCallback, useEffect, useRef, useState } from "react"
import "maplibre-gl/dist/maplibre-gl.css"
import { Download, MapPin, X, Loader2, Square } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CatalogEntry, FluxEntry, OpenDataEntry } from "@/types/catalog"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CatalogImportDialogProps {
  entry: (CatalogEntry & { domain: string }) | null
  onClose: () => void
  onImported: (result: ImportResult) => void
}

interface ImportResult {
  id: string
  name: string
  type?: "external_layer"
  layers?: Array<Record<string, unknown>>
  [key: string]: unknown
}

type BBox = [number, number, number, number] // [west, south, east, north]

// ---------------------------------------------------------------------------
// BBox draw map
// ---------------------------------------------------------------------------

export type CatalogBBox = BBox

export function BBoxDrawMap({
  bbox,
  onBBoxChange,
  initialCenter,
}: {
  bbox: BBox | null
  onBBoxChange: (bbox: BBox | null) => void
  initialCenter?: [number, number]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const drawStateRef = useRef<{
    drawing: boolean
    startLngLat: [number, number] | null
  }>({ drawing: false, startLngLat: null })

  useEffect(() => {
    if (!containerRef.current) return
    let destroyed = false
    let map: any = null

    import("maplibre-gl").then((ml) => {
      if (destroyed || !containerRef.current) return

      map = new ml.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            "osm-tiles": {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "\u00a9 OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "osm-base",
              type: "raster",
              source: "osm-tiles",
            },
          ],
        },
        center: initialCenter ?? [2.3, 46.8],
        zoom: initialCenter ? 8 : 5,
        attributionControl: false,
      })

      mapRef.current = map

      map.on("load", () => {
        if (destroyed) return

        // Add bbox source + layers
        map.addSource("bbox-draw", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        })

        map.addLayer({
          id: "bbox-fill",
          type: "fill",
          source: "bbox-draw",
          paint: {
            "fill-color": "#3b82f6",
            "fill-opacity": 0.15,
          },
        })

        map.addLayer({
          id: "bbox-outline",
          type: "line",
          source: "bbox-draw",
          paint: {
            "line-color": "#3b82f6",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        })

        // If there's already a bbox, render it
        if (bbox) updateBBoxLayer(map, bbox)
      })

      // Mouse events for drawing rectangle
      map.on("mousedown", (e: any) => {
        if (e.originalEvent.button !== 0) return
        if (e.originalEvent.shiftKey || e.originalEvent.ctrlKey) return

        drawStateRef.current = {
          drawing: true,
          startLngLat: [e.lngLat.lng, e.lngLat.lat],
        }
        map.dragPan.disable()
        map.getCanvas().style.cursor = "crosshair"
      })

      map.on("mousemove", (e: any) => {
        const state = drawStateRef.current
        if (!state.drawing || !state.startLngLat) return

        const [startLng, startLat] = state.startLngLat
        const curLng = e.lngLat.lng
        const curLat = e.lngLat.lat

        const west = Math.min(startLng, curLng)
        const south = Math.min(startLat, curLat)
        const east = Math.max(startLng, curLng)
        const north = Math.max(startLat, curLat)

        updateBBoxLayer(map, [west, south, east, north])
      })

      map.on("mouseup", (e: any) => {
        const state = drawStateRef.current
        if (!state.drawing || !state.startLngLat) return

        const [startLng, startLat] = state.startLngLat
        const endLng = e.lngLat.lng
        const endLat = e.lngLat.lat

        const west = Math.min(startLng, endLng)
        const south = Math.min(startLat, endLat)
        const east = Math.max(startLng, endLng)
        const north = Math.max(startLat, endLat)

        // Only set bbox if the rectangle is non-trivial
        if (Math.abs(east - west) > 0.001 && Math.abs(north - south) > 0.001) {
          onBBoxChange([
            parseFloat(west.toFixed(6)),
            parseFloat(south.toFixed(6)),
            parseFloat(east.toFixed(6)),
            parseFloat(north.toFixed(6)),
          ])
        }

        drawStateRef.current = { drawing: false, startLngLat: null }
        map.dragPan.enable()
        map.getCanvas().style.cursor = ""
      })
    })

    return () => {
      destroyed = true
      if (map) {
        try { map.remove() } catch { /* ignore */ }
      }
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update bbox layer when bbox changes externally
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded?.()) return
    if (bbox) {
      updateBBoxLayer(map, bbox)
    } else {
      clearBBoxLayer(map)
    }
  }, [bbox])

  return (
    <div className="relative rounded-md overflow-hidden border bg-muted/30" style={{ height: 280 }}>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-2 left-2 z-10 pointer-events-none">
        <Badge variant="secondary" className="text-label-sm bg-background/80 backdrop-blur-sm pointer-events-auto">
          <Square size={10} className="mr-1" />
          Click & drag to draw bbox
        </Badge>
      </div>
    </div>
  )
}

function updateBBoxLayer(map: any, bbox: BBox) {
  const [w, s, e, n] = bbox
  const source = map.getSource("bbox-draw")
  if (!source) return
  source.setData({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
    properties: {},
  })
}

function clearBBoxLayer(map: any) {
  const source = map.getSource("bbox-draw")
  if (!source) return
  source.setData({ type: "FeatureCollection", features: [] })
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function CatalogImportDialog({
  entry,
  onClose,
  onImported,
}: CatalogImportDialogProps) {
  const [bbox, setBBox] = useState<BBox | null>(null)
  const [crs, setCrs] = useState("EPSG:4326")
  const [maxFeatures, setMaxFeatures] = useState<string>("5000")
  const [customName, setCustomName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when entry changes
  useEffect(() => {
    if (entry) {
      setBBox(null)
      setCrs("EPSG:4326")
      setMaxFeatures("5000")
      setCustomName("")
      setError(null)
    }
  }, [entry?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFluxWfs =
    entry?.domain === "flux" &&
    ((entry as FluxEntry).protocol === "wfs" || (entry as FluxEntry).protocol === "ogc-features")

  const isOpenData = entry?.domain === "opendata"

  const showBBoxMap = isFluxWfs || (isOpenData && !(entry as OpenDataEntry)?.download_url)

  const handleImport = useCallback(async () => {
    if (!entry) return
    setLoading(true)
    setError(null)

    try {
      const { importFromCatalog } = await import("@/api/catalog")
      const params: Record<string, unknown> = {
        entry_id: entry.id,
        crs,
      }
      if (bbox) params.bbox = bbox
      if (maxFeatures) {
        const mf = parseInt(maxFeatures, 10)
        if (!isNaN(mf) && mf > 0) params.max_features = mf
      }
      if (customName.trim()) params.name = customName.trim()

      const result = await importFromCatalog(
        params as unknown as Parameters<typeof importFromCatalog>[0],
      )
      onImported(result as ImportResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [entry, bbox, crs, maxFeatures, customName, onImported])

  if (!entry) return null

  // Determine initial map center from entry bounds or service
  const initialCenter: [number, number] | undefined = (() => {
    const bounds = (entry as any).bounds
    if (bounds && bounds.length === 4) {
      return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2]
    }
    // Default France center for IGN entries
    if (entry.provider === "ign") return [2.3, 46.8]
    return undefined
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-lg border bg-background shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b">
          <Download size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">Import: {entry.name}</h2>
            <p className="text-label text-muted-foreground truncate">{entry.provider} / {entry.domain}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Bbox map (for WFS/OGC entries) */}
          {showBBoxMap && (
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">
                Zone d'extraction (bbox)
              </label>
              <BBoxDrawMap
                bbox={bbox}
                onBBoxChange={setBBox}
                initialCenter={initialCenter}
              />
              {bbox && (
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-label-sm font-mono text-muted-foreground">
                    {bbox.map((v) => v.toFixed(4)).join(", ")}
                  </span>
                  <button
                    onClick={() => setBBox(null)}
                    className="text-label text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear bbox
                  </button>
                </div>
              )}
              {!bbox && (
                <p className="text-label text-amber-600 dark:text-amber-400 mt-1">
                  Sans bbox, toutes les features seront importees (peut etre lent)
                </p>
              )}
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="import-name" className="text-xs font-medium text-foreground mb-1 block">
              Nom du dataset
            </label>
            <input
              id="import-name"
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={entry.name}
              className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* CRS + Max features */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="import-crs" className="text-xs font-medium text-foreground mb-1 block">
                CRS cible
              </label>
              <select
                id="import-crs"
                value={crs}
                onChange={(e) => setCrs(e.target.value)}
                className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="EPSG:4326">EPSG:4326 (WGS84)</option>
                <option value="EPSG:2154">EPSG:2154 (Lambert 93)</option>
                <option value="EPSG:3857">EPSG:3857 (Web Mercator)</option>
                <option value="EPSG:32631">EPSG:32631 (UTM 31N)</option>
                <option value="EPSG:32632">EPSG:32632 (UTM 32N)</option>
              </select>
            </div>
            {showBBoxMap && (
              <div>
                <label htmlFor="import-maxf" className="text-xs font-medium text-foreground mb-1 block">
                  Max features
                </label>
                <input
                  id="import-maxf"
                  type="number"
                  value={maxFeatures}
                  onChange={(e) => setMaxFeatures(e.target.value)}
                  min={1}
                  max={100000}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>

          {/* Entry info badges */}
          <div className="flex flex-wrap gap-1.5">
            {entry.domain === "flux" && (
              <Badge variant="outline" className="text-label-sm font-mono uppercase">
                {(entry as FluxEntry).protocol}
              </Badge>
            )}
            {entry.domain === "opendata" && (entry as OpenDataEntry).format && (
              <Badge variant="secondary" className="text-label-sm font-mono uppercase">
                {(entry as OpenDataEntry).format}
              </Badge>
            )}
            <Badge variant="outline" className="text-label-sm">
              {entry.provider}
            </Badge>
            {entry.domain === "flux" && (entry as FluxEntry).layer_name && (
              <Badge variant="outline" className="text-label-sm font-mono truncate max-w-[200px]">
                {(entry as FluxEntry).layer_name}
              </Badge>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/30">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleImport} disabled={loading} className="gap-1.5">
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <MapPin size={14} />
                Import
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
