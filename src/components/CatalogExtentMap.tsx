/**
 * CatalogExtentMap — mini MapLibre (200x150) affichant la bbox d'un item.
 * Issue #144 (Sprint R-6) : mini-map extent dans l'inspector catalog.
 */

import { useEffect, useRef, useState } from "react"
import "maplibre-gl/dist/maplibre-gl.css"

interface CatalogExtentMapProps {
  /** Bounding box [west, south, east, north] in WGS84 */
  bbox: [number, number, number, number] | number[] | null | undefined
  /** Optional label shown on fallback */
  label?: string
}

/**
 * Adds a small padding factor to the bbox so the geometry is not flush against edges.
 */
function padBbox(
  bbox: [number, number, number, number],
  factor = 0.15,
): [[number, number], [number, number]] {
  const [w, s, e, n] = bbox
  const dLng = Math.max((e - w) * factor, 0.01)
  const dLat = Math.max((n - s) * factor, 0.01)
  return [
    [w - dLng, s - dLat],
    [e + dLng, n + dLat],
  ]
}

export function CatalogExtentMap({ bbox, label }: CatalogExtentMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<unknown>(null)
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!bbox || bbox.length < 4) return
    if (!containerRef.current) return

    const [w, s, e, n] = bbox as [number, number, number, number]

    // Validate bbox values
    if (!isFinite(w) || !isFinite(s) || !isFinite(e) || !isFinite(n)) {
      setError(true)
      return
    }

    let map: any = null
    let destroyed = false

    // Dynamic import to keep bundle split
    import("maplibre-gl").then((ml) => {
      if (destroyed || !containerRef.current) return

      try {
        map = new ml.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              "osm-tiles": {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: "© OpenStreetMap contributors",
              },
            },
            layers: [
              {
                id: "osm-base",
                type: "raster",
                source: "osm-tiles",
                paint: { "raster-opacity": 0.6 },
              },
            ],
          },
          interactive: false,
          attributionControl: false,
          logoPosition: undefined,
        })

        mapRef.current = map

        map.on("load", () => {
          if (destroyed) return

          const padded = padBbox([w, s, e, n])

          // Fit to bbox
          map.fitBounds(padded, { animate: false, padding: 4 })

          // Draw extent rectangle as a fill layer
          map.addSource("extent", {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [[
                  [w, s], [e, s], [e, n], [w, n], [w, s],
                ]],
              },
              properties: {},
            },
          })

          map.addLayer({
            id: "extent-fill",
            type: "fill",
            source: "extent",
            paint: {
              "fill-color": "#3b82f6",
              "fill-opacity": 0.15,
            },
          })

          map.addLayer({
            id: "extent-outline",
            type: "line",
            source: "extent",
            paint: {
              "line-color": "#3b82f6",
              "line-width": 1.5,
            },
          })

          setLoaded(true)
        })

        map.on("error", () => {
          if (!destroyed) setError(true)
        })
      } catch {
        if (!destroyed) setError(true)
      }
    }).catch(() => {
      if (!destroyed) setError(true)
    })

    return () => {
      destroyed = true
      if (map) {
        try { map.remove() } catch { /* ignore */ }
      }
      mapRef.current = null
      setLoaded(false)
    }
  }, [bbox])

  if (!bbox || bbox.length < 4) {
    return <ExtentFallback label={label} reason="No extent available" />
  }

  if (error) {
    return <ExtentFallback label={label} reason="Map unavailable" />
  }

  return (
    <div className="relative rounded-md overflow-hidden border bg-muted/30" style={{ height: 150 }}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-label text-muted-foreground">Loading map...</span>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  )
}

function ExtentFallback({ label, reason }: { label?: string; reason: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md border bg-muted/30 text-center"
      style={{ height: 150 }}
    >
      <span className="text-label text-muted-foreground">{reason}</span>
      {label && (
        <span className="text-label-sm text-muted-foreground/60 mt-0.5 px-2 truncate max-w-full">
          {label}
        </span>
      )}
    </div>
  )
}
