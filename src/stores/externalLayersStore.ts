/**
 * externalLayersStore — Stores WMS/WMTS/TMS flux layers added to the map
 * from the catalog (issue #190, A7-S3).
 *
 * These are raster tile layers loaded directly from remote services —
 * they bypass the normal dataset/GPKG pipeline.
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { FluxEntry } from "@/types/catalog"

export interface ExternalLayer {
  id: string           // stable ID: "flux::" + entry.id
  name: string
  protocol: FluxEntry["protocol"]
  serviceUrl: string
  layerName: string | null
  defaultCrs: string
  visible: boolean
  opacity: number
  addedAt: string
}

interface ExternalLayersState {
  layers: ExternalLayer[]
  addFluxLayer: (entry: FluxEntry) => ExternalLayer
  removeLayer: (id: string) => void
  setVisible: (id: string, visible: boolean) => void
  setOpacity: (id: string, opacity: number) => void
  hasLayer: (id: string) => boolean
}

export const useExternalLayersStore = create<ExternalLayersState>()(
  persist(
    (set, get) => ({
      layers: [],

      addFluxLayer: (entry: FluxEntry) => {
        const id = `flux::${entry.id}`
        const existing = get().layers.find((l) => l.id === id)
        if (existing) return existing

        const layer: ExternalLayer = {
          id,
          name: entry.name,
          protocol: entry.protocol,
          serviceUrl: entry.service_url,
          layerName: entry.layer_name ?? null,
          defaultCrs: entry.default_crs,
          visible: true,
          opacity: 1,
          addedAt: new Date().toISOString(),
        }
        set((s) => ({ layers: [...s.layers, layer] }))
        return layer
      },

      removeLayer: (id) => set((s) => ({ layers: s.layers.filter((l) => l.id !== id) })),

      setVisible: (id, visible) =>
        set((s) => ({
          layers: s.layers.map((l) => (l.id === id ? { ...l, visible } : l)),
        })),

      setOpacity: (id, opacity) =>
        set((s) => ({
          layers: s.layers.map((l) => (l.id === id ? { ...l, opacity } : l)),
        })),

      hasLayer: (id) => get().layers.some((l) => l.id === id),
    }),
    { name: "gispulse:external-layers" },
  ),
)
