import { create } from "zustand"
import type { Project, Rule, Trigger } from "@/types/project"
import * as api from "@/api/client"
import { useDatasetStore } from "@/stores/datasetStore"

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  rules: Rule[]
  triggers: Trigger[]
  loading: boolean

  // Project actions
  fetchProjects: () => Promise<void>
  createProject: (name: string, description?: string) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  setActiveProject: (id: string | null) => void

  // Rule actions
  fetchRules: () => Promise<void>
  createRule: (rule: Omit<Rule, "id">) => Promise<Rule>
  toggleRule: (id: string, enabled: boolean) => Promise<void>
  deleteRule: (id: string) => Promise<void>

  // Trigger actions
  fetchTriggers: () => Promise<void>
  createTrigger: (trigger: Omit<Trigger, "id">) => Promise<Trigger>
  updateTrigger: (id: string, trigger: Omit<Trigger, "id">) => Promise<Trigger>
  toggleTrigger: (id: string) => Promise<void>
  deleteTrigger: (id: string) => Promise<void>
}

// Guard against race conditions when switching projects rapidly
let activeProjectVersion = 0

function loadPersistedProject(): string | null {
  return localStorage.getItem("gispulse:activeProject")
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: loadPersistedProject(),
  rules: [],
  triggers: [],
  loading: false,

  fetchProjects: async () => {
    const raw = await api.listProjects()
    const projects = Array.isArray(raw) ? raw : []
    set({ projects })

    // If we have a persisted active project, validate it still exists and load its data
    const activeId = get().activeProjectId
    if (activeId) {
      const found = projects.find((p) => p.id === activeId)
      if (found) {
        get().fetchRules()
        get().fetchTriggers()
        useDatasetStore.getState().fetchDatasets()
      } else {
        // Project no longer exists — clear
        localStorage.removeItem("gispulse:activeProject")
        set({ activeProjectId: null })
      }
    }
  },

  createProject: async (name, description = "") => {
    set({ loading: true })
    try {
      const project = await api.createProject(name, description)
      set((s) => ({ projects: [...s.projects, project] }))
      return project
    } finally {
      set({ loading: false })
    }
  },

  deleteProject: async (id) => {
    await api.deleteProjectApi(id)
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    }))
    if (get().activeProjectId === null) {
      localStorage.removeItem("gispulse:activeProject")
    }
  },

  setActiveProject: (id) => {
    const version = ++activeProjectVersion
    set({ activeProjectId: id, loading: true })
    if (id) {
      localStorage.setItem("gispulse:activeProject", id)
      // Fetch project data in parallel, but guard against stale responses
      Promise.all([
        api.listRules().catch(() => [] as Rule[]),
        api.listTriggers().catch(() => [] as Trigger[]),
        useDatasetStore.getState().fetchDatasets().catch(() => {}),
      ]).then(([rules, triggers]) => {
        // Only apply if this is still the active project (no newer switch)
        if (activeProjectVersion === version) {
          set({ rules, triggers, loading: false })
        }
      })
    } else {
      localStorage.removeItem("gispulse:activeProject")
      set({ rules: [], triggers: [], loading: false })
      useDatasetStore.getState().setDatasets([])
    }
  },

  fetchRules: async () => {
    try {
      const rules = await api.listRules()
      set({ rules })
    } catch {
      set({ rules: [] })
    }
  },

  createRule: async (rule) => {
    const created = await api.createRuleApi(rule)
    set((s) => ({ rules: [...s.rules, created] }))
    return created
  },

  toggleRule: async (id, enabled) => {
    const rule = get().rules.find((r) => r.id === id)
    if (!rule) return
    const updated = await api.updateRuleApi(id, { ...rule, enabled })
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? updated : r)) }))
  },

  deleteRule: async (id) => {
    await api.deleteRuleApi(id)
    set((s) => ({ rules: s.rules.filter((r) => r.id !== id) }))
  },

  fetchTriggers: async () => {
    try {
      const triggers = await api.listTriggers()
      set({ triggers })
    } catch {
      set({ triggers: [] })
    }
  },

  createTrigger: async (trigger) => {
    const created = await api.createTriggerApi(trigger)
    set((s) => ({ triggers: [...s.triggers, created] }))
    return created
  },

  updateTrigger: async (id, trigger) => {
    const updated = await api.updateTriggerApi(id, trigger)
    set((s) => ({ triggers: s.triggers.map((t) => (t.id === id ? updated : t)) }))
    return updated
  },

  toggleTrigger: async (id) => {
    const toggled = await api.toggleTriggerApi(id)
    set((s) => ({ triggers: s.triggers.map((t) => (t.id === id ? toggled : t)) }))
  },

  deleteTrigger: async (id) => {
    await api.deleteTriggerApi(id)
    set((s) => ({ triggers: s.triggers.filter((t) => t.id !== id) }))
  },
}))

/** Derived selector: active project */
export const useActiveProject = (): Project | null => {
  const { projects, activeProjectId } = useProjectStore()
  if (!activeProjectId) return null
  const list = Array.isArray(projects) ? projects : []
  return list.find((p) => p.id === activeProjectId) ?? null
}
