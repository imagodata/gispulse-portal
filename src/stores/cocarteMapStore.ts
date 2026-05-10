/**
 * cocarteMapStore — Cocarte Map entity store (publish workflow).
 *
 * Distinct from:
 *   - `mapStore.ts`     — the MapLibre instance
 *   - `mapViewStore.ts` — viewport / layer-stack runtime state
 *
 * Mirrors the `projectStore` pattern (flat array + `activeMapId` pointer +
 * version-guarded switches + localStorage persistence).
 *
 * Issue imagodata/gispulse-portal#56 (Sprint 1.1 frontend half).
 */

import { create } from "zustand"

import * as api from "@/api/cocarteMaps"
import type {
  CocarteMap,
  CocarteMapCreateInput,
  CocarteMapUpdateInput,
} from "@/types/cocarteMap"

const ACTIVE_KEY = "gispulse:cocarte:activeMap"

interface CocarteMapState {
  maps: CocarteMap[]
  trashedMaps: CocarteMap[]
  activeMapId: string | null
  loading: boolean

  fetchMaps: () => Promise<void>
  fetchTrashedMaps: () => Promise<void>
  createMap: (input: CocarteMapCreateInput) => Promise<CocarteMap>
  updateMap: (id: string, patch: CocarteMapUpdateInput) => Promise<CocarteMap>
  deleteMap: (id: string) => Promise<void>
  restoreMap: (id: string) => Promise<CocarteMap>
  rotateShareToken: (id: string) => Promise<CocarteMap>
  setActiveMap: (id: string | null) => void
}

function loadPersistedMap(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

function persistActiveMap(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // ignore quota / private-mode failures
  }
}

export const useCocarteMapStore = create<CocarteMapState>((set, get) => ({
  maps: [],
  trashedMaps: [],
  activeMapId: loadPersistedMap(),
  loading: false,

  fetchMaps: async () => {
    set({ loading: true })
    try {
      const maps = await api.listMaps()
      set({ maps })
      const activeId = get().activeMapId
      if (activeId && !maps.find((m) => m.id === activeId)) {
        persistActiveMap(null)
        set({ activeMapId: null })
      }
    } finally {
      set({ loading: false })
    }
  },

  fetchTrashedMaps: async () => {
    const all = await api.listMaps({ includeTrashed: true })
    set({ trashedMaps: all.filter((m) => m.deleted_at !== null) })
  },

  createMap: async (input) => {
    set({ loading: true })
    try {
      const created = await api.createMap(input)
      set((s) => ({ maps: [created, ...s.maps] }))
      return created
    } finally {
      set({ loading: false })
    }
  },

  updateMap: async (id, patch) => {
    const updated = await api.updateMap(id, patch)
    set((s) => ({
      maps: s.maps.map((m) => (m.id === id ? updated : m)),
    }))
    return updated
  },

  deleteMap: async (id) => {
    await api.deleteMap(id)
    const trashed = get().maps.find((m) => m.id === id)
    set((s) => ({
      maps: s.maps.filter((m) => m.id !== id),
      trashedMaps: trashed
        ? [{ ...trashed, deleted_at: new Date().toISOString() }, ...s.trashedMaps]
        : s.trashedMaps,
      activeMapId: s.activeMapId === id ? null : s.activeMapId,
    }))
    if (get().activeMapId === null) persistActiveMap(null)
  },

  restoreMap: async (id) => {
    const restored = await api.restoreMap(id)
    set((s) => ({
      trashedMaps: s.trashedMaps.filter((m) => m.id !== id),
      maps: [restored, ...s.maps],
    }))
    return restored
  },

  rotateShareToken: async (id) => {
    const rotated = await api.rotateShareToken(id)
    set((s) => ({
      maps: s.maps.map((m) => (m.id === id ? rotated : m)),
    }))
    return rotated
  },

  setActiveMap: (id) => {
    set({ activeMapId: id })
    persistActiveMap(id)
  },
}))

/** Derived selector: the currently active map, or null. */
export const useActiveCocarteMap = (): CocarteMap | null => {
  const { maps, activeMapId } = useCocarteMapStore()
  if (!activeMapId) return null
  return maps.find((m) => m.id === activeMapId) ?? null
}
