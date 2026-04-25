import { create } from "zustand"
import type { BasemapId, LayerVisibility } from "@/types/project"
import type { WorkspaceId } from "@/router"

export interface SceneSnapshot {
  layerVisibility: Record<string, LayerVisibility>
  layerOrder: string[]
  layerGroups: Record<string, { name: string; collapsed: boolean; layers: string[] }>
  basemap: BasemapId
  /** Workspace active when scene was saved (legacy field name kept for localStorage compat) */
  mainView: WorkspaceId
  bottomPanelOpen: boolean
}

export interface Scene {
  id: string
  name: string
  createdAt: number // epoch ms
  snapshot: SceneSnapshot
}

interface SceneState {
  scenes: Scene[]
  saveScene: (name: string, snapshot: SceneSnapshot) => Scene
  deleteScene: (id: string) => void
  renameScene: (id: string, name: string) => void
}

const STORAGE_KEY = "gispulse:scenes"

function loadScenes(): Scene[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistScenes(scenes: Scene[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes))
}

export const useSceneStore = create<SceneState>((set, get) => ({
  scenes: loadScenes(),

  saveScene: (name, snapshot) => {
    const scene: Scene = {
      id: `scene-${Date.now()}`,
      name: name.trim() || `Scene ${get().scenes.length + 1}`,
      createdAt: Date.now(),
      snapshot,
    }
    const next = [...get().scenes, scene]
    persistScenes(next)
    set({ scenes: next })
    return scene
  },

  deleteScene: (id) =>
    set((s) => {
      const next = s.scenes.filter((sc) => sc.id !== id)
      persistScenes(next)
      return { scenes: next }
    }),

  renameScene: (id, name) =>
    set((s) => {
      const next = s.scenes.map((sc) =>
        sc.id === id ? { ...sc, name: name.trim() || sc.name } : sc
      )
      persistScenes(next)
      return { scenes: next }
    }),
}))
