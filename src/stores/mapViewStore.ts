/**
 * mapViewStore — Manages map views, each with its own layer stack, styles, and basemap.
 *
 * Replaces the layer-specific state from uiStore and the scene snapshot system.
 * Datasets (datasetStore) are the "catalog" of available data.
 * Map views are the "what's displayed" — each view has an independent layer stack.
 */

import { create } from "zustand"
import type { BasemapId } from "@/types/project"
import type { LayerStyleDef } from "@/types/layerStyle"

// ── Types ───���──────────────────────────────────────────────────────────

export interface MapViewLayer {
  key: string // "datasetId::layerName"
  visible: boolean
  color: string
  opacity: number
  strokeColor?: string
  strokeWidth?: number
  displayName?: string
  /** Advanced style definition — when set, takes precedence over flat color/opacity/stroke. */
  styleDef?: LayerStyleDef
}

export interface MapViewState {
  layerStack: MapViewLayer[] // ordered bottom-to-top
  basemap: BasemapId
  layerGroups: Record<string, { name: string; collapsed: boolean; layers: string[] }>
}

export interface MapView {
  id: string
  name: string
  createdAt: number
  state: MapViewState
}

export interface MapViewSnapshot {
  name: string
  createdAt: number
  state: MapViewState
}

// ── Default colors ─────────────────────────────────────────────────────

const LAYER_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
]

let colorIndex = 0
function nextColor(): string {
  const c = LAYER_COLORS[colorIndex % LAYER_COLORS.length]
  colorIndex++
  return c
}

// ── Persistence ────────────────────────────────────────────────────────

const STORAGE_KEY = "gispulse:mapViews"
const ACTIVE_KEY = "gispulse:activeViewId"
const SNAPSHOTS_KEY = "gispulse:scenes"

function loadViews(): MapView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistViews(views: MapView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
}

function loadActiveViewId(): string {
  return localStorage.getItem(ACTIVE_KEY) || "default"
}

function persistActiveViewId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id)
}

function loadSnapshots(): MapViewSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    // Backward compat: old scenes have { snapshot: { layerVisibility, layerOrder, ... } }
    // Convert to new format on load
    return parsed.map((s: Record<string, unknown>) => {
      if ("snapshot" in s) {
        const old = s.snapshot as Record<string, unknown>
        const layerVis = (old.layerVisibility ?? {}) as Record<string, { visible: boolean; opacity: number; color: string; strokeColor?: string; strokeWidth?: number; displayName?: string }>
        const layerOrder = (old.layerOrder ?? []) as string[]
        const layerGroups = (old.layerGroups ?? {}) as Record<string, { name: string; collapsed: boolean; layers: string[] }>
        const basemap = (old.basemap ?? "osm") as BasemapId

        // Convert layerVisibility record → layerStack array
        const layerStack: MapViewLayer[] = []
        for (const key of layerOrder) {
          if (key in layerVis) {
            layerStack.push({ key, ...layerVis[key] })
          }
        }
        // Add any keys not in layerOrder
        for (const [key, vis] of Object.entries(layerVis)) {
          if (!layerOrder.includes(key)) {
            layerStack.push({ key, ...vis })
          }
        }

        return {
          name: s.name as string,
          createdAt: s.createdAt as number,
          state: { layerStack, basemap, layerGroups },
        }
      }
      return s as MapViewSnapshot
    })
  } catch {
    return []
  }
}

function persistSnapshots(snapshots: MapViewSnapshot[]) {
  localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots))
}

// ── Migration from legacy uiStore ──────────────────────────────────────

function migrateFromLegacy(): MapView[] | null {
  // Only migrate if no mapViews exist yet
  if (localStorage.getItem(STORAGE_KEY)) return null

  try {
    const visRaw = localStorage.getItem("gispulse:layerVisibility")
    if (!visRaw) return null // No legacy data

    const layerVis = JSON.parse(visRaw) as Record<string, { visible: boolean; opacity: number; color: string; strokeColor?: string; strokeWidth?: number; displayName?: string }>
    const layerOrder: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem("gispulse:layerOrder") || "[]")
      } catch { return [] }
    })()
    const layerGroups: Record<string, { name: string; collapsed: boolean; layers: string[] }> = (() => {
      try {
        return JSON.parse(localStorage.getItem("gispulse:layerGroups") || "{}")
      } catch { return {} }
    })()
    const basemap = (localStorage.getItem("gispulse:basemap") || "osm") as BasemapId
    const removedLayers: Set<string> = (() => {
      try {
        return new Set(JSON.parse(localStorage.getItem("gispulse:removedLayers") || "[]") as string[])
      } catch { return new Set<string>() }
    })()

    // Build layerStack from layerOrder + layerVisibility, excluding removedLayers
    const layerStack: MapViewLayer[] = []
    const added = new Set<string>()

    for (const key of layerOrder) {
      if (removedLayers.has(key)) continue
      const vis = layerVis[key]
      if (vis) {
        layerStack.push({ key, ...vis })
        added.add(key)
      }
    }
    // Add remaining keys not in layerOrder
    for (const [key, vis] of Object.entries(layerVis)) {
      if (added.has(key) || removedLayers.has(key)) continue
      layerStack.push({ key, ...vis })
    }

    const defaultView: MapView = {
      id: "default",
      name: "Default",
      createdAt: Date.now(),
      state: { layerStack, basemap, layerGroups },
    }

    return [defaultView]
  } catch {
    return null
  }
}

// ── Store ──────────────────────────────────────────────────────────────

function emptyViewState(): MapViewState {
  return { layerStack: [], basemap: "osm", layerGroups: {} }
}

function initViews(): MapView[] {
  const migrated = migrateFromLegacy()
  if (migrated) {
    persistViews(migrated)
    return migrated
  }
  const loaded = loadViews()
  if (loaded.length > 0) return loaded
  // No views at all — create a default empty one
  const defaultView: MapView = {
    id: "default",
    name: "Default",
    createdAt: Date.now(),
    state: emptyViewState(),
  }
  persistViews([defaultView])
  return [defaultView]
}

interface MapViewStoreState {
  views: MapView[]
  activeViewId: string
  snapshots: MapViewSnapshot[]
  copiedStyle: Omit<MapViewLayer, "key"> | null

  // View management
  createView: (name: string) => MapView
  deleteView: (id: string) => void
  switchView: (id: string) => void
  renameView: (id: string, name: string) => void
  duplicateView: (id: string, name: string) => MapView

  // Layer management (operates on active view)
  addLayer: (key: string) => void
  removeLayer: (key: string) => void
  reorderLayers: (keys: string[]) => void
  setLayerStyle: (key: string, patch: Partial<Omit<MapViewLayer, "key">>) => void
  setLayerVisible: (key: string, visible: boolean) => void
  setLayerOpacity: (key: string, opacity: number) => void
  setLayerColor: (key: string, color: string) => void
  setLayerStrokeColor: (key: string, strokeColor: string) => void
  setLayerStrokeWidth: (key: string, strokeWidth: number) => void
  setLayerDisplayName: (key: string, name: string) => void
  soloLayer: (key: string) => void
  showAllLayers: () => void
  hideAllLayers: () => void
  copyLayerStyle: (key: string) => void
  pasteLayerStyle: (key: string) => void

  // Advanced style definition
  setLayerStyleDef: (key: string, styleDef: LayerStyleDef) => void
  clearLayerStyleDef: (key: string) => void

  // Basemap
  setBasemap: (basemap: BasemapId) => void

  // Layer groups (scoped to active view)
  createLayerGroup: (name: string, layerKeys: string[]) => void
  renameLayerGroup: (groupId: string, name: string) => void
  deleteLayerGroup: (groupId: string) => void
  toggleGroupCollapsed: (groupId: string) => void
  toggleGroupVisibility: (groupId: string) => void
  addLayerToGroup: (groupId: string, layerKey: string) => void
  removeLayerFromGroup: (groupId: string, layerKey: string) => void

  // Snapshots (saved view states)
  saveSnapshot: (name: string) => void
  deleteSnapshot: (index: number) => void
  restoreSnapshot: (index: number) => void

  // Bulk operations
  addLayers: (keys: string[]) => void
  removeLayers: (keys: string[]) => void
  applyImportedStyles: (datasetId: string, styles: { layer_name: string; color?: string; opacity?: number; stroke_color?: string; stroke_width?: number }[], styleDefs?: Record<string, LayerStyleDef>) => void

  // Cleanup
  cleanupOrphanedLayers: (validKeys: Set<string>) => void
}

// Helper to update the active view and persist
function updateActiveView(
  views: MapView[],
  activeViewId: string,
  updater: (state: MapViewState) => MapViewState,
): MapView[] {
  return views.map((v) =>
    v.id === activeViewId ? { ...v, state: updater(v.state) } : v,
  )
}

export const useMapViewStore = create<MapViewStoreState>((set, get) => ({
  views: initViews(),
  activeViewId: loadActiveViewId(),
  snapshots: loadSnapshots(),
  copiedStyle: null,

  // ── View management ──────────────────────────────────────────────

  createView: (name) => {
    const view: MapView = {
      id: `view-${Date.now()}`,
      name: name.trim() || `View ${get().views.length + 1}`,
      createdAt: Date.now(),
      state: emptyViewState(),
    }
    const next = [...get().views, view]
    persistViews(next)
    persistActiveViewId(view.id)
    set({ views: next, activeViewId: view.id })
    return view
  },

  deleteView: (id) => {
    const { views, activeViewId } = get()
    if (views.length <= 1) return // Cannot delete last view
    const next = views.filter((v) => v.id !== id)
    persistViews(next)
    if (activeViewId === id) {
      const newActiveId = next[0].id
      persistActiveViewId(newActiveId)
      set({ views: next, activeViewId: newActiveId })
    } else {
      set({ views: next })
    }
  },

  switchView: (id) => {
    if (get().views.some((v) => v.id === id)) {
      persistActiveViewId(id)
      set({ activeViewId: id })
    }
  },

  renameView: (id, name) => {
    const next = get().views.map((v) =>
      v.id === id ? { ...v, name: name.trim() || v.name } : v,
    )
    persistViews(next)
    set({ views: next })
  },

  duplicateView: (id, name) => {
    const source = get().views.find((v) => v.id === id)
    if (!source) return source as unknown as MapView
    const view: MapView = {
      id: `view-${Date.now()}`,
      name: name.trim() || `${source.name} (copy)`,
      createdAt: Date.now(),
      state: JSON.parse(JSON.stringify(source.state)),
    }
    const next = [...get().views, view]
    persistViews(next)
    persistActiveViewId(view.id)
    set({ views: next, activeViewId: view.id })
    return view
  },

  // ── Layer management ─────────────────────────────────────────────

  addLayer: (key) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      if (s.layerStack.some((l) => l.key === key)) return s // Already present
      return {
        ...s,
        layerStack: [...s.layerStack, {
          key,
          visible: true,
          opacity: 0.7,
          color: nextColor(),
        }],
      }
    })
    persistViews(next)
    set({ views: next })
  },

  addLayers: (keys) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      const existing = new Set(s.layerStack.map((l) => l.key))
      const newLayers = keys
        .filter((k) => !existing.has(k))
        .map((key) => ({ key, visible: true, opacity: 0.7, color: nextColor() }))
      if (newLayers.length === 0) return s
      return { ...s, layerStack: [...s.layerStack, ...newLayers] }
    })
    persistViews(next)
    set({ views: next })
  },

  removeLayer: (key) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => ({
      ...s,
      layerStack: s.layerStack.filter((l) => l.key !== key),
    }))
    persistViews(next)
    set({ views: next })
  },

  removeLayers: (keys) => {
    const { views, activeViewId } = get()
    const keySet = new Set(keys)
    const next = updateActiveView(views, activeViewId, (s) => ({
      ...s,
      layerStack: s.layerStack.filter((l) => !keySet.has(l.key)),
    }))
    persistViews(next)
    set({ views: next })
  },

  reorderLayers: (keys) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      const byKey = new Map(s.layerStack.map((l) => [l.key, l]))
      const reordered = keys.map((k) => byKey.get(k)).filter(Boolean) as MapViewLayer[]
      // Append any layers not in the new order (shouldn't happen, but be safe)
      for (const l of s.layerStack) {
        if (!keys.includes(l.key)) reordered.push(l)
      }
      return { ...s, layerStack: reordered }
    })
    persistViews(next)
    set({ views: next })
  },

  setLayerStyle: (key, patch) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => ({
      ...s,
      layerStack: s.layerStack.map((l) =>
        l.key === key ? { ...l, ...patch } : l,
      ),
    }))
    persistViews(next)
    set({ views: next })
  },

  setLayerVisible: (key, visible) => get().setLayerStyle(key, { visible }),
  setLayerOpacity: (key, opacity) => get().setLayerStyle(key, { opacity }),
  setLayerColor: (key, color) => get().setLayerStyle(key, { color }),
  setLayerStrokeColor: (key, strokeColor) => get().setLayerStyle(key, { strokeColor }),
  setLayerStrokeWidth: (key, strokeWidth) => get().setLayerStyle(key, { strokeWidth }),
  setLayerDisplayName: (key, name) => get().setLayerStyle(key, { displayName: name || undefined }),

  soloLayer: (key) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      const visibleKeys = s.layerStack.filter((l) => l.visible).map((l) => l.key)
      const isSolo = visibleKeys.length === 1 && visibleKeys[0] === key
      return {
        ...s,
        layerStack: s.layerStack.map((l) => ({
          ...l,
          visible: isSolo ? true : l.key === key,
        })),
      }
    })
    persistViews(next)
    set({ views: next })
  },

  showAllLayers: () => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => ({
      ...s,
      layerStack: s.layerStack.map((l) => ({ ...l, visible: true })),
    }))
    persistViews(next)
    set({ views: next })
  },

  hideAllLayers: () => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => ({
      ...s,
      layerStack: s.layerStack.map((l) => ({ ...l, visible: false })),
    }))
    persistViews(next)
    set({ views: next })
  },

  copyLayerStyle: (key) => {
    const view = get().views.find((v) => v.id === get().activeViewId)
    const layer = view?.state.layerStack.find((l) => l.key === key)
    if (!layer) return
    const { key: _, ...style } = layer
    set({ copiedStyle: style })
  },

  pasteLayerStyle: (key) => {
    const { copiedStyle } = get()
    if (!copiedStyle) return
    get().setLayerStyle(key, {
      color: copiedStyle.color,
      opacity: copiedStyle.opacity,
      strokeColor: copiedStyle.strokeColor,
      strokeWidth: copiedStyle.strokeWidth,
      styleDef: copiedStyle.styleDef,
    })
  },

  // ── Advanced style definition ───────────────────────────────────

  setLayerStyleDef: (key, styleDef) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => ({
      ...s,
      layerStack: s.layerStack.map((l) =>
        l.key === key ? { ...l, styleDef } : l,
      ),
    }))
    persistViews(next)
    set({ views: next })
  },

  clearLayerStyleDef: (key) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => ({
      ...s,
      layerStack: s.layerStack.map((l) => {
        if (l.key !== key) return l
        const { styleDef: _, ...rest } = l
        return rest
      }),
    }))
    persistViews(next)
    set({ views: next })
  },

  // ── Basemap ──────────────────────────────────────────────────────

  setBasemap: (basemap) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => ({ ...s, basemap }))
    persistViews(next)
    // Also persist to legacy key for backward compat
    localStorage.setItem("gispulse:basemap", basemap)
    set({ views: next })
  },

  // ── Layer groups ─────────────────────────────────────────────────

  createLayerGroup: (name, layerKeys) => {
    const { views, activeViewId } = get()
    const groupId = `group-${Date.now()}`
    const next = updateActiveView(views, activeViewId, (s) => ({
      ...s,
      layerGroups: { ...s.layerGroups, [groupId]: { name, collapsed: false, layers: layerKeys } },
    }))
    persistViews(next)
    set({ views: next })
  },

  renameLayerGroup: (groupId, name) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      const group = s.layerGroups[groupId]
      if (!group) return s
      return { ...s, layerGroups: { ...s.layerGroups, [groupId]: { ...group, name } } }
    })
    persistViews(next)
    set({ views: next })
  },

  deleteLayerGroup: (groupId) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      const { [groupId]: _, ...rest } = s.layerGroups
      return { ...s, layerGroups: rest }
    })
    persistViews(next)
    set({ views: next })
  },

  toggleGroupCollapsed: (groupId) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      const group = s.layerGroups[groupId]
      if (!group) return s
      return { ...s, layerGroups: { ...s.layerGroups, [groupId]: { ...group, collapsed: !group.collapsed } } }
    })
    persistViews(next)
    set({ views: next })
  },

  toggleGroupVisibility: (groupId) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      const group = s.layerGroups[groupId]
      if (!group) return s
      const allVisible = group.layers.every((k) => {
        const layer = s.layerStack.find((l) => l.key === k)
        return layer ? layer.visible : true
      })
      return {
        ...s,
        layerStack: s.layerStack.map((l) =>
          group.layers.includes(l.key) ? { ...l, visible: !allVisible } : l,
        ),
      }
    })
    persistViews(next)
    set({ views: next })
  },

  addLayerToGroup: (groupId, layerKey) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      const group = s.layerGroups[groupId]
      if (!group || group.layers.includes(layerKey)) return s
      return { ...s, layerGroups: { ...s.layerGroups, [groupId]: { ...group, layers: [...group.layers, layerKey] } } }
    })
    persistViews(next)
    set({ views: next })
  },

  removeLayerFromGroup: (groupId, layerKey) => {
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      const group = s.layerGroups[groupId]
      if (!group) return s
      return { ...s, layerGroups: { ...s.layerGroups, [groupId]: { ...group, layers: group.layers.filter((k) => k !== layerKey) } } }
    })
    persistViews(next)
    set({ views: next })
  },

  // ── Snapshots ────────────────────────────────────────────────────

  saveSnapshot: (name) => {
    const view = get().views.find((v) => v.id === get().activeViewId)
    if (!view) return
    const snapshot: MapViewSnapshot = {
      name: name.trim() || `Snapshot ${get().snapshots.length + 1}`,
      createdAt: Date.now(),
      state: JSON.parse(JSON.stringify(view.state)),
    }
    const next = [...get().snapshots, snapshot]
    persistSnapshots(next)
    set({ snapshots: next })
  },

  deleteSnapshot: (index) => {
    const next = get().snapshots.filter((_, i) => i !== index)
    persistSnapshots(next)
    set({ snapshots: next })
  },

  restoreSnapshot: (index) => {
    const snapshot = get().snapshots[index]
    if (!snapshot) return
    const { views, activeViewId } = get()
    const next = views.map((v) =>
      v.id === activeViewId
        ? { ...v, state: JSON.parse(JSON.stringify(snapshot.state)) }
        : v,
    )
    persistViews(next)
    set({ views: next })
  },

  // ── Bulk / import ────────────────────────────────────────────────

  applyImportedStyles: (datasetId, styles, styleDefs) => {
    if ((!styles || styles.length === 0) && !styleDefs) return
    const { views, activeViewId } = get()
    const next = updateActiveView(views, activeViewId, (s) => {
      const newStack = [...s.layerStack]
      const existingKeys = new Set(newStack.map((l) => l.key))
      for (const st of (styles ?? [])) {
        const key = `${datasetId}::${st.layer_name}`
        const advancedDef = styleDefs?.[st.layer_name]
        const layerData: MapViewLayer = {
          key,
          visible: true,
          opacity: st.opacity ?? 0.7,
          color: st.color ?? nextColor(),
          ...(st.stroke_color ? { strokeColor: st.stroke_color } : {}),
          ...(st.stroke_width ? { strokeWidth: st.stroke_width } : {}),
          ...(advancedDef ? { styleDef: advancedDef } : {}),
        }
        if (existingKeys.has(key)) {
          const idx = newStack.findIndex((l) => l.key === key)
          if (idx !== -1) newStack[idx] = { ...newStack[idx], ...layerData }
        } else {
          newStack.push(layerData)
          existingKeys.add(key)
        }
      }
      // Also apply styleDefs for layers that had no simple style match
      if (styleDefs) {
        for (const [layerName, def] of Object.entries(styleDefs)) {
          const key = `${datasetId}::${layerName}`
          if (existingKeys.has(key)) {
            const idx = newStack.findIndex((l) => l.key === key)
            if (idx !== -1 && !newStack[idx].styleDef) {
              newStack[idx] = { ...newStack[idx], styleDef: def }
            }
          }
        }
      }
      return { ...s, layerStack: newStack }
    })
    persistViews(next)
    set({ views: next })
  },

  cleanupOrphanedLayers: (validKeys) => {
    const { views } = get()
    const next = views.map((v) => ({
      ...v,
      state: {
        ...v.state,
        layerStack: v.state.layerStack.filter((l) => validKeys.has(l.key)),
        layerGroups: Object.fromEntries(
          Object.entries(v.state.layerGroups).map(([gid, group]) => [
            gid,
            { ...group, layers: group.layers.filter((k) => validKeys.has(k)) },
          ]),
        ),
      },
    }))
    persistViews(next)
    set({ views: next })
  },
}))

// ── Derived selectors ──────────────────────────────────────────────────

/** Get the active MapView */
export const useActiveView = () =>
  useMapViewStore((s) => s.views.find((v) => v.id === s.activeViewId) ?? s.views[0])

/** Get the active view's layer stack */
export const useActiveLayerStack = () =>
  useMapViewStore((s) => {
    const view = s.views.find((v) => v.id === s.activeViewId) ?? s.views[0]
    return view?.state.layerStack ?? []
  })

/** Get a specific layer's style from the active view */
export const useActiveLayerStyle = (key: string) =>
  useMapViewStore((s) => {
    const view = s.views.find((v) => v.id === s.activeViewId) ?? s.views[0]
    return view?.state.layerStack.find((l) => l.key === key)
  })

/** Get the active view's basemap */
export const useActiveBasemap = () =>
  useMapViewStore((s) => {
    const view = s.views.find((v) => v.id === s.activeViewId) ?? s.views[0]
    return view?.state.basemap ?? "osm"
  })

/** Get the active view's layer groups */
export const useActiveLayerGroups = () =>
  useMapViewStore((s) => {
    const view = s.views.find((v) => v.id === s.activeViewId) ?? s.views[0]
    return view?.state.layerGroups ?? {}
  })

/** Helper to build a layer key */
export function layerKey(datasetId: string, layerName: string): string {
  return `${datasetId}::${layerName}`
}

/** Parse a layer key back to datasetId and layerName */
export function parseLayerKey(key: string): { datasetId: string; layerName: string } {
  const idx = key.indexOf("::")
  return {
    datasetId: key.slice(0, idx),
    layerName: key.slice(idx + 2),
  }
}
