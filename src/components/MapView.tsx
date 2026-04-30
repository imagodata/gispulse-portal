import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { navigateToView } from "@/router"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { useDatasetStore, useSelectedDataset } from "@/stores/datasetStore"
import { useUIStore } from "@/stores/uiStore"
import { useMapViewStore, useActiveView, useActiveBasemap, parseLayerKey, layerKey } from "@/stores/mapViewStore"
import { useMapStore } from "@/stores/mapStore"
import { useProjectStore } from "@/stores/projectStore"
import { useExternalLayersStore } from "@/stores/externalLayersStore"
import { useFilterStore } from "@/stores/filterStore"
import { getFeatures, getCachedBasemaps } from "@/api/client"
import { geomFamily, fromLegacyStyle } from "@/types/layerStyle"
import type { LayerStyleDef, GeomFamily } from "@/types/layerStyle"
import { styleToMaplibre } from "@/lib/styleConverter"
import { useMeasure, type MeasureMode } from "@/hooks/useMeasure"
import { useDraw, type DrawMode } from "@/hooks/useDraw"
import { MapToolbarUnified } from "./MapToolbarUnified"
import { MapBookmarks } from "./MapBookmarks"
import { MapLegend } from "./MapLegend"
import { MapCursorCoords } from "./MapCursorCoords"
import { FeatureInspector, useFeatureInspectorStore } from "./FeatureInspector"
import { FilterPanel } from "./filter/FilterPanel"
import { BASEMAPS } from "@/types/project"

const INITIAL_VIEW = { lng: 2.35, lat: 46.85, zoom: 5 }

// Basemap lookup — starts with static, enriched by catalog
const basemapIndex = new Map<string, { url: string | null; attribution: string }>()
for (const bm of BASEMAPS) {
  basemapIndex.set(bm.id, { url: bm.url, attribution: bm.attribution })
}
// Load catalog basemaps asynchronously (cached — shared with BasemapSwitcher)
getCachedBasemaps()
  .then((entries) => {
    for (const e of entries) {
      const id = e.id.replace("basemap:", "")
      basemapIndex.set(id, { url: e.url_template || null, attribution: e.attribution })
    }
  })
  .catch(() => {})

// Load custom basemaps from localStorage
try {
  const raw = localStorage.getItem("gispulse:customBasemaps")
  const customs = raw ? JSON.parse(raw) : []
  for (const c of customs) {
    basemapIndex.set(c.id, { url: c.url, attribution: "Custom" })
  }
} catch {}

function buildStyle(basemapId: string): maplibregl.StyleSpecification {
  const bm = basemapIndex.get(basemapId) ?? basemapIndex.get("osm")
  if (!bm?.url) {
    return {
      version: 8,
      sources: {},
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#f0f0f0" } },
      ],
    }
  }
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [bm.url],
        tileSize: 256,
        attribution: bm.attribution,
      },
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  }
}

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lngLat: { lng: number; lat: number } } | null>(null)
  const activeSources = useRef<Set<string>>(new Set())
  const largeSources = useRef<Map<string, { dsId: string; layerName: string; featureCount: number; isLarge: boolean }>>(new Map())
  const lastFittedLayerRef = useRef<string | null>(null)
  const abortControllers = useRef<Map<string, AbortController>>(new Map())
  const dataset = useSelectedDataset()
  const selectedLayerName = useDatasetStore((s) => s.selectedLayerName)
  const datasets = useDatasetStore((s) => s.datasets)

  // Read from mapViewStore instead of uiStore for layer/basemap state
  const activeView = useActiveView()
  const basemap = useActiveBasemap()
  const layerStack = activeView?.state.layerStack ?? []
  const layerGroups = activeView?.state.layerGroups ?? {}

  const navigateView = useCallback((view: string) => {
    navigateToView(view)
  }, [])
  const setBottomTab = useUIStore((s) => s.setBottomTab)
  const setMapInstance = useMapStore((s) => s.setMap)

  const measure = useMeasure()
  const draw = useDraw()
  const pushFeature = useFeatureInspectorStore((s) => s.push)
  const triggers = useProjectStore((s) => s.triggers)
  const triggerMarkersRef = useRef<maplibregl.Marker[]>([])
  const externalLayers = useExternalLayersStore((s) => s.layers)
  const filterResultFeatures = useFilterStore((s) => s.resultFeatures)

  // Count enabled triggers per layer name (DML: conditions.table)
  const triggerCountByLayer = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of triggers) {
      if (!t.enabled) continue
      const table = (t.conditions as Record<string, unknown>)?.table as string | undefined
      if (table) counts.set(table, (counts.get(table) ?? 0) + 1)
    }
    return counts
  }, [triggers])

  const allLayerNames = datasets.flatMap((ds) => (ds.layers ?? []).map((l) => l.name))

  const handleMeasureMode = useCallback(
    (mode: MeasureMode) => {
      draw.setMode("none")
      measure.setMode(mode)
    },
    [draw, measure],
  )

  const handleDrawMode = useCallback(
    (mode: DrawMode) => {
      measure.setMode("none")
      draw.setMode(mode)
    },
    [draw, measure],
  )

  const handleDrawFinish = useCallback(() => {
    draw.finish()
    setRefreshCounter((c) => c + 1)
  }, [draw])

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: buildStyle(basemap),
      center: [INITIAL_VIEW.lng, INITIAL_VIEW.lat],
      zoom: INITIAL_VIEW.zoom,
    })

    map.addControl(new maplibregl.NavigationControl(), "top-right")
    map.addControl(new maplibregl.ScaleControl(), "bottom-left")

    map.on("load", () => {
      mapRef.current = map
      setMapInstance(map)
      setReady(true)
    })

    return () => {
      for (const m of triggerMarkersRef.current) m.remove()
      triggerMarkersRef.current = []
      // Abort all in-flight fetches
      for (const ctrl of abortControllers.current.values()) ctrl.abort()
      abortControllers.current.clear()
      map.remove()
      mapRef.current = null
      setMapInstance(null)
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Basemap change — with guard to prevent race conditions on rapid switches
  const styleLoadingRef = useRef(false)
  const prevBasemapRef = useRef(basemap)

  useEffect(() => {
    if (!ready || !mapRef.current) return
    // Skip if basemap hasn't actually changed (avoid redundant setStyle on initial ready)
    if (prevBasemapRef.current === basemap && refreshCounter === 0) {
      prevBasemapRef.current = basemap
      return
    }
    prevBasemapRef.current = basemap
    styleLoadingRef.current = true
    mapRef.current.setStyle(buildStyle(basemap))
    // Re-add overlay sources and data layers after style change
    mapRef.current.once("style.load", () => {
      // Reset tracking INSIDE style.load so the re-render effect sees all sources as new
      activeSources.current.clear()
      styleLoadingRef.current = false
      setRefreshCounter((c) => c + 1)
    })
  }, [ready, basemap])

  // Multi-layer rendering: reads from active view's layerStack
  useEffect(() => {
    if (!ready || !mapRef.current || styleLoadingRef.current) return
    const map = mapRef.current

    // Build the desired set of sources from the active view's layerStack
    interface DesiredSource {
      dsId: string; layerName: string; featureCount: number; isLarge: boolean
      color: string; opacity: number; strokeColor?: string; strokeWidth?: number
      isSelected: boolean; bbox: number[] | null; visible: boolean
      geom: GeomFamily; styleDef?: LayerStyleDef
    }
    const desiredSources = new Map<string, DesiredSource>()

    for (const layer of layerStack) {
      const { datasetId: dsId, layerName } = parseLayerKey(layer.key)

      // Resolve dataset metadata
      const ds = datasets.find((d) => d.id === dsId)
      if (!ds) continue
      const layerMeta = (ds.layers ?? []).find((l) => l.name === layerName)
      if (!layerMeta) continue

      const sourceId = `portal-${dsId}-${layerName}`
      const isSelected = dsId === dataset?.id && layerName === selectedLayerName
      const geom = geomFamily(layerMeta.geometry_type)

      const LARGE_THRESHOLD = 2000
      desiredSources.set(sourceId, {
        dsId,
        layerName,
        featureCount: layerMeta.feature_count,
        isLarge: layerMeta.feature_count > LARGE_THRESHOLD,
        color: layer.color,
        opacity: layer.opacity,
        strokeColor: layer.strokeColor,
        strokeWidth: layer.strokeWidth,
        isSelected,
        bbox: layerMeta.bbox ?? null,
        visible: layer.visible,
        geom,
        styleDef: layer.styleDef,
      })
    }

    // Layer stack order: layerStack is bottom-to-top, so iterate in order
    const sortedSourceIds = [...desiredSources.keys()]

    // Remove sources that are no longer in the active view (layer removed or view switched)
    for (const sourceId of activeSources.current) {
      if (!desiredSources.has(sourceId)) {
        const fillId = sourceId.replace("portal-", "portal-fill-")
        const lineId = sourceId.replace("portal-", "portal-line-")
        const circleId = sourceId.replace("portal-", "portal-circle-")
        const symbolId = sourceId.replace("portal-", "portal-symbol-")
        if (map.getLayer(symbolId)) map.removeLayer(symbolId)
        if (map.getLayer(fillId)) map.removeLayer(fillId)
        if (map.getLayer(lineId)) map.removeLayer(lineId)
        if (map.getLayer(circleId)) map.removeLayer(circleId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
        activeSources.current.delete(sourceId)
        largeSources.current.delete(sourceId)
        // Abort any in-flight fetch for this source
        const ctrl = abortControllers.current.get(sourceId)
        if (ctrl) {
          ctrl.abort()
          abortControllers.current.delete(sourceId)
        }
      }
    }

    // Update existing sources or add new ones (in z-order: bottom first, top last)
    for (const sourceId of sortedSourceIds) {
      const props = desiredSources.get(sourceId)!
      const fillId = `portal-fill-${props.dsId}-${props.layerName}`
      const lineId = `portal-line-${props.dsId}-${props.layerName}`
      const circleId = `portal-circle-${props.dsId}-${props.layerName}`
      const symbolId = `portal-symbol-${props.dsId}-${props.layerName}`
      const visibilityValue = props.visible ? "visible" : "none"

      if (activeSources.current.has(sourceId) && map.getSource(sourceId)) {
        // Source exists — update paint + toggle visibility via layout (O(1), no remove/add)
        // Resolve style: advanced styleDef takes precedence, else legacy flat style
        const resolvedStyle = props.styleDef
          ? props.styleDef
          : fromLegacyStyle({ color: props.color, opacity: props.opacity, strokeColor: props.strokeColor, strokeWidth: props.strokeWidth }, props.geom)
        const mlSpec = styleToMaplibre(resolvedStyle, props.geom, props.isSelected)

        if (map.getLayer(fillId)) {
          if (mlSpec.fill) {
            for (const [k, v] of Object.entries(mlSpec.fill.paint)) map.setPaintProperty(fillId, k, v)
          }
          map.setLayoutProperty(fillId, "visibility", visibilityValue)
        }
        if (map.getLayer(lineId)) {
          if (mlSpec.line) {
            for (const [k, v] of Object.entries(mlSpec.line.paint)) map.setPaintProperty(lineId, k, v)
          }
          map.setLayoutProperty(lineId, "visibility", visibilityValue)
        }
        if (map.getLayer(circleId)) {
          if (mlSpec.circle) {
            for (const [k, v] of Object.entries(mlSpec.circle.paint)) map.setPaintProperty(circleId, k, v)
          }
          map.setLayoutProperty(circleId, "visibility", visibilityValue)
        }
        // Symbol layer (labels) — add/update/remove dynamically
        if (mlSpec.symbol) {
          if (map.getLayer(symbolId)) {
            for (const [k, v] of Object.entries(mlSpec.symbol.paint)) map.setPaintProperty(symbolId, k, v)
            for (const [k, v] of Object.entries(mlSpec.symbol.layout)) map.setLayoutProperty(symbolId, k, v)
            map.setLayoutProperty(symbolId, "visibility", visibilityValue)
          } else {
            map.addLayer({
              id: symbolId,
              type: "symbol",
              source: sourceId,
              layout: { visibility: visibilityValue, ...mlSpec.symbol.layout },
              paint: mlSpec.symbol.paint,
            } as maplibregl.AddLayerObject)
          }
        } else if (map.getLayer(symbolId)) {
          map.removeLayer(symbolId)
        }

        // Fit to selected layer only on selection change (not every re-render)
        if (props.isSelected && props.visible && props.bbox) {
          const fittedKey = `${props.dsId}::${props.layerName}`
          if (fittedKey !== lastFittedLayerRef.current) {
            lastFittedLayerRef.current = fittedKey
            const [minx, miny, maxx, maxy] = props.bbox
            if (Number.isFinite(minx) && Number.isFinite(miny) && Number.isFinite(maxx) && Number.isFinite(maxy) && minx !== maxx && miny !== maxy) {
              map.fitBounds([[minx, miny], [maxx, maxy]], { padding: 50 })
            }
          }
        }
      } else {
        // Compute fetch options — zoom-based simplification for ALL layers
        const fetchOpts: { limit?: number; simplify?: number; bbox?: string } = {}
        const zoom = map.getZoom()
        // Simplify tolerance in meters — applied to all layers, aggressive at low zoom
        if (zoom < 6) fetchOpts.simplify = 2000
        else if (zoom < 8) fetchOpts.simplify = 500
        else if (zoom < 11) fetchOpts.simplify = 100
        else if (zoom < 14) fetchOpts.simplify = 20
        if (props.isLarge) {
          // Large layer: viewport bbox + safety limit
          const bounds = map.getBounds()
          fetchOpts.bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`
          fetchOpts.limit = 15000
        } else {
          fetchOpts.limit = props.featureCount || 100000
        }

        // Abort any previous in-flight fetch for this source
        const prevCtrl = abortControllers.current.get(sourceId)
        if (prevCtrl) prevCtrl.abort()
        const ctrl = new AbortController()
        abortControllers.current.set(sourceId, ctrl)

        getFeatures(props.dsId, props.layerName, fetchOpts)
          .then((fc) => {
            if (!mapRef.current || ctrl.signal.aborted) return
            // Guard against async race — check if source still desired
            if (map.getSource(sourceId)) return

            // Double-check the layer is still in the active view
            const currentStack = useMapViewStore.getState()
            const currentView = currentStack.views.find((v) => v.id === currentStack.activeViewId)
            const lk = `${props.dsId}::${props.layerName}`
            if (!currentView?.state.layerStack.some((l) => l.key === lk)) return

            map.addSource(sourceId, {
              type: "geojson",
              data: fc as unknown as GeoJSON.GeoJSON,
            })

            // Resolve style: advanced styleDef or legacy flat props
            const initStyle = props.styleDef
              ? props.styleDef
              : fromLegacyStyle({ color: props.color, opacity: props.opacity, strokeColor: props.strokeColor, strokeWidth: props.strokeWidth }, props.geom)
            const mlInit = styleToMaplibre(initStyle, props.geom, props.isSelected)
            const visibility = props.visible ? "visible" : "none"

            // Only create layers relevant to the geometry family
            const needsFill = props.geom === "polygon" || props.geom === "mixed"
            const needsLine = props.geom === "polygon" || props.geom === "line" || props.geom === "mixed"
            const needsCircle = props.geom === "point" || props.geom === "mixed"

            if (needsFill) {
              map.addLayer({
                id: fillId,
                type: "fill",
                source: sourceId,
                filter: [
                  "any",
                  ["==", ["geometry-type"], "Polygon"],
                  ["==", ["geometry-type"], "MultiPolygon"],
                ],
                layout: { visibility },
                paint: mlInit.fill?.paint ?? {
                  "fill-color": props.color,
                  "fill-opacity": props.opacity * 0.4,
                  "fill-outline-color": props.color,
                },
              } as maplibregl.AddLayerObject)
            }

            if (needsLine) {
              map.addLayer({
                id: lineId,
                type: "line",
                source: sourceId,
                filter: [
                  "any",
                  ["==", ["geometry-type"], "Polygon"],
                  ["==", ["geometry-type"], "MultiPolygon"],
                  ["==", ["geometry-type"], "LineString"],
                  ["==", ["geometry-type"], "MultiLineString"],
                ],
                layout: { visibility, ...(mlInit.line?.layout ?? {}) },
                paint: mlInit.line?.paint ?? {
                  "line-color": props.color,
                  "line-width": 1.5,
                  "line-opacity": props.opacity,
                },
              } as maplibregl.AddLayerObject)
            }

            if (needsCircle) {
              map.addLayer({
                id: circleId,
                type: "circle",
                source: sourceId,
                filter: [
                  "any",
                  ["==", ["geometry-type"], "Point"],
                  ["==", ["geometry-type"], "MultiPoint"],
                ],
                layout: { visibility },
                paint: mlInit.circle?.paint ?? {
                  "circle-radius": 5,
                  "circle-color": props.color,
                  "circle-stroke-color": "#ffffff",
                  "circle-stroke-width": 1,
                  "circle-opacity": props.opacity,
                },
              } as maplibregl.AddLayerObject)
            }

            // Symbol layer for labels (if styleDef has labeling enabled)
            if (mlInit.symbol) {
              map.addLayer({
                id: symbolId,
                type: "symbol",
                source: sourceId,
                layout: { visibility, ...mlInit.symbol.layout },
                paint: mlInit.symbol.paint,
              } as maplibregl.AddLayerObject)
            }

            activeSources.current.add(sourceId)
            abortControllers.current.delete(sourceId)

            // Mark source as large for viewport-based reload
            if (props.isLarge) largeSources.current.set(sourceId, props)

            // Trigger re-render so z-order enforcement runs on now-existing layers
            setRefreshCounter((c) => c + 1)

            // Fit to selected layer only on selection change
            if (props.isSelected && props.visible && props.bbox) {
              const fittedKey = `${props.dsId}::${props.layerName}`
              if (fittedKey !== lastFittedLayerRef.current) {
                lastFittedLayerRef.current = fittedKey
                const [minx, miny, maxx, maxy] = props.bbox
                if (Number.isFinite(minx) && Number.isFinite(miny) && Number.isFinite(maxx) && Number.isFinite(maxy) && minx !== maxx && miny !== maxy) {
                  map.fitBounds([[minx, miny], [maxx, maxy]], { padding: 50 })
                }
              }
            }
          })
          .catch((err) => {
            if (ctrl.signal.aborted) return
            console.error(`Failed to load ${props.layerName}:`, err)
          })
      }
    }
    // Enforce z-order on existing layers: move layers so top-of-tree is drawn last (on top)
    // sortedSourceIds is bottom→top, so we moveLayer in that order to stack correctly
    for (const sourceId of sortedSourceIds) {
      const p = desiredSources.get(sourceId)!
      const fillId = `portal-fill-${p.dsId}-${p.layerName}`
      const lineId = `portal-line-${p.dsId}-${p.layerName}`
      const circleId = `portal-circle-${p.dsId}-${p.layerName}`
      const symId = `portal-symbol-${p.dsId}-${p.layerName}`
      // moveLayer(id) without beforeId moves to top of stack
      if (map.getLayer(fillId)) map.moveLayer(fillId)
      if (map.getLayer(lineId)) map.moveLayer(lineId)
      if (map.getLayer(circleId)) map.moveLayer(circleId)
      if (map.getLayer(symId)) map.moveLayer(symId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, datasets, selectedLayerName, layerStack, refreshCounter])

  // Blend mode preview (issue #27) — applies the top-of-stack layer's
  // blendMode to the MapLibre canvas via CSS `mix-blend-mode`. MapLibre
  // does not expose a per-layer blend in the style spec, so this is a
  // best-effort visual preview. The canonical persistence path is the
  // LayerStyleDef itself (server-side `/styles` endpoints) and the QML
  // roundtrip the backend handles.
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const canvas = mapRef.current.getCanvas()
    // Find the top-most visible layer carrying a non-normal blendMode.
    // layerStack is bottom-to-top, so iterate in reverse.
    let mode = ""
    for (let i = layerStack.length - 1; i >= 0; i--) {
      const layer = layerStack[i]
      if (!layer.visible) continue
      const blend = layer.styleDef?.blendMode
      if (blend && blend !== "normal") { mode = blend; break }
    }
    canvas.style.mixBlendMode = mode
    return () => { canvas.style.mixBlendMode = "" }
  }, [ready, layerStack])

  // Viewport-based reload for large layers — debounced on moveend
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current
    let timer: ReturnType<typeof setTimeout>

    const onMoveEnd = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!mapRef.current || largeSources.current.size === 0) return
        const bounds = map.getBounds()
        const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`

        const zoom = map.getZoom()
        for (const [sourceId, info] of largeSources.current) {
          const src = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
          if (!src) continue
          const simplify = zoom < 6 ? 2000 : zoom < 8 ? 500 : zoom < 11 ? 100 : zoom < 14 ? 20 : undefined
          getFeatures(info.dsId, info.layerName, { bbox, simplify, limit: 15000 })
            .then((fc) => {
              if (!mapRef.current) return
              const s = mapRef.current.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
              if (s) s.setData(fc as unknown as GeoJSON.GeoJSON)
            })
            .catch(() => {})
        }
      }, 300)
    }

    map.on("moveend", onMoveEnd)
    return () => {
      clearTimeout(timer)
      map.off("moveend", onMoveEnd)
    }
  }, [ready])

  // External layers (WMS/WMTS/TMS flux) — issue #190 (A7-S3)
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current

    for (const ext of externalLayers) {
      const sourceId = `ext-${ext.id}`
      const layerId = `ext-layer-${ext.id}`
      const visibility = ext.visible ? "visible" : "none"

      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visibility)
        map.setPaintProperty(layerId, "raster-opacity", ext.opacity)
      } else if (!map.getSource(sourceId)) {
        // Build the tile URL depending on protocol
        let tiles: string[] = []
        const url = ext.serviceUrl
        const ln = ext.layerName ?? ""

        if (ext.protocol === "wms") {
          const sep = url.includes("?") ? "&" : "?"
          tiles = [
            `${url}${sep}SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=${encodeURIComponent(ln)}&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=TRUE&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`,
          ]
        } else if (ext.protocol === "wmts") {
          // Use the URL as-is if it's a tile template, otherwise skip
          if (url.includes("{TileMatrix}") || url.includes("{z}")) {
            tiles = [url.replace("{TileMatrix}", "{z}").replace("{TileRow}", "{y}").replace("{TileCol}", "{x}")]
          }
        } else if (ext.protocol === "tms" || ext.protocol === "xyz") {
          tiles = [url]
        }

        if (tiles.length > 0) {
          map.addSource(sourceId, { type: "raster", tiles, tileSize: 256 })
          map.addLayer({
            id: layerId,
            type: "raster",
            source: sourceId,
            layout: { visibility },
            paint: { "raster-opacity": ext.opacity },
          })
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, externalLayers, refreshCounter])

  // Filter results overlay — render filtered features on top of all layers
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current
    const sourceId = "filter-results"
    const fillId = "filter-results-fill"
    const lineId = "filter-results-line"
    const circleId = "filter-results-circle"

    if (!filterResultFeatures || filterResultFeatures.length === 0) {
      // Clean up filter overlay when results are cleared
      if (map.getLayer(fillId)) map.removeLayer(fillId)
      if (map.getLayer(lineId)) map.removeLayer(lineId)
      if (map.getLayer(circleId)) map.removeLayer(circleId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
      return
    }

    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: filterResultFeatures as unknown as GeoJSON.Feature[],
    }

    const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
    if (existing) {
      // Update data in-place
      existing.setData(fc)
      return
    }

    // Add source + layers with highlight styling
    map.addSource(sourceId, { type: "geojson", data: fc })

    map.addLayer({
      id: fillId,
      type: "fill",
      source: sourceId,
      filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
      paint: {
        "fill-color": "#f59e0b",
        "fill-opacity": 0.35,
        "fill-outline-color": "#d97706",
      },
    })

    map.addLayer({
      id: lineId,
      type: "line",
      source: sourceId,
      filter: [
        "any",
        ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"],
        ["==", ["geometry-type"], "LineString"], ["==", ["geometry-type"], "MultiLineString"],
      ],
      paint: {
        "line-color": "#d97706",
        "line-width": 2.5,
        "line-opacity": 0.9,
      },
    })

    map.addLayer({
      id: circleId,
      type: "circle",
      source: sourceId,
      filter: ["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]],
      paint: {
        "circle-radius": 6,
        "circle-color": "#f59e0b",
        "circle-stroke-color": "#d97706",
        "circle-stroke-width": 2,
        "circle-opacity": 0.9,
      },
    })
  }, [ready, filterResultFeatures, refreshCounter])

  // Trigger badge markers — one per layer that has enabled triggers
  useEffect(() => {
    // Remove previous markers
    for (const m of triggerMarkersRef.current) m.remove()
    triggerMarkersRef.current = []
    if (!ready || !mapRef.current || triggerCountByLayer.size === 0) return

    for (const ds of datasets) {
      for (const layer of ds.layers ?? []) {
        const count = triggerCountByLayer.get(layer.name)
        if (!count || !layer.bbox) continue
        const [minx, miny, maxx, maxy] = layer.bbox
        const cx = (minx + maxx) / 2
        const cy = (miny + maxy) / 2

        const el = document.createElement("div")
        el.title = `${count} trigger${count > 1 ? "s" : ""} on ${layer.name}`
        el.style.cssText = [
          "display:flex",
          "align-items:center",
          "justify-content:center",
          "width:20px",
          "height:20px",
          "border-radius:50%",
          "background:rgba(124,58,237,0.85)",
          "border:2px solid rgba(167,139,250,0.9)",
          "color:#fff",
          "font-size:9px",
          "font-weight:700",
          "font-family:system-ui,sans-serif",
          "cursor:default",
          "pointer-events:auto",
          "box-shadow:0 1px 4px rgba(0,0,0,0.4)",
          "letter-spacing:0",
        ].join(";")
        el.textContent = `${count}T`

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([cx, cy])
          .addTo(mapRef.current!)
        triggerMarkersRef.current.push(marker)
      }
    }
  }, [ready, datasets, triggerCountByLayer])

  // Feature click — push to FeatureInspector (Issue #139)
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (measure.mode !== "none" || draw.mode !== "none") return

      const portalLayers = (map.getStyle()?.layers ?? [])
        .filter((l) => l.id.startsWith("portal-"))
        .map((l) => l.id)

      const features = map.queryRenderedFeatures(e.point, {
        layers: portalLayers,
      })
      if (!features.length) return

      const feat = features[0]
      const props = feat.properties ?? {}

      // Parse source/layer info from the MapLibre source id: "portal-{dsId}-{layerName}"
      // dsId may contain hyphens, so we match against known dataset IDs instead of naive split
      const sourceId = (feat.source ?? "") as string
      const sourceBody = sourceId.replace(/^portal-/, "")
      const allDatasets = useDatasetStore.getState().datasets
      let dsId = ""
      let lName = ""
      for (const ds of allDatasets) {
        if (sourceBody.startsWith(ds.id + "-")) {
          dsId = ds.id
          lName = sourceBody.slice(ds.id.length + 1)
          break
        }
      }
      // Fallback: naive first-segment split if dataset not found
      if (!dsId) {
        const parts = sourceBody.split("-")
        dsId = parts[0] ?? ""
        lName = parts.slice(1).join("-")
      }

      // fid: use feature index or a property if available
      const fid = feat.id != null ? Number(feat.id) : Math.abs(JSON.stringify(props).length)

      // Push to FeatureInspector store
      pushFeature({
        fid,
        layerName: lName || (feat.layer?.id ?? ""),
        datasetId: dsId,
        properties: props,
        geometry: feat.geometry ? (feat.geometry as unknown as Record<string, unknown>) : null,
        geometryType: feat.geometry?.type ?? null,
      })
    }

    map.on("click", handleClick)
    return () => {
      map.off("click", handleClick)
    }
  }, [ready, measure.mode, draw.mode, pushFeature])

  // Measure / Draw overlay
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current
    const overlaySourceId = "overlay-source"

    if (!map.getSource(overlaySourceId)) {
      map.addSource(overlaySourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      })
      map.addLayer({
        id: "overlay-line",
        type: "line",
        source: overlaySourceId,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": "#f97316",
          "line-width": 2,
          "line-dasharray": [4, 2],
        },
      })
      map.addLayer({
        id: "overlay-point",
        type: "circle",
        source: overlaySourceId,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#f97316",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      })
    }

    const activePoints =
      measure.mode !== "none" ? measure.points : draw.points
    const features: GeoJSON.Feature[] = []

    for (const pt of activePoints) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: pt },
        properties: {},
      })
    }

    if (activePoints.length >= 2) {
      const coords =
        measure.mode === "area" || draw.mode === "polygon"
          ? [...activePoints, activePoints[0]]
          : activePoints
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {},
      })
    }

    const source = map.getSource(overlaySourceId) as maplibregl.GeoJSONSource
    if (source) {
      source.setData({ type: "FeatureCollection", features })
    }
  }, [ready, measure.points, measure.mode, draw.points, draw.mode])

  // Map click for measure/draw
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      if (draw.mode !== "none") {
        draw.addPoint(lng, lat)
      } else if (measure.mode !== "none") {
        measure.addPoint(lng, lat)
      }
    }

    map.on("click", handleMapClick)
    return () => {
      map.off("click", handleMapClick)
    }
  }, [ready, draw, measure])

  // Right-click context menu
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current

    const handleContextMenu = (e: maplibregl.MapMouseEvent & { originalEvent: MouseEvent }) => {
      e.originalEvent.preventDefault()
      setContextMenu({ x: e.originalEvent.clientX, y: e.originalEvent.clientY, lngLat: e.lngLat })
    }

    map.on("contextmenu", handleContextMenu)
    return () => {
      map.off("contextmenu", handleContextMenu)
    }
  }, [ready])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    window.addEventListener("click", handleClick)
    return () => window.removeEventListener("click", handleClick)
  }, [contextMenu])

  // Cursor style
  useEffect(() => {
    if (!mapRef.current) return
    const canvas = mapRef.current.getCanvas()
    if (measure.mode !== "none" || (draw.mode !== "none" && draw.mode !== "delete")) {
      canvas.style.cursor = "crosshair"
    } else if (draw.mode === "delete") {
      canvas.style.cursor = "not-allowed"
    } else {
      canvas.style.cursor = ""
    }
  }, [measure.mode, draw.mode])

  return (
    <div className="flex h-full w-full">
      {/* Map container — fills available space */}
      <div className="relative flex-1 h-full">
        <div ref={mapContainer} className="h-full w-full" aria-label="Map canvas" />

        {/* Unified toolbar — Issue #137/#138 */}
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1 max-w-[calc(100%-80px)]">
          <MapToolbarUnified
            measureMode={measure.mode}
            measureResult={measure.result}
            measurePointCount={measure.points.length}
            onMeasureMode={handleMeasureMode}
            onMeasureClear={measure.clear}
            drawMode={draw.mode}
            drawActiveLayer={draw.activeLayer}
            drawAvailableLayers={allLayerNames}
            drawPointCount={draw.points.length}
            onDrawMode={handleDrawMode}
            onDrawActiveLayer={draw.setActiveLayer}
            onDrawFinish={handleDrawFinish}
            onDrawClear={draw.clear}
          />
          <MapBookmarks mapRef={mapRef} ready={ready} />
        </div>

        {/* Map legend */}
        <div className="absolute left-2 bottom-8 z-10">
          <MapLegend />
        </div>

        {/* Cursor coordinates */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-2 z-10">
          <MapCursorCoords mapRef={mapRef} ready={ready} />
        </div>

        {/* Right-click context menu */}
        {contextMenu && (() => {
          const menuWidth = 200
          const menuHeight = 180
          const left = Math.min(contextMenu.x, window.innerWidth - menuWidth - 8)
          const top = Math.min(contextMenu.y, window.innerHeight - menuHeight - 8)
          const { lng, lat } = contextMenu.lngLat
          const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          const selectedBbox = dataset?.layers?.find((l) => l.name === selectedLayerName)?.bbox

          return (
            <div
              role="menu"
              aria-label="Map context menu"
              className="fixed z-50 min-w-[200px] rounded-md border bg-popover py-1 shadow-md text-xs"
              style={{ left, top }}
              onKeyDown={(e) => { if (e.key === "Escape") setContextMenu(null) }}
            >
              {/* Coordinates header */}
              <div className="px-3 py-1 text-muted-foreground font-mono select-all">{coordStr}</div>
              <div className="h-px bg-border my-1" />

              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
                onClick={() => { navigator.clipboard.writeText(coordStr); setContextMenu(null) }}
              >
                Copy coordinates
              </button>
              {selectedBbox && (
                <button
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    const [minx, miny, maxx, maxy] = selectedBbox
                    mapRef.current?.fitBounds([[minx, miny], [maxx, maxy]], { padding: 50 })
                    setContextMenu(null)
                  }}
                >
                  Zoom to layer extent
                </button>
              )}
              <div className="h-px bg-border my-1" />
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
                onClick={() => { navigateView("schema"); setContextMenu(null) }}
              >
                Show in Schema
              </button>
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
                onClick={() => { setBottomTab("table"); setContextMenu(null) }}
              >
                Open in Table
              </button>
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
                onClick={() => { setBottomTab("sql"); setContextMenu(null) }}
              >
                Open SQL Console
              </button>
            </div>
          )
        })()}
      </div>

      {/* Feature Inspector — Issue #139 */}
      <FeatureInspector />

      {/* Filter Panel — interactive spatial filtering */}
      <FilterPanel />
    </div>
  )
}
