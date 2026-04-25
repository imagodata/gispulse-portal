import { useState, useEffect, useRef } from "react"
import type maplibregl from "maplibre-gl"

interface MapCursorCoordsProps {
  mapRef: React.RefObject<maplibregl.Map | null>
  ready: boolean
}

export function MapCursorCoords({ mapRef, ready }: MapCursorCoordsProps) {
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingRef = useRef<{ lng: number; lat: number } | null>(null)

  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      pendingRef.current = { lng: e.lngLat.lng, lat: e.lngLat.lat }
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          if (pendingRef.current) setCoords(pendingRef.current)
          rafRef.current = null
        })
      }
    }
    const onMouseLeave = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      pendingRef.current = null
      setCoords(null)
    }

    map.on("mousemove", onMouseMove)
    map.getCanvas().addEventListener("mouseleave", onMouseLeave)
    return () => {
      map.off("mousemove", onMouseMove)
      map.getCanvas().removeEventListener("mouseleave", onMouseLeave)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [ready, mapRef])

  if (!coords) return null

  // Format W for negative lng, S for negative lat (#192)
  const absLng = Math.abs(coords.lng).toFixed(5)
  const absLat = Math.abs(coords.lat).toFixed(5)
  const lngDir = coords.lng < 0 ? "W" : "E"
  const latDir = coords.lat < 0 ? "S" : "N"

  return (
    <div className="rounded-md border bg-background/90 px-2 py-1 shadow-sm backdrop-blur-sm text-label font-mono text-muted-foreground tabular-nums">
      {absLat} {latDir} / {absLng} {lngDir}
    </div>
  )
}
