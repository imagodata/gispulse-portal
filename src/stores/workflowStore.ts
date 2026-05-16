/**
 * workflowStore — Centralized workflow/scenario management.
 *
 * Sprint W1: replaces the ephemeral useState hooks in ScenarioBar/ScenariosPanel.
 * Wired to backend API (GET /scenarios, DELETE /scenarios/:id).
 * Manages the list view, active workflow selection, and export/import.
 */

import { create } from "zustand"
import {
  listScenarios,
  deleteScenario as deleteScenarioApi,
  getScenario,
} from "@/api/scenarios"
import {
  deserializeGraph,
  pipelineSpecToGraph,
  serializeGraph,
  type ScenarioGraph,
} from "@/lib/graphSerializer"
import type { Node, Edge } from "@xyflow/react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowView = "list" | "editor"

export interface WorkflowSummary {
  id: string
  name: string
  version: number
  created_at: string
  metadata: Record<string, unknown>
  node_count: number
  domain?: string
}

// ---------------------------------------------------------------------------
// Export format for JSON import/export
// ---------------------------------------------------------------------------

export interface WorkflowExport {
  format: "gispulse-workflow"
  version: 1
  name: string
  description: string
  domain: string
  exported_at: string
  graph: ScenarioGraph
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface WorkflowState {
  // View mode
  view: WorkflowView
  setView: (view: WorkflowView) => void

  // Workflow list
  workflows: WorkflowSummary[]
  total: number
  isLoading: boolean
  error: string | null
  searchQuery: string
  setSearchQuery: (q: string) => void

  // CRUD
  fetchWorkflows: () => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  openWorkflow: (id: string) => Promise<{ nodes: Node[]; edges: Edge[] } | null>

  // Active workflow in editor
  activeWorkflowId: string | null
  activeWorkflowName: string | null
  setActiveWorkflow: (id: string | null, name?: string | null) => void

  // Export/Import
  exportWorkflow: (nodes: Node[], edges: Edge[], name: string, description?: string, domain?: string) => WorkflowExport
  parseImport: (json: string) => { graph: ScenarioGraph; name: string } | null
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  // View mode
  view: "list",
  setView: (view) => set({ view }),

  // Workflow list
  workflows: [],
  total: 0,
  isLoading: false,
  error: null,
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),

  // Active workflow
  activeWorkflowId: null,
  activeWorkflowName: null,
  setActiveWorkflow: (id, name) =>
    set({ activeWorkflowId: id, activeWorkflowName: name ?? null }),

  // Fetch workflows from backend
  fetchWorkflows: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await listScenarios(100, 0)
      const summaries: WorkflowSummary[] = res.items.map((s) => ({
        id: s.id,
        name: s.name,
        version: s.version,
        created_at: s.created_at,
        metadata: s.metadata,
        node_count: (s.metadata?.graph as any)?.nodes?.length ?? 0,
        domain: (s.metadata?.domain as string) ?? undefined,
      }))
      set({ workflows: summaries, total: res.total, isLoading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      })
    }
  },

  // Delete workflow
  deleteWorkflow: async (id) => {
    await deleteScenarioApi(id)
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      total: s.total - 1,
      ...(s.activeWorkflowId === id
        ? { activeWorkflowId: null, activeWorkflowName: null }
        : {}),
    }))
  },

  // Open a workflow: fetch full data and return graph for the editor
  openWorkflow: async (id) => {
    try {
      const scenario = await getScenario(id)
      const graph = scenario.metadata?.graph as ScenarioGraph | undefined
      if (!graph || !graph.nodes) return null

      const { nodes, edges } = deserializeGraph(graph)
      set({
        activeWorkflowId: id,
        activeWorkflowName: scenario.name,
        view: "editor",
      })
      return { nodes, edges }
    } catch {
      return null
    }
  },

  // Export current graph as JSON
  exportWorkflow: (nodes, edges, name, description = "", domain = "custom") => {
    const graph = serializeGraph(nodes, edges, name)
    return {
      format: "gispulse-workflow",
      version: 1,
      name,
      description,
      domain,
      exported_at: new Date().toISOString(),
      graph,
    }
  },

  // Parse an imported JSON file
  parseImport: (json) => {
    try {
      const data = JSON.parse(json)
      // Support WorkflowExport, raw ScenarioGraph, and PipelineSpec v2
      if (data.format === "gispulse-workflow" && data.graph) {
        return { graph: data.graph, name: data.name || "Imported Workflow" }
      }
      if (data.nodes && data.edges) {
        return { graph: data as ScenarioGraph, name: data.name || "Imported Workflow" }
      }
      // PipelineSpec v2: convert steps to ScenarioGraph
      if (data.version === 2 && Array.isArray(data.steps)) {
        const { nodes, edges } = pipelineSpecToGraph(data)
        const graph: ScenarioGraph = {
          name: data.name || "Imported Pipeline",
          nodes: nodes.map((n: any) => ({
            id: n.id,
            type: n.type === "datasetSource" ? "dataset" : n.type,
            label: (n.data as any)?.label ?? n.id,
            config: n.data ?? {},
            position: n.position,
          })),
          edges: edges.map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            source_handle: null,
            target_handle: null,
          })),
        }
        return { graph, name: data.name || "Imported Pipeline" }
      }
      return null
    } catch {
      return null
    }
  },
}))
