import { create } from "zustand"
import type { WorkspaceId } from "@/router"

export type { WorkspaceId }
export type BottomTab = "table" | "logs" | "results" | "triggers" | "sql"

export type ActivitySection = "layers" | "datasets" | "rules" | "triggers" | "catalog" | "search" | "scenes"

export interface MapBookmark {
  id: string
  name: string
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

export type ContextSelection =
  | { type: "none" }
  | { type: "layer"; datasetId: string; layerName: string }
  | { type: "node"; nodeId: string; nodeType?: string; nodeData?: Record<string, unknown> }
  | { type: "trigger"; triggerId: string }
  | { type: "rule"; ruleId: string }
  | { type: "relation"; relationId: string }

interface UIState {
  workspaceId: WorkspaceId
  bottomTab: BottomTab
  bottomPanelOpen: boolean

  // Activity Bar + Left Panel
  activeSection: ActivitySection
  leftPanelOpen: boolean

  // Map bookmarks
  bookmarks: MapBookmark[]
  addBookmark: (bookmark: Omit<MapBookmark, "id">) => void
  removeBookmark: (id: string) => void

  // Inspector (right panel)
  inspectorOpen: boolean
  contextSelection: ContextSelection

  // Multi-layer selection (Set of layerKey strings) — UI-only, not persisted in views
  selectedLayers: Set<string>
  lastSelectedLayerKey: string | null
  setSelectedLayers: (keys: string[]) => void
  toggleLayerInSelection: (key: string) => void
  clearLayerSelection: () => void
  setLastSelectedLayerKey: (key: string | null) => void

  // Actions
  setWorkspaceId: (ws: WorkspaceId) => void
  setBottomTab: (tab: BottomTab) => void
  toggleBottomPanel: () => void
  setBottomPanelOpen: (open: boolean) => void
  setActiveSection: (section: ActivitySection) => void
  toggleLeftPanel: () => void
  setLeftPanelOpen: (open: boolean) => void
  setContextSelection: (sel: ContextSelection) => void
  toggleInspector: () => void
  setInspectorOpen: (open: boolean) => void
}

function loadBookmarks(): MapBookmark[] {
  try {
    const raw = localStorage.getItem("gispulse:bookmarks")
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistBookmarks(bookmarks: MapBookmark[]) {
  localStorage.setItem("gispulse:bookmarks", JSON.stringify(bookmarks))
}

export const useUIStore = create<UIState>((set) => ({
  workspaceId: "map",
  bottomTab: "table",
  bottomPanelOpen: true,

  // Activity Bar + Left Panel
  activeSection: "layers",
  leftPanelOpen: true,

  // Bookmarks
  bookmarks: loadBookmarks(),

  // Multi-layer selection
  selectedLayers: new Set<string>(),
  lastSelectedLayerKey: null,

  // Inspector
  inspectorOpen: true,
  contextSelection: { type: "none" },

  setWorkspaceId: (ws) => set({ workspaceId: ws }),
  setBottomTab: (tab) => set({ bottomTab: tab, bottomPanelOpen: true }),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),

  setActiveSection: (section) =>
    set((s) => {
      if (s.activeSection === section && s.leftPanelOpen) {
        return { leftPanelOpen: false }
      }
      return { activeSection: section, leftPanelOpen: true }
    }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),

  addBookmark: (bookmark) =>
    set((s) => {
      const newBm: MapBookmark = { ...bookmark, id: `bm-${Date.now()}` }
      const next = [...s.bookmarks, newBm]
      persistBookmarks(next)
      return { bookmarks: next }
    }),

  removeBookmark: (id) =>
    set((s) => {
      const next = s.bookmarks.filter((b) => b.id !== id)
      persistBookmarks(next)
      return { bookmarks: next }
    }),

  setSelectedLayers: (keys) => set({ selectedLayers: new Set(keys) }),
  toggleLayerInSelection: (key) =>
    set((s) => {
      const next = new Set(s.selectedLayers)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return { selectedLayers: next }
    }),
  clearLayerSelection: () => set({ selectedLayers: new Set<string>() }),
  setLastSelectedLayerKey: (key) => set({ lastSelectedLayerKey: key }),

  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  setContextSelection: (sel) => set({ contextSelection: sel }),
}))

// Re-export layerKey from mapViewStore for backward compat
export { layerKey } from "@/stores/mapViewStore"

// ---------------------------------------------------------------------------
// Granular selectors
// ---------------------------------------------------------------------------

/** Layout-only selector: workspace, panels, sections. */
export const useLayoutState = () =>
  useUIStore((s) => ({
    workspaceId: s.workspaceId,
    bottomTab: s.bottomTab,
    bottomPanelOpen: s.bottomPanelOpen,
    activeSection: s.activeSection,
    leftPanelOpen: s.leftPanelOpen,
    inspectorOpen: s.inspectorOpen,
  }))

/** Context selection selector. */
export const useContextSelection = () => useUIStore((s) => s.contextSelection)
