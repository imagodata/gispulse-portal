import { create } from "zustand"
import type maplibregl from "maplibre-gl"

interface MapState {
  map: maplibregl.Map | null
  setMap: (map: maplibregl.Map | null) => void
  zoomToExtent: (bbox: [number, number, number, number]) => void
}

export const useMapStore = create<MapState>((set, get) => ({
  map: null,
  setMap: (map) => set({ map }),
  zoomToExtent: (bbox) => {
    const map = get().map
    if (!map) return
    const [minx, miny, maxx, maxy] = bbox
    if (!Number.isFinite(minx) || !Number.isFinite(miny) || !Number.isFinite(maxx) || !Number.isFinite(maxy)) return
    if (minx === 0 && miny === 0 && maxx === 0 && maxy === 0) return
    if (minx === maxx && miny === maxy) {
      map.flyTo({ center: [minx, miny], zoom: 14 })
    } else {
      map.fitBounds([[minx, miny], [maxx, maxy]], { padding: 50 })
    }
  },
}))
