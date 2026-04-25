import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { toast } from "sonner"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStoreApi,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { DatasetSourceNode } from "./nodes/DatasetSourceNode"
import { CapabilityNode } from "./nodes/CapabilityNode"
import { OutputNode } from "./nodes/OutputNode"
import { BranchNode } from "./nodes/BranchNode"
import { TriggerNode } from "./nodes/TriggerNode"
import { CodeBlockNode } from "./nodes/CodeBlockNode"
import { GroupNode } from "./nodes/GroupNode"
import { withExecStatus } from "./nodes/withExecStatus"
import {
  TableSourceNode,
  SpatialOpNode,
  AggregateNode,
  TargetNode,
  CustomExpressionNode,
  ValidationNode,
  CompositeNode,
  BusinessRuleNode,
} from "./nodes/ops"
import { NodeEditorToolbar, type EditorMode } from "./NodeEditorToolbar"
import { NodePalette } from "./nodes/NodePalette"
import {
  CanvasContextMenu,
  NodeContextMenu,
  EdgeContextMenu,
  type ContextMenuPosition,
} from "./NodeEditorContextMenu"
import { useUIStore } from "@/stores/uiStore"
import { useEditorStore } from "@/stores/editorStore"
import { useWorkflowStore } from "@/stores/workflowStore"
import { useGraphExecution } from "@/hooks/useGraphExecution"
import { useUndoRedo } from "@/hooks/useUndoRedo"
import { useAutoLayout } from "@/hooks/useAutoLayout"
import { serializeGraph, graphToPipelineSpec, pipelineSpecToGraph } from "@/lib/graphSerializer"
import { createScenario, updateScenario, runScenarioNode } from "@/api/client"
import { templateToGraph } from "@/stores/templateStore"
import { SaveTemplateDialog } from "./SaveTemplateDialog"
import {
  PORT_SPECS,
  arePortTypesCompatible,
  type PortType,
} from "./nodes/portTypes"

// ---------------------------------------------------------------------------
// Node types wrapped with execution-status ring (group excluded — UI-only)
// ---------------------------------------------------------------------------

const nodeTypes = {
  datasetSource: withExecStatus(DatasetSourceNode),
  capability: withExecStatus(CapabilityNode),
  output: withExecStatus(OutputNode),
  branch: withExecStatus(BranchNode),
  trigger: withExecStatus(TriggerNode),
  codeBlock: withExecStatus(CodeBlockNode),
  group: GroupNode,
  // Trigger operation nodes
  tableSource: withExecStatus(TableSourceNode),
  spatialOp: withExecStatus(SpatialOpNode),
  aggregate: withExecStatus(AggregateNode),
  target: withExecStatus(TargetNode),
  customExpression: withExecStatus(CustomExpressionNode),
  validation: withExecStatus(ValidationNode),
  composite: withExecStatus(CompositeNode),
  businessRule: withExecStatus(BusinessRuleNode),
}

let nodeIdCounter = 0
function getNextNodeId() {
  nodeIdCounter += 1
  return `node-${Date.now()}-${nodeIdCounter}`
}

function NodeEditorInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const activeWorkflowName = useWorkflowStore((s) => s.activeWorkflowName)
  const [pipelineName, setPipelineName] = useState(activeWorkflowName || "Untitled Pipeline")
  const [debugMode, setDebugMode] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>("scenario")

  // Sync pipeline name when opening a workflow from the list
  useEffect(() => {
    if (activeWorkflowName) setPipelineName(activeWorkflowName)
  }, [activeWorkflowName])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const store = useStoreApi()

  // ------ Editor store bindings ------
  const activeScenarioId = useEditorStore((s) => s.activeScenarioId)
  const isGraphDirty = useEditorStore((s) => s.isGraphDirty)
  const isGraphRunning = useEditorStore((s) => s.isGraphRunning)
  const nodeExecStates = useEditorStore((s) => s.nodeExecStates)
  const setGraphDirty = useEditorStore((s) => s.setGraphDirty)
  const setActiveScenarioId = useEditorStore((s) => s.setActiveScenarioId)
  const clearNodeExecStates = useEditorStore((s) => s.clearNodeExecStates)

  const hasResults = useMemo(
    () => Object.keys(nodeExecStates).length > 0,
    [nodeExecStates],
  )

  const setContextSelection = useUIStore((s) => s.setContextSelection)
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen)
  const registerUpdateNodeData = useEditorStore((s) => s.registerUpdateNodeData)
  const { run: execRun } = useGraphExecution()

  // ------ Undo/Redo (Sprint W2) ------
  const { takeSnapshot, undo, redo, canUndo, canRedo, clearHistory } = useUndoRedo()

  // ------ Auto-layout (Sprint W2) ------
  const { autoLayout } = useAutoLayout()

  // ------ Snap to grid (Sprint W2) ------
  const [snapToGrid, setSnapToGrid] = useState(false)
  const snapGrid: [number, number] = [20, 20]

  // ------ Register node data update bridge for property panel ------
  useEffect(() => {
    registerUpdateNodeData((nodeId: string, key: string, value: unknown) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n
          if (key === "__config") {
            // Special: merge into config sub-object
            const prev = (n.data as Record<string, unknown>).config as Record<string, unknown> ?? {}
            const patch = value as Record<string, unknown>
            return { ...n, data: { ...n.data, config: { ...prev, ...patch } } }
          }
          return { ...n, data: { ...n.data, [key]: value } }
        })
      )
      setGraphDirty(true)
      // Also update the context selection so inspector re-renders
      const node = store.getState().nodes?.find?.((n: any) => n.id === nodeId)
      if (node) {
        setContextSelection({
          type: "node",
          nodeId: node.id,
          nodeType: node.type,
          nodeData: { ...(node.data as Record<string, unknown>), [key]: value },
        })
      }
    })
  }, [registerUpdateNodeData, setNodes, setGraphDirty, store, setContextSelection])

  // ------ Mark graph dirty on substantive node/edge changes ------
  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      const isSubstantive = changes.some(
        (c) => c.type !== "select" && c.type !== "dimensions",
      )
      // Snapshot before destructive changes (remove)
      if (changes.some((c) => c.type === "remove")) {
        takeSnapshot(nodes, edges)
      }
      onNodesChange(changes)
      if (isSubstantive) setGraphDirty(true)
    },
    [onNodesChange, setGraphDirty, takeSnapshot, nodes, edges],
  )

  const handleEdgesChange: typeof onEdgesChange = useCallback(
    (changes) => {
      if (changes.some((c) => c.type === "remove")) {
        takeSnapshot(nodes, edges)
      }
      onEdgesChange(changes)
      if (changes.some((c) => c.type !== "select")) setGraphDirty(true)
    },
    [onEdgesChange, setGraphDirty, takeSnapshot, nodes, edges],
  )

  // ------ Consume pendingGraph (from templates or external handoff) ------
  const pendingGraph = useEditorStore((s) => s.pendingGraph)
  const setPendingGraph = useEditorStore((s) => s.setPendingGraph)

  useEffect(() => {
    if (pendingGraph) {
      setNodes(pendingGraph.nodes as Node[])
      setEdges(pendingGraph.edges)
      setPendingGraph(null)
      clearHistory()
    }
  }, [pendingGraph, setNodes, setEdges, setPendingGraph, clearHistory])

  // ------ Clipboard: Copy / Paste / Duplicate / Delete ------
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id)
      const selectedEdgeIds = edges.filter((ed) => ed.selected).map((ed) => ed.id)

      // Delete / Backspace — remove selected nodes and edges
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return
        e.preventDefault()
        takeSnapshot(nodes, edges)
        setNodes((nds) => nds.filter((n) => !selectedNodeIds.includes(n.id)))
        setEdges((eds) => eds.filter((ed) =>
          !selectedEdgeIds.includes(ed.id) &&
          !selectedNodeIds.includes(ed.source) &&
          !selectedNodeIds.includes(ed.target)
        ))
        setGraphDirty(true)
        if (selectedNodeIds.length > 0) toast.success(`Deleted ${selectedNodeIds.length} node(s)`)
      }

      // Ctrl+C — copy selected nodes
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (selectedNodeIds.length === 0) return
        const selSet = new Set(selectedNodeIds)
        clipboardRef.current = {
          nodes: nodes.filter((n) => selSet.has(n.id)),
          edges: edges.filter((ed) => selSet.has(ed.source) && selSet.has(ed.target)),
        }
        toast.success(`Copied ${selectedNodeIds.length} node(s)`)
      }

      // Ctrl+V — paste from clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (!clipboardRef.current || clipboardRef.current.nodes.length === 0) return
        e.preventDefault()
        takeSnapshot(nodes, edges)
        const idMap = new Map<string, string>()
        const offset = 40
        const newNodes = clipboardRef.current.nodes.map((n) => {
          const newId = getNextNodeId()
          idMap.set(n.id, newId)
          return {
            ...n,
            id: newId,
            position: { x: n.position.x + offset, y: n.position.y + offset },
            selected: true,
            data: { ...n.data, label: `${(n.data as Record<string, unknown>).label || n.type} (copy)` },
          }
        })
        const newEdges = clipboardRef.current.edges.map((ed) => ({
          ...ed,
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source: idMap.get(ed.source) || ed.source,
          target: idMap.get(ed.target) || ed.target,
        }))
        // Deselect existing, add new
        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes])
        setEdges((eds) => [...eds, ...newEdges])
        setGraphDirty(true)
        toast.success(`Pasted ${newNodes.length} node(s)`)
      }

      // Ctrl+Z — undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        const didUndo = undo(nodes, edges, setNodes, setEdges)
        if (didUndo) {
          setGraphDirty(true)
          toast.success("Undo")
        }
      }

      // Ctrl+Shift+Z — redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault()
        const didRedo = redo(nodes, edges, setNodes, setEdges)
        if (didRedo) {
          setGraphDirty(true)
          toast.success("Redo")
        }
      }

      // Ctrl+D — duplicate selected in-place
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        if (selectedNodeIds.length === 0) return
        e.preventDefault()
        const selSet = new Set(selectedNodeIds)
        const idMap = new Map<string, string>()
        const offset = 50
        const newNodes = nodes.filter((n) => selSet.has(n.id)).map((n) => {
          const newId = getNextNodeId()
          idMap.set(n.id, newId)
          return {
            ...n,
            id: newId,
            position: { x: n.position.x + offset, y: n.position.y + offset },
            selected: true,
          }
        })
        const relatedEdges = edges.filter((ed) => selSet.has(ed.source) && selSet.has(ed.target))
        const newEdges = relatedEdges.map((ed) => ({
          ...ed,
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source: idMap.get(ed.source) || ed.source,
          target: idMap.get(ed.target) || ed.target,
        }))
        setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes])
        setEdges((eds) => [...eds, ...newEdges])
        setGraphDirty(true)
        toast.success(`Duplicated ${newNodes.length} node(s)`)
      }

      // Ctrl+A — select all nodes and edges
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault()
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
        setEdges((eds) => eds.map((ed) => ({ ...ed, selected: true })))
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [nodes, edges, setNodes, setEdges, setGraphDirty, takeSnapshot, undo, redo])

  // ------ Group / Ungroup ------
  const onGroupSelection = useCallback(() => {
    // Get selected nodes from current state
    const storeState = store.getState() as Record<string, unknown>
    const nodeInternals = storeState.nodeInternals
    let selectedNodes: Node[] = []
    if (nodeInternals instanceof Map) {
      selectedNodes = Array.from(nodeInternals.values()).filter(
        (n: Node) => n.selected && n.type !== "group",
      )
    } else {
      selectedNodes = nodes.filter((n) => n.selected && n.type !== "group")
    }

    if (selectedNodes.length < 2) {
      toast.warning("Select at least 2 nodes to group.")
      return
    }

    // Calculate bounding box
    const PADDING = 40
    const HEADER_HEIGHT = 50
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of selectedNodes) {
      const w = (n.measured?.width ?? n.width ?? 180) as number
      const h = (n.measured?.height ?? n.height ?? 60) as number
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + w)
      maxY = Math.max(maxY, n.position.y + h)
    }

    const groupId = getNextNodeId()
    const groupX = minX - PADDING
    const groupY = minY - PADDING - HEADER_HEIGHT
    const groupW = maxX - minX + PADDING * 2
    const groupH = maxY - minY + PADDING * 2 + HEADER_HEIGHT

    const groupNode: Node = {
      id: groupId,
      type: "group",
      position: { x: groupX, y: groupY },
      style: { width: groupW, height: groupH },
      data: { label: "Group", color: "blue", childCount: selectedNodes.length },
    }

    // Re-position children relative to group and set parentId
    const updatedNodes = nodes.map((n) => {
      if (selectedNodes.some((s) => s.id === n.id)) {
        return {
          ...n,
          parentId: groupId,
          extent: "parent" as const,
          position: {
            x: n.position.x - groupX,
            y: n.position.y - groupY,
          },
          selected: false,
        }
      }
      return n
    })

    setNodes([groupNode, ...updatedNodes])
  }, [nodes, setNodes, store])

  const onUngroupSelection = useCallback(() => {
    // Find selected group nodes
    const selectedGroups = nodes.filter(
      (n) => n.selected && n.type === "group",
    )
    if (selectedGroups.length === 0) {
      toast.warning("Select a group node to ungroup.")
      return
    }

    const groupIds = new Set(selectedGroups.map((g) => g.id))

    const updatedNodes = nodes
      .filter((n) => !groupIds.has(n.id))
      .map((n) => {
        if (n.parentId && groupIds.has(n.parentId)) {
          const parentGroup = selectedGroups.find((g) => g.id === n.parentId)
          return {
            ...n,
            parentId: undefined,
            extent: undefined,
            position: {
              x: n.position.x + (parentGroup?.position.x ?? 0),
              y: n.position.y + (parentGroup?.position.y ?? 0),
            },
          }
        }
        return n
      })

    setNodes(updatedNodes)
  }, [nodes, setNodes])

  // ------ Connection validation ------

  /** Check if adding an edge source→target would create a cycle (BFS). */
  const wouldCreateCycle = useCallback(
    (source: string, target: string): boolean => {
      // If target can reach source via existing edges, adding source→target creates a cycle
      const visited = new Set<string>()
      const queue = [target]
      while (queue.length > 0) {
        const current = queue.shift()!
        if (current === source) return true
        if (visited.has(current)) continue
        visited.add(current)
        for (const e of edges) {
          if (e.source === current) queue.push(e.target)
        }
      }
      return false
    },
    [edges],
  )

  /** Max incoming connections per node type (0 = unlimited). */
  const MAX_INPUTS: Partial<Record<string, number>> = {
    output: 1,
    target: 1,
    tableSource: 0, // source node, no inputs
    datasetSource: 0,
    trigger: 0,
  }

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      const { source, target } = connection
      if (!source || !target) return false

      // No self-connections
      if (source === target) return false

      // No duplicate connections (same source handle → same target handle)
      const duplicate = edges.some(
        (e) =>
          e.source === source &&
          e.target === target &&
          e.sourceHandle === connection.sourceHandle &&
          e.targetHandle === connection.targetHandle,
      )
      if (duplicate) return false

      const sourceNode = nodes.find((n) => n.id === source)
      const targetNode = nodes.find((n) => n.id === target)
      if (!sourceNode || !targetNode) return false

      const sourceType = sourceNode.type ?? ""
      const targetType = targetNode.type ?? ""

      // Source-only nodes cannot receive connections
      if (MAX_INPUTS[targetType] === 0) return false

      // Enforce max input cardinality
      const maxIn = MAX_INPUTS[targetType]
      if (maxIn && maxIn > 0) {
        const currentInputs = edges.filter((e) => e.target === target).length
        if (currentInputs >= maxIn) return false
      }

      // Trigger can only connect to capability, codeBlock, or trigger operation nodes
      if (sourceType === "trigger") {
        const triggerTargets = new Set([
          "capability", "codeBlock", "tableSource", "spatialOp",
          "aggregate", "validation", "composite", "businessRule", "customExpression",
        ])
        if (!triggerTargets.has(targetType)) return false
      }

      // Check port type compatibility
      const sourceSpec = PORT_SPECS[sourceType]
      const targetSpec = PORT_SPECS[targetType]
      if (!sourceSpec || !targetSpec) return false // reject unknown node types

      // Resolve port type by handle index for multi-output nodes (e.g. branch)
      const sourceHandleIdx = connection.sourceHandle
        ? parseInt(connection.sourceHandle, 10)
        : NaN
      const sourcePortType: PortType =
        sourceSpec.outputs.length > 0
          ? sourceSpec.outputs[Number.isFinite(sourceHandleIdx) && sourceHandleIdx < sourceSpec.outputs.length ? sourceHandleIdx : 0]
          : "any"
      const targetHandleIdx = connection.targetHandle
        ? parseInt(connection.targetHandle, 10)
        : NaN
      const targetPortType: PortType =
        targetSpec.inputs.length > 0
          ? targetSpec.inputs[Number.isFinite(targetHandleIdx) && targetHandleIdx < targetSpec.inputs.length ? targetHandleIdx : 0]
          : "any"

      if (!arePortTypesCompatible(sourcePortType, targetPortType)) return false

      // Cycle detection — prevent DAG violations
      if (wouldCreateCycle(source, target)) return false

      return true
    },
    [nodes, edges, wouldCreateCycle],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      takeSnapshot(nodes, edges)
      setEdges((eds) => addEdge({ ...connection, animated: false }, eds))
      setGraphDirty(true)
    },
    [setEdges, setGraphDirty, takeSnapshot, nodes, edges],
  )

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  // ------ Handle both palette drops and layer drops ------
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // Check for gispulse-layer drop (from DataSidebar)
      const layerRaw = event.dataTransfer.getData("application/gispulse-layer")
      if (layerRaw) {
        let layerPayload: {
          datasetId?: string
          layerName?: string
          label?: string
        }
        try {
          layerPayload = JSON.parse(layerRaw)
        } catch {
          return
        }

        const newNode: Node = {
          id: getNextNodeId(),
          type: "datasetSource",
          position,
          data: {
            label: layerPayload.label ?? layerPayload.layerName ?? "Layer",
            datasetId: layerPayload.datasetId ?? "",
            layerName: layerPayload.layerName ?? "",
          },
        }
        setNodes((nds) => [...nds, newNode])
        setGraphDirty(true)
        return
      }

      // Standard palette drop
      const raw = event.dataTransfer.getData("application/reactflow")
      if (!raw) return

      let payload: { type: string; label: string; data?: Record<string, unknown>; nodes?: any[]; edges?: any[] }
      try {
        payload = JSON.parse(raw)
      } catch {
        return
      }

      // Template drop: expand full graph at drop position
      if (payload.type === "__template" && payload.nodes && payload.edges) {
        const tpl = { nodes: payload.nodes, edges: payload.edges } as { nodes: Node[]; edges: Edge[] }
        const { nodes: newNodes, edges: newEdges } = templateToGraph(
          tpl,
          position.x,
          position.y,
        )
        setNodes((nds) => [...nds, ...newNodes])
        setEdges((eds) => [...eds, ...newEdges])
        setGraphDirty(true)
        toast.success(`Loaded template "${payload.label}" (${newNodes.length} nodes)`)
        return
      }

      const newNode: Node = {
        id: getNextNodeId(),
        type: payload.type,
        position,
        data: {
          label: payload.label,
          ...payload.data,
        },
      }

      setNodes((nds) => [...nds, newNode])
      setGraphDirty(true)
    },
    [screenToFlowPosition, setNodes, setGraphDirty],
  )

  const onValidate = useCallback(() => {
    const sourceNodes = nodes.filter(
      (n) => n.type === "datasetSource" || n.type === "trigger" || n.type === "tableSource",
    )
    const outputNodes = nodes.filter((n) => n.type === "output" || n.type === "target")
    const issues: string[] = []

    // Structural checks
    if (sourceNodes.length === 0) issues.push("No source or trigger node found.")
    if (outputNodes.length === 0) issues.push("No output or target node found.")

    const connectedNodeIds = new Set(
      edges.flatMap((e) => [e.source, e.target]),
    )
    const orphans = nodes.filter(
      (n) => !connectedNodeIds.has(n.id) && n.type !== "group",
    )
    if (orphans.length > 0 && nodes.length > 1) {
      issues.push(`${orphans.length} disconnected node(s).`)
    }

    // Node config completeness checks
    const REQUIRED_FIELDS: Record<string, string[]> = {
      datasetSource: ["datasetId"],
      tableSource: ["schema", "table"],
      spatialOp: ["field", "operation"],
      aggregate: ["distantSchema", "distantTable", "distantField", "operation"],
      target: ["distantSchema", "distantTable", "distantField"],
      customExpression: ["field", "expression"],
      businessRule: ["field", "expression"],
      validation: ["rules"],
    }

    let incompleteCount = 0
    for (const node of nodes) {
      const fields = REQUIRED_FIELDS[node.type ?? ""]
      if (!fields) continue
      const d = node.data as Record<string, unknown>
      for (const f of fields) {
        const val = d[f]
        if (val === undefined || val === null || val === "") {
          incompleteCount++
          break // one warning per node
        }
        if (Array.isArray(val) && val.length === 0 && f === "rules") {
          incompleteCount++
          break
        }
      }
    }
    if (incompleteCount > 0) {
      issues.push(`${incompleteCount} node(s) with incomplete config.`)
    }

    if (issues.length === 0) {
      toast.success("Pipeline is valid.")
    } else {
      toast.warning("Validation issues: " + issues.join(" "))
    }
  }, [nodes, edges])

  // ------ Save scenario to backend (POST or PUT) ------
  const onSave = useCallback(async () => {
    const graph = serializeGraph(nodes, edges, pipelineName)
    try {
      if (!activeScenarioId) {
        const res = await createScenario(graph)
        setActiveScenarioId(res.id)
        useWorkflowStore.getState().setActiveWorkflow(res.id, pipelineName)
      } else {
        await updateScenario(activeScenarioId, graph)
        useWorkflowStore.getState().setActiveWorkflow(activeScenarioId, pipelineName)
      }
      setGraphDirty(false)
      toast.success("Saved")
    } catch (err) {
      console.error("[NodeEditor] save failed:", err)
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [nodes, edges, pipelineName, activeScenarioId, setActiveScenarioId, setGraphDirty])

  // ------ Global keyboard shortcuts (Ctrl+S save, Ctrl+Shift+F fit) ------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S — save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        onSave()
      }
      // Ctrl+Shift+F — zoom to fit
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault()
        fitView({ padding: 0.15 })
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onSave, fitView])

  // ------ Run scenario on backend ------
  const onRun = useCallback(async () => {
    try {
      await execRun(nodes, edges, pipelineName)
    } catch (err) {
      console.error("[NodeEditor] run failed:", err)
      toast.error(`Run failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [nodes, edges, pipelineName, execRun])

  // ------ Pipeline v2: import PipelineSpec JSON ------
  const onImportPipelineV2 = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        // Accept both PipelineSpec v2 format and wrapped format
        const spec = data.version === 2 ? data : data.spec ?? data
        if (!spec.steps || !Array.isArray(spec.steps)) {
          toast.error("Invalid PipelineSpec v2: missing 'steps' array")
          return
        }
        const { nodes: newNodes, edges: newEdges } = pipelineSpecToGraph(spec)
        takeSnapshot(nodes, edges)
        setNodes(newNodes)
        setEdges(newEdges)
        if (spec.name) setPipelineName(spec.name)
        setEditorMode("pipeline")
        setGraphDirty(true)
        toast.success(`Imported pipeline "${spec.name || file.name}" (${spec.steps.length} steps)`)
      } catch (err) {
        toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    input.click()
  }, [nodes, edges, setNodes, setEdges, takeSnapshot, setGraphDirty])

  // ------ Pipeline v2: export as PipelineSpec JSON ------
  const onExportPipelineV2 = useCallback(() => {
    const spec = graphToPipelineSpec(nodes, edges, pipelineName)
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${pipelineName.replace(/\s+/g, "_").toLowerCase()}.pipeline.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported as PipelineSpec v2")
  }, [nodes, edges, pipelineName])

  // ------ Pipeline v2: run via /pipelines/execute API ------
  const onRunPipeline = useCallback(async () => {
    const { setGraphRunning, setNodeExecStates, clearNodeExecStates: clear } =
      useEditorStore.getState()

    clear()
    setGraphRunning(true)

    // Mark all nodes as pending
    const pending: Record<string, { status: "pending" | "running" | "success" | "failed" }> = {}
    for (const n of nodes) {
      if (n.type !== "group") pending[n.id] = { status: "pending" }
    }
    setNodeExecStates(pending)

    try {
      const spec = graphToPipelineSpec(nodes, edges, pipelineName)

      // Find dataset source node with a dataset_id or input_path
      const dsNode = nodes.find((n) => n.type === "datasetSource")
      const dsData = dsNode?.data as Record<string, unknown> | undefined
      const datasetId = (dsData?.datasetId as string) ?? null
      const inputPath = (dsData?.sourcePath as string) ?? (dsData?.filePath as string) ?? null

      const { executePipeline } = await import("@/api/pipelines")
      const result = await executePipeline({
        name: spec.name,
        steps: spec.steps,
        ref_layers: spec.ref_layers ?? {},
        dataset_id: datasetId,
        input_path: inputPath,
      })

      // Map results to node exec states
      const states: Record<string, { status: "pending" | "running" | "success" | "failed"; duration_ms?: number }> = {}
      for (const sr of result.step_results) {
        states[sr.step_id] = { status: "success" }
      }
      // Mark unreported nodes as success
      for (const n of nodes) {
        if (n.type !== "group" && !states[n.id]) {
          states[n.id] = { status: "success" }
        }
      }
      setNodeExecStates(states)
      toast.success(
        `Pipeline executed: ${result.steps_executed} steps, ${result.total_features_out} features out`,
      )
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const failStates: Record<string, { status: "failed"; error: string }> = {}
      for (const n of nodes) {
        if (n.type !== "group") failStates[n.id] = { status: "failed", error: errMsg }
      }
      setNodeExecStates(failStates)
      toast.error(`Pipeline failed: ${errMsg}`)
    } finally {
      setGraphRunning(false)
    }
  }, [nodes, edges, pipelineName])

  // ------ Clear execution results ------
  const onClearResults = useCallback(() => {
    clearNodeExecStates()
  }, [clearNodeExecStates])

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)

  const onSaveTemplate = useCallback(() => {
    setSaveTemplateOpen(true)
  }, [])

  // ------ Auto-layout (Sprint W2) ------
  const onAutoLayout = useCallback(() => {
    if (nodes.length === 0) return
    takeSnapshot(nodes, edges)
    const result = autoLayout(nodes, edges, "TB")
    setNodes(result.nodes)
    setEdges(result.edges)
    setGraphDirty(true)
    toast.success("Auto-layout applied")
    // Fit view after layout with a small delay for render
    setTimeout(() => fitView({ padding: 0.15 }), 50)
  }, [nodes, edges, takeSnapshot, autoLayout, setNodes, setEdges, setGraphDirty, fitView])

  // ------ Snap to grid toggle (Sprint W2) ------
  const onSnapToggle = useCallback(() => {
    setSnapToGrid((s) => !s)
  }, [])

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setContextSelection({
      type: "node",
      nodeId: node.id,
      nodeType: node.type,
      nodeData: node.data as Record<string, unknown>,
    })
  }, [setContextSelection])

  const onDebugToggle = useCallback(() => setDebugMode((d) => !d), [])

  // ------ Context menu state ------
  type CtxMenu =
    | { type: "canvas"; position: ContextMenuPosition }
    | { type: "node"; position: ContextMenuPosition; nodeId: string; nodeLabel: string }
    | { type: "edge"; position: ContextMenuPosition; edgeId: string }
    | null

  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null)
  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      setCtxMenu({ type: "canvas", position: { x: event.clientX, y: event.clientY } })
    },
    [],
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      setCtxMenu({
        type: "node",
        position: { x: event.clientX, y: event.clientY },
        nodeId: node.id,
        nodeLabel: (node.data as Record<string, unknown>).label as string ?? node.type ?? "",
      })
    },
    [],
  )

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      setCtxMenu({
        type: "edge",
        position: { x: event.clientX, y: event.clientY },
        edgeId: edge.id,
      })
    },
    [],
  )

  // Context menu actions
  const ctxSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
    setEdges((eds) => eds.map((e) => ({ ...e, selected: true })))
  }, [setNodes, setEdges])

  const ctxDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setGraphDirty(true)
      toast.success("Node deleted")
    },
    [setNodes, setEdges, setGraphDirty],
  )

  const ctxDuplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      const newId = getNextNodeId()
      const newNode: Node = {
        ...node,
        id: newId,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        selected: true,
      }
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode])
      setGraphDirty(true)
      toast.success("Node duplicated")
    },
    [nodes, setNodes, setGraphDirty],
  )

  const ctxDisconnectNode = useCallback(
    (nodeId: string) => {
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      setGraphDirty(true)
      toast.success("Node disconnected")
    },
    [setEdges, setGraphDirty],
  )

  const ctxCopyNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      const relatedEdges = edges.filter((e) => e.source === nodeId || e.target === nodeId)
      clipboardRef.current = { nodes: [node], edges: relatedEdges }
      toast.success("Copied to clipboard")
    },
    [nodes, edges],
  )

  const ctxDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId))
      setGraphDirty(true)
      toast.success("Connection deleted")
    },
    [setEdges, setGraphDirty],
  )

  const setNodeExecState = useEditorStore((s) => s.setNodeExecState)
  const ctxRunNode = useCallback(
    async (nodeId: string) => {
      if (!activeScenarioId) {
        toast.error("Save the scenario first before running a node.")
        return
      }
      setNodeExecState(nodeId, { status: "running" })
      try {
        const result = await runScenarioNode(activeScenarioId, nodeId, {})
        setNodeExecState(nodeId, {
          status: result.status === "success" ? "success" : "failed",
          duration_ms: result.duration_ms,
          error: result.error ?? undefined,
        })
        if (result.status === "success") {
          toast.success(`Node ran successfully (${result.output_count ?? 0} features, ${result.duration_ms}ms)`)
        } else {
          toast.error(`Node failed: ${result.error ?? "Unknown error"}`)
        }
      } catch (err) {
        setNodeExecState(nodeId, { status: "failed", error: String(err) })
        toast.error(`Run failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [activeScenarioId, setNodeExecState],
  )

  const ctxPaste = useCallback(() => {
    if (!clipboardRef.current || clipboardRef.current.nodes.length === 0) {
      toast.info("Nothing to paste")
      return
    }
    const idMap = new Map<string, string>()
    const newNodes = clipboardRef.current.nodes.map((n) => {
      const newId = getNextNodeId()
      idMap.set(n.id, newId)
      return { ...n, id: newId, position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: true }
    })
    const newEdges = clipboardRef.current.edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({
        ...e,
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: idMap.get(e.source) || e.source,
        target: idMap.get(e.target) || e.target,
      }))
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes])
    setEdges((eds) => [...eds, ...newEdges])
    setGraphDirty(true)
    toast.success(`Pasted ${newNodes.length} node(s)`)
  }, [setNodes, setEdges, setGraphDirty])

  // ------ Export current workflow as JSON ------
  const onExportJSON = useCallback(() => {
    const { exportWorkflow } = useWorkflowStore.getState()
    const exported = exportWorkflow(nodes, edges, pipelineName)
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${pipelineName.replace(/\s+/g, "_").toLowerCase()}.workflow.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Workflow exported as JSON")
  }, [nodes, edges, pipelineName])

  // ------ Styled edges with execution state feedback ------
  const styledEdges = useMemo(() => {
    if (isGraphRunning) {
      return edges.map((e) => ({ ...e, animated: true }))
    }
    if (!hasResults) return edges
    return edges.map((e) => {
      const sourceState = nodeExecStates[e.source]
      if (!sourceState) return e
      if (sourceState.status === "success") {
        return { ...e, style: { ...e.style, stroke: "var(--gp-node-source)", strokeWidth: 2.5 } }
      }
      if (sourceState.status === "failed") {
        return { ...e, style: { ...e.style, stroke: "var(--gp-node-trigger)", strokeWidth: 2.5 } }
      }
      return e
    })
  }, [edges, isGraphRunning, hasResults, nodeExecStates])

  return (
    <div className="h-full w-full flex flex-col">
      <NodeEditorToolbar
        pipelineName={pipelineName}
        onPipelineNameChange={setPipelineName}
        onValidate={onValidate}
        onSave={onSave}
        onSaveTemplate={onSaveTemplate}
        onExportJSON={onExportJSON}
        onImportPipelineV2={onImportPipelineV2}
        onExportPipelineV2={onExportPipelineV2}
        onRun={editorMode === "pipeline" ? onRunPipeline : onRun}
        onClearResults={onClearResults}
        debugMode={debugMode}
        onDebugToggle={onDebugToggle}
        isRunning={isGraphRunning}
        isDirty={isGraphDirty}
        hasResults={hasResults}
        onGroupSelection={onGroupSelection}
        onUngroupSelection={onUngroupSelection}
        editorMode={editorMode}
        onModeChange={setEditorMode}
        onUndo={() => undo(nodes, edges, setNodes, setEdges) && setGraphDirty(true)}
        onRedo={() => redo(nodes, edges, setNodes, setEdges) && setGraphDirty(true)}
        canUndo={canUndo()}
        canRedo={canRedo()}
        onAutoLayout={onAutoLayout}
        snapToGrid={snapToGrid}
        onSnapToggle={onSnapToggle}
        onZoomFit={() => fitView({ padding: 0.15 })}
      />
      <div className="flex flex-1 min-h-0">
        {!leftPanelOpen && <NodePalette />}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={styledEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeClick={onNodeClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid={snapToGrid}
            snapGrid={snapGrid}
            defaultEdgeOptions={{
              style: { strokeWidth: 2, stroke: "var(--border)" },
              type: "smoothstep",
            }}
            className="bg-muted/20"
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={snapToGrid ? BackgroundVariant.Lines : BackgroundVariant.Dots}
              gap={snapToGrid ? 20 : 16}
              size={snapToGrid ? 0.5 : 1}
              color={snapToGrid ? "var(--border)" : undefined}
            />
            <Controls position="top-right" />
            <MiniMap
              position="bottom-right"
              className="!bg-background border border-border rounded"
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
            {debugMode && (
              <div className="absolute top-2 left-2 z-10 rounded border border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-label font-mono text-amber-700 dark:text-amber-300 shadow-sm">
                Nodes: {nodes.length} | Edges: {edges.length} | Debug ON
                {activeScenarioId && ` | Scenario: ${activeScenarioId.slice(0, 8)}`}
              </div>
            )}
            {/* Empty state — shown when canvas has no nodes (#211) */}
            {nodes.length === 0 && (
              <div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
                aria-label="Empty workflow canvas"
              >
                <div className="rounded-xl border border-dashed border-border bg-background/60 px-8 py-6 shadow-sm backdrop-blur-sm">
                  <p className="text-sm font-medium text-muted-foreground">
                    Drag a node from the palette to start building your workflow
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Drag nodes from the palette on the left to get started
                  </p>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>
      </div>
      <SaveTemplateDialog
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        nodes={nodes}
        edges={edges}
        defaultName={pipelineName}
      />

      {/* Context menus */}
      {ctxMenu?.type === "canvas" && (
        <CanvasContextMenu
          position={ctxMenu.position}
          onClose={closeCtxMenu}
          onPaste={ctxPaste}
          onZoomFit={() => fitView({ padding: 0.2 })}
          onSelectAll={ctxSelectAll}
        />
      )}
      {ctxMenu?.type === "node" && (
        <NodeContextMenu
          position={ctxMenu.position}
          nodeId={ctxMenu.nodeId}
          nodeLabel={ctxMenu.nodeLabel}
          onClose={closeCtxMenu}
          onDuplicate={() => ctxDuplicateNode(ctxMenu.nodeId)}
          onDelete={() => ctxDeleteNode(ctxMenu.nodeId)}
          onDisconnect={() => ctxDisconnectNode(ctxMenu.nodeId)}
          onCopy={() => ctxCopyNode(ctxMenu.nodeId)}
          onRunNode={() => ctxRunNode(ctxMenu.nodeId)}
        />
      )}
      {ctxMenu?.type === "edge" && (
        <EdgeContextMenu
          position={ctxMenu.position}
          edgeId={ctxMenu.edgeId}
          onClose={closeCtxMenu}
          onDelete={() => ctxDeleteEdge(ctxMenu.edgeId)}
        />
      )}
    </div>
  )
}

export function NodeEditor() {
  return (
    <ReactFlowProvider>
      <NodeEditorInner />
    </ReactFlowProvider>
  )
}
