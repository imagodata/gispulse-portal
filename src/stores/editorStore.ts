import { create } from "zustand"

// ---------------------------------------------------------------------------
// Node execution state (issue #33)
// ---------------------------------------------------------------------------

export type NodeExecStatus = "pending" | "running" | "success" | "failed"

export interface NodeExecState {
  status: NodeExecStatus
  error?: string
  duration_ms?: number
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface EditorState {
  // Rule editor (pre-existing)
  ruleEditorOpen: boolean
  ruleEditorId: string | null // null = creation, string = editing
  openRuleEditor: (id?: string) => void
  closeRuleEditor: () => void

  // Trigger builder (issue #38)
  triggerBuilderOpen: boolean
  triggerBuilderId: string | null
  openTriggerBuilder: (id?: string) => void
  closeTriggerBuilder: () => void

  // Scenario persistence (issue #32)
  activeScenarioId: string | null
  isGraphDirty: boolean
  setActiveScenarioId: (id: string | null) => void
  setGraphDirty: (dirty: boolean) => void

  // Graph execution (issue #33)
  nodeExecStates: Record<string, NodeExecState>
  isGraphRunning: boolean
  setNodeExecState: (nodeId: string, state: NodeExecState) => void
  setNodeExecStates: (states: Record<string, NodeExecState>) => void
  clearNodeExecStates: () => void
  setGraphRunning: (running: boolean) => void

  // Pending graph handoff (template → canvas, external → editor)
  pendingGraph: { nodes: any[]; edges: any[] } | null
  setPendingGraph: (graph: { nodes: any[]; edges: any[] } | null) => void

  // Node data update bridge (for property panel outside ReactFlowProvider)
  updateNodeDataFn: ((nodeId: string, key: string, value: unknown) => void) | null
  registerUpdateNodeData: (fn: (nodeId: string, key: string, value: unknown) => void) => void
  updateNodeData: (nodeId: string, key: string, value: unknown) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  // Rule editor
  ruleEditorOpen: false,
  ruleEditorId: null,
  openRuleEditor: (id) =>
    set({ ruleEditorOpen: true, ruleEditorId: id ?? null }),
  closeRuleEditor: () =>
    set({ ruleEditorOpen: false, ruleEditorId: null }),

  // Trigger builder
  triggerBuilderOpen: false,
  triggerBuilderId: null,
  openTriggerBuilder: (id) =>
    set({ triggerBuilderOpen: true, triggerBuilderId: id ?? null }),
  closeTriggerBuilder: () =>
    set({ triggerBuilderOpen: false, triggerBuilderId: null }),

  // Scenario persistence
  activeScenarioId: null,
  isGraphDirty: false,
  setActiveScenarioId: (id) => set({ activeScenarioId: id }),
  setGraphDirty: (dirty) => set({ isGraphDirty: dirty }),

  // Graph execution
  nodeExecStates: {},
  isGraphRunning: false,
  setNodeExecState: (nodeId, state) =>
    set((s) => ({
      nodeExecStates: { ...s.nodeExecStates, [nodeId]: state },
    })),
  setNodeExecStates: (states) => set({ nodeExecStates: states }),
  clearNodeExecStates: () => set({ nodeExecStates: {} }),
  setGraphRunning: (running) => set({ isGraphRunning: running }),

  // Pending graph handoff
  pendingGraph: null,
  setPendingGraph: (graph) => set({ pendingGraph: graph }),

  // Node data update bridge
  updateNodeDataFn: null,
  registerUpdateNodeData: (fn) => set({ updateNodeDataFn: fn }),
  updateNodeData: (nodeId, key, value) => {
    const fn = useEditorStore.getState().updateNodeDataFn
    if (fn) fn(nodeId, key, value)
  },
}))
