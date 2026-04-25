import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { useDatasetStore } from "@/stores/datasetStore"
import { useUIStore } from "@/stores/uiStore"
import { useRelationStore } from "@/stores/relationStore"
import { useProjectStore } from "@/stores/projectStore"
import type { DatasetMeta, LayerMeta } from "@/types/dataset"
import { Badge } from "@/components/ui/badge"
import { Activity, Zap, Plus, Link2, Eye, Trash2, Search } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { SchemaLayerNode } from "@/components/nodes/SchemaLayerNode"
import { HybridRelationEdge, type HybridEdgeData } from "@/components/edges/HybridRelationEdge"
import { createTriggerApi } from "@/api/projects"
import { detectRelationsApi } from "@/api/relations"
import { useLiveEventStore } from "@/hooks/useLiveEvents"
import { AddComputationForm as AddComputationFormShared } from "@/components/AddComputationForm"
import type { TableRelation } from "@/api/relations"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnrichedLayer extends LayerMeta {
  datasetId: string
  datasetName: string
}

interface EdgeContextMenu {
  x: number
  y: number
  edgeId: string
  relationId?: string
  sourceLayer: string
  targetLayer: string
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function bboxOverlaps(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  if (!a || !b || a.length < 4 || b.length < 4) return false
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

const IGNORED_FIELDS = new Set([
  "id", "fid", "ogc_fid", "gid", "geometry", "geom", "shape", "the_geom",
])

// ---------------------------------------------------------------------------
// Local relation detection (client-side fallback)
// ---------------------------------------------------------------------------

interface LocalRelation {
  id: string
  sourceLayer: string
  targetLayer: string
  type: "attribute" | "spatial" | "topological" | "custom"
  label: string
  confidence: number
  spatialOp?: string | null
}

function detectLocalRelations(datasets: DatasetMeta[]): LocalRelation[] {
  const relations: LocalRelation[] = []
  const allLayers: EnrichedLayer[] = datasets.flatMap((ds) =>
    (ds.layers ?? []).map((l) => ({ ...l, datasetId: ds.id, datasetName: ds.name })),
  )

  for (let i = 0; i < allLayers.length; i++) {
    for (let j = i + 1; j < allLayers.length; j++) {
      const a = allLayers[i]
      const b = allLayers[j]

      // Attribute matches
      const commonFields = a.fields.filter(
        (fa) =>
          !IGNORED_FIELDS.has(fa.name.toLowerCase()) &&
          b.fields.some((fb) => fa.name === fb.name),
      )
      if (commonFields.length > 0) {
        relations.push({
          id: `local-attr-${a.name}-${b.name}`,
          sourceLayer: a.name,
          targetLayer: b.name,
          type: "attribute",
          label: commonFields.map((f) => f.name).join(", "),
          confidence: Math.min(0.5 + commonFields.length * 0.15, 0.95),
        })
      }

      // Spatial overlap
      if (a.crs && b.crs && a.crs === b.crs && bboxOverlaps(a.bbox, b.bbox)) {
        relations.push({
          id: `local-spatial-${a.name}-${b.name}`,
          sourceLayer: a.name,
          targetLayer: b.name,
          type: "spatial",
          label: "Overlapping extent",
          confidence: 0.6,
          spatialOp: "intersects",
        })
      }
    }
  }
  return relations
}

// ---------------------------------------------------------------------------
// Auto-layout: grid grouped by dataset
// ---------------------------------------------------------------------------

const NODE_WIDTH = 260
const NODE_HEIGHT = 240
const H_GAP = 80
const V_GAP = 60
const DATASET_GAP = 120

function autoLayout(
  datasets: DatasetMeta[],
  relations: TableRelation[],
): { nodes: Node[]; layerNameIndex: Map<string, string[]> } {
  const nodes: Node[] = []
  // Map layer name → all nodeIds (handles duplicate names across datasets)
  const layerNameIndex = new Map<string, string[]>()

  // Build computed fields lookup: layerName -> ComputedField[]
  const computedByLayer = new Map<string, TableRelation["computed_fields"]>()
  for (const rel of relations) {
    if (rel.computed_fields.length > 0 && rel.target_layer_name) {
      const existing = computedByLayer.get(rel.target_layer_name) ?? []
      computedByLayer.set(rel.target_layer_name, [...existing, ...rel.computed_fields])
    }
  }

  let xOffset = 40

  for (const ds of datasets) {
    const cols = Math.max(1, Math.ceil(Math.sqrt((ds.layers ?? []).length)))
    for (let idx = 0; idx < (ds.layers ?? []).length; idx++) {
      const layer = (ds.layers ?? [])[idx]
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const nodeId = `schema-${ds.id}-${layer.name}`
      const existing = layerNameIndex.get(layer.name) ?? []
      layerNameIndex.set(layer.name, [...existing, nodeId])

      const nodeData: Record<string, unknown> = {
        datasetId: ds.id,
        layerName: layer.name,
        geometryType: layer.geometry_type,
        featureCount: layer.feature_count,
        datasetName: ds.name,
        fields: layer.fields,
        computedFields: computedByLayer.get(layer.name),
      }

      nodes.push({
        id: nodeId,
        type: "schemaLayer",
        position: {
          x: xOffset + col * (NODE_WIDTH + H_GAP),
          y: 40 + row * (NODE_HEIGHT + V_GAP),
        },
        data: nodeData,
      })
    }
    const colCount = Math.max(1, Math.ceil(Math.sqrt((ds.layers ?? []).length)))
    xOffset += colCount * (NODE_WIDTH + H_GAP) + DATASET_GAP
  }

  return { nodes, layerNameIndex }
}

// ---------------------------------------------------------------------------
// Build edges from persisted + local relations
// ---------------------------------------------------------------------------

function buildEdges(
  persistedRelations: TableRelation[],
  localRelations: LocalRelation[],
  layerNameIndex: Map<string, string[]>,
  triggerMap?: Map<string, boolean>,
): Edge[] {
  const edges: Edge[] = []
  const seen = new Set<string>()
  const findNode = (name: string) => (layerNameIndex.get(name) ?? [])[0]

  // Persisted relations first (higher priority)
  for (const rel of persistedRelations) {
    const sourceId = findNode(rel.source_layer_name)
    const targetId = findNode(rel.target_layer_name)
    if (!sourceId || !targetId) continue

    const pairKey = `${rel.source_layer_name}::${rel.target_layer_name}::${rel.relation_type}`
    seen.add(pairKey)

    const edgeData: Record<string, unknown> = {
      relationType: rel.relation_type,
      label: rel.label,
      confidence: rel.confidence,
      spatialOp: rel.spatial_op,
      confirmed: rel.confirmed,
      triggerId: rel.trigger_id,
      triggerEnabled: rel.trigger_id ? (triggerMap?.get(rel.trigger_id) ?? true) : false,
      computedFieldCount: rel.computed_fields.length,
      relationId: rel.id,
    }

    edges.push({
      id: `rel-${rel.id}`,
      source: sourceId,
      target: targetId,
      sourceHandle: rel.source_field ? `field-${rel.source_field}` : "geom-out",
      targetHandle: rel.target_field ? `field-${rel.target_field}-in` : "geom-in",
      type: "hybridRelation",
      data: edgeData,
    })
  }

  // Local (detected) relations as fallback
  for (const lr of localRelations) {
    const pairKey = `${lr.sourceLayer}::${lr.targetLayer}::${lr.type}`
    if (seen.has(pairKey)) continue

    const sourceId = findNode(lr.sourceLayer)
    const targetId = findNode(lr.targetLayer)
    if (!sourceId || !targetId) continue

    const edgeData: Record<string, unknown> = {
      relationType: lr.type,
      label: lr.label,
      confidence: lr.confidence,
      spatialOp: lr.spatialOp,
      confirmed: false,
      triggerId: null,
      computedFieldCount: 0,
    }

    edges.push({
      id: lr.id,
      source: sourceId,
      target: targetId,
      sourceHandle: "geom-out",
      targetHandle: "geom-in",
      type: "hybridRelation",
      data: edgeData,
    })
  }

  return edges
}

// ---------------------------------------------------------------------------
// Node types & edge types
// ---------------------------------------------------------------------------

const nodeTypes = {
  schemaLayer: SchemaLayerNode,
}

const edgeTypes = {
  hybridRelation: HybridRelationEdge,
}

// ---------------------------------------------------------------------------
// Pulse Suggestions Panel
// ---------------------------------------------------------------------------

function PulseSuggestionsPanel({
  localRelations,
  persistedIds,
  onPersist,
  onIgnore,
}: {
  localRelations: LocalRelation[]
  persistedIds: Set<string>
  onPersist: (rel: LocalRelation) => void
  onIgnore: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set())

  const pending = localRelations.filter(
    (r) => !persistedIds.has(`${r.sourceLayer}::${r.targetLayer}::${r.type}`) && !ignoredIds.has(r.id),
  )

  const handleIgnore = useCallback((id: string) => {
    setIgnoredIds((prev) => new Set([...prev, id]))
    onIgnore(id)
  }, [onIgnore])

  if (pending.length === 0) return null

  return (
    <div className="absolute bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur z-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
          Pulse Suggestions ({pending.length})
        </span>
        <span className="text-muted-foreground">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2 max-h-48 overflow-auto">
          {pending.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0"
            >
              <Badge variant="secondary" className="shrink-0 font-mono">
                {Math.round(s.confidence * 100)}%
              </Badge>
              <span className="text-muted-foreground shrink-0">[{s.type}]</span>
              <span className="truncate text-foreground">
                <span className="font-medium">{s.sourceLayer}</span>
                {" \u2194 "}
                <span className="font-medium">{s.targetLayer}</span>
                {" \u2014 "}
                {s.label}
              </span>
              <div className="flex gap-1 shrink-0 ml-auto">
                <button
                  onClick={() => onPersist(s)}
                  className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors text-label font-medium"
                >
                  Persist
                </button>
                <button
                  onClick={() => handleIgnore(s.id)}
                  className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors text-label font-medium"
                >
                  Ignore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detection loader badge
// ---------------------------------------------------------------------------

function DetectionBadge({
  detecting,
  resultCount,
}: {
  detecting: boolean
  resultCount: number | null
}) {
  const [showResult, setShowResult] = useState(false)

  useEffect(() => {
    if (resultCount !== null && !detecting) {
      setShowResult(true)
      const timer = setTimeout(() => setShowResult(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [resultCount, detecting])

  if (!detecting && !showResult) return null

  return (
    <div className="absolute top-3 right-14 z-20 flex items-center gap-2 rounded-md border bg-background/95 px-3 py-1.5 shadow-sm backdrop-blur text-xs">
      {detecting ? (
        <>
          <svg
            className="animate-spin h-3.5 w-3.5 text-violet-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-muted-foreground">Analyzing relations...</span>
        </>
      ) : (
        <span
          className="text-muted-foreground transition-opacity duration-700"
          style={{ opacity: showResult ? 1 : 0 }}
        >
          {resultCount} relation{resultCount !== 1 ? "s" : ""} detected
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-8">
      <div className="text-4xl mb-3 opacity-30">{"\u25C7"}</div>
      <h3 className="text-sm font-semibold text-foreground mb-1">No datasets loaded</h3>
      <p className="text-xs text-muted-foreground max-w-xs">
        Load datasets to see the schema diagram. Layers, fields, and
        relationships between them will appear here automatically.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SchemaView (main component)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Floating forms (appear at context menu position)
// ---------------------------------------------------------------------------

function FloatingTriggerPicker({
  x,
  y,
  relationId,
  sourceName,
  targetName,
  onClose,
}: {
  x: number
  y: number
  relationId: string
  sourceName: string
  targetName: string
  onClose: () => void
}) {
  const triggers = useProjectStore((s) => s.triggers)
  const attachTrigger = useRelationStore((s) => s.attachTrigger)
  const fetchTriggers = useProjectStore((s) => s.fetchTriggers)
  const [creating, setCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchTriggers() }, [fetchTriggers])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  const handleAttach = useCallback(async (triggerId: string) => {
    try {
      await attachTrigger(relationId, triggerId)
      toast.success("Trigger attached")
      onClose()
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [relationId, attachTrigger, onClose])

  const handleQuickCreate = useCallback(async () => {
    setCreating(true)
    try {
      const trigger = await createTriggerApi({
        name: `auto_${sourceName}_${targetName}`,
        description: `Auto-trigger: ${sourceName} \u2192 ${targetName}`,
        event: "data_changed",
        trigger_type: "dml",
        category: "data",
        severity: "info",
        conditions: { table: sourceName, events: ["INSERT", "UPDATE", "DELETE"] },
        enabled: true,
      })
      await fetchTriggers()
      await attachTrigger(relationId, trigger.id)
      toast.success(`Trigger "${trigger.name}" created and attached`)
      onClose()
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setCreating(false)
    }
  }, [relationId, sourceName, targetName, attachTrigger, fetchTriggers, onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[260px] rounded-lg border bg-background shadow-xl text-xs"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-2 border-b font-medium flex items-center gap-1.5">
        <Activity size={12} className="text-cyan-500" />
        Attach Trigger
      </div>

      {/* Quick create */}
      <button
        onClick={handleQuickCreate}
        disabled={creating}
        className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center gap-2 border-b"
      >
        <Zap size={12} className="text-emerald-500" />
        <span>
          {creating ? "Creating..." : "Quick: DML trigger on"}{" "}
          <span className="font-mono font-medium">{sourceName}</span>
        </span>
      </button>

      {/* Existing triggers */}
      <div className="max-h-[200px] overflow-auto">
        {triggers.length === 0 ? (
          <div className="px-3 py-2 text-muted-foreground italic">No triggers available</div>
        ) : (
          triggers.map((t) => (
            <button
              key={t.id}
              onClick={() => handleAttach(t.id)}
              className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2"
            >
              <span className="truncate">{t.name}</span>
              <span className="text-muted-foreground shrink-0">{t.trigger_type}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function FloatingComputationForm({
  x,
  y,
  relationId,
  onClose,
}: {
  x: number
  y: number
  relationId: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[280px] rounded-lg border bg-background shadow-xl text-xs"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-2 border-b font-medium flex items-center gap-1.5">
        <Zap size={12} className="text-emerald-500" />
        Add Computation
      </div>
      <AddComputationFormShared
        relationId={relationId}
        onDone={onClose}
        variant="floating"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schema mode toolbar
// ---------------------------------------------------------------------------

type SchemaMode = "schema" | "hybrid"

function SchemaToolbar({
  mode,
  onModeChange,
  relationCount,
  triggerCount,
  computedCount,
  onDetect,
  detecting,
}: {
  mode: SchemaMode
  onModeChange: (mode: SchemaMode) => void
  relationCount: number
  triggerCount: number
  computedCount: number
  onDetect?: () => void
  detecting?: boolean
}) {
  return (
    <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
      {/* Mode toggle */}
      <div className="flex rounded-md border bg-background/95 backdrop-blur shadow-sm overflow-hidden">
        <button
          onClick={() => onModeChange("schema")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "schema"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground"
          }`}
        >
          Schema
        </button>
        <button
          onClick={() => onModeChange("hybrid")}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "hybrid"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted text-muted-foreground"
          }`}
        >
          Hybrid
        </button>
      </div>

      {/* Detect button */}
      {onDetect && (
        <button
          onClick={onDetect}
          disabled={detecting}
          className="flex items-center gap-1.5 rounded-md border bg-background/95 backdrop-blur shadow-sm px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
          title="Run server-side relation detection"
        >
          <Search size={10} />
          {detecting ? "Detecting..." : "Detect"}
        </button>
      )}

      {/* Stats pills */}
      <div className="flex items-center gap-1.5 rounded-md border bg-background/95 backdrop-blur shadow-sm px-2.5 py-1.5">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Link2 size={10} />
          {relationCount}
        </span>
        <span className="text-border">|</span>
        <span className="flex items-center gap-1 text-xs text-cyan-600">
          <Activity size={10} />
          {triggerCount}
        </span>
        <span className="text-border">|</span>
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <Zap size={10} />
          {computedCount}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SchemaView (main component)
// ---------------------------------------------------------------------------

export function SchemaView() {
  const datasets = useDatasetStore((s) => s.datasets)
  const setContextSelection = useUIStore((s) => s.setContextSelection)

  // Persisted relations from backend
  const persistedRelations = useRelationStore((s) => s.relations)
  const fetchRelations = useRelationStore((s) => s.fetchRelations)
  const createRelation = useRelationStore((s) => s.createRelation)
  const deleteRelation = useRelationStore((s) => s.deleteRelation)
  const triggers = useProjectStore((s) => s.triggers)

  // Schema mode
  const [schemaMode, setSchemaMode] = useState<SchemaMode>("schema")

  // Fetch relations on mount
  useEffect(() => {
    fetchRelations()
  }, [fetchRelations])

  // Server-side relation detection
  const [serverDetecting, setServerDetecting] = useState(false)
  const handleServerDetect = useCallback(async () => {
    setServerDetecting(true)
    try {
      const detected = await detectRelationsApi()
      await fetchRelations()
      if (detected.length > 0) {
        toast.success(`Detected ${detected.length} relation${detected.length > 1 ? "s" : ""}`)
      } else {
        toast.info("No new relations detected")
      }
    } catch (err) {
      toast.error("Detection failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setServerDetecting(false)
    }
  }, [fetchRelations])

  // Context menu state
  const [edgeMenu, setEdgeMenu] = useState<EdgeContextMenu | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [deleteRelationId, setDeleteRelationId] = useState<string | null>(null)

  // Floating forms
  const [triggerPicker, setTriggerPicker] = useState<{
    x: number; y: number; relationId: string; sourceName: string; targetName: string
  } | null>(null)
  const [computationForm, setComputationForm] = useState<{
    x: number; y: number; relationId: string
  } | null>(null)

  // Local detection state
  const [detecting, setDetecting] = useState(false)
  const [detectedCount, setDetectedCount] = useState<number | null>(null)
  const [localRelations, setLocalRelations] = useState<LocalRelation[]>([])

  // Run local detection
  useEffect(() => {
    if (datasets.length === 0) {
      setLocalRelations([])
      setDetectedCount(null)
      return
    }
    setDetecting(true)
    setDetectedCount(null)
    const timeoutId = setTimeout(() => {
      const result = detectLocalRelations(datasets)
      setLocalRelations(result)
      setDetectedCount(result.length + persistedRelations.length)
      setDetecting(false)
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [datasets, persistedRelations.length])

  // Build persisted pair keys for dedup
  const persistedPairKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const rel of persistedRelations) {
      keys.add(`${rel.source_layer_name}::${rel.target_layer_name}::${rel.relation_type}`)
    }
    return keys
  }, [persistedRelations])

  // Refresh relations when a trigger fires (computed fields may have been updated)
  const liveEvents = useLiveEventStore((s) => s.events)
  const lastTriggerFired = useMemo(() => {
    for (let i = liveEvents.length - 1; i >= 0; i--) {
      if (liveEvents[i].type === "trigger_fired") return liveEvents[i].id
    }
    return null
  }, [liveEvents])
  useEffect(() => {
    if (lastTriggerFired) fetchRelations()
  }, [lastTriggerFired, fetchRelations])

  // Stats
  const stats = useMemo(() => {
    let triggerCount = 0
    let computedCount = 0
    for (const rel of persistedRelations) {
      if (rel.trigger_id) triggerCount++
      computedCount += rel.computed_fields.length
    }
    return { relationCount: persistedRelations.length, triggerCount, computedCount }
  }, [persistedRelations])

  // Build nodes and edges
  const { computedNodes, computedEdges } = useMemo(() => {
    if (datasets.length === 0) {
      return { computedNodes: [] as Node[], computedEdges: [] as Edge[] }
    }
    const { nodes, layerNameIndex } = autoLayout(datasets, persistedRelations)
    const triggerMap = new Map(triggers.map((t) => [t.id, t.enabled]))
    const edges = buildEdges(persistedRelations, localRelations, layerNameIndex, triggerMap)
    return { computedNodes: nodes, computedEdges: edges }
  }, [datasets, persistedRelations, localRelations, triggers])

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges)

  // Sync when computed values change
  useEffect(() => {
    setNodes(computedNodes)
    setEdges(computedEdges)
  }, [computedNodes, computedEdges, setNodes, setEdges])

  // Handle drag-to-connect: create a new relation between two layers
  const handleConnect = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return

    // Extract dataset/layer info from nodeIds (format: schema-{dsId}-{layerName})
    const parseNodeId = (nodeId: string) => {
      const match = nodeId.match(/^schema-(.+?)-(.+)$/)
      return match ? { datasetId: match[1], layerName: match[2] } : null
    }

    const src = parseNodeId(connection.source)
    const tgt = parseNodeId(connection.target)
    if (!src || !tgt) return

    // Determine relation type from handle
    const isGeomHandle = !connection.sourceHandle || connection.sourceHandle === "geom-out"
    const relationType = isGeomHandle ? "spatial" : "attribute"

    // Extract field name from handle id (field-{name} or field-{name}-in)
    const sourceField = connection.sourceHandle?.startsWith("field-")
      ? connection.sourceHandle.replace(/^field-/, "").replace(/-in$/, "")
      : undefined
    const targetField = connection.targetHandle?.startsWith("field-")
      ? connection.targetHandle.replace(/^field-/, "").replace(/-in$/, "")
      : undefined

    try {
      await createRelation({
        source_layer_name: src.layerName,
        target_layer_name: tgt.layerName,
        relation_type: relationType,
        spatial_op: relationType === "spatial" ? "intersects" : null,
        confidence: 1.0,
        confirmed: true,
        label: sourceField && targetField ? `${sourceField} → ${targetField}` : `${src.layerName} → ${tgt.layerName}`,
        source_field: sourceField,
        target_field: targetField,
      })
      toast.success(`Relation created: ${src.layerName} → ${tgt.layerName}`)
    } catch (err) {
      toast.error("Failed to create relation: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [createRelation])

  // Persist a local relation to the backend
  const handlePersist = useCallback(async (lr: LocalRelation) => {
    try {
      await createRelation({
        source_layer_name: lr.sourceLayer,
        target_layer_name: lr.targetLayer,
        relation_type: lr.type,
        spatial_op: lr.spatialOp ?? null,
        confidence: lr.confidence,
        confirmed: true,
        label: lr.label,
      })
    } catch (err) {
      toast.error("Failed to persist relation: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [createRelation])

  // Edge click → select relation in inspector
  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const data = edge.data as HybridEdgeData | undefined
      if (data?.relationId) {
        setContextSelection({ type: "relation", relationId: data.relationId as string })
      }
    },
    [setContextSelection],
  )

  // Resolve relation from edge
  const resolveRelation = useCallback((edgeId: string): TableRelation | undefined => {
    const relId = edgeId.startsWith("rel-") ? edgeId.slice(4) : undefined
    return relId ? persistedRelations.find((r) => r.id === relId) : undefined
  }, [persistedRelations])

  // Edge right-click handler
  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      const data = edge.data as HybridEdgeData | undefined
      const rel = data?.relationId
        ? persistedRelations.find((r) => r.id === data.relationId)
        : undefined
      setEdgeMenu({
        x: event.clientX,
        y: event.clientY,
        edgeId: edge.id,
        relationId: data?.relationId as string | undefined,
        sourceLayer: rel?.source_layer_name ?? "",
        targetLayer: rel?.target_layer_name ?? "",
      })
    },
    [persistedRelations],
  )

  // Close context menu on click outside
  useEffect(() => {
    if (!edgeMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setEdgeMenu(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [edgeMenu])

  // Context menu actions
  const handleViewDetails = useCallback(() => {
    if (!edgeMenu?.relationId) return
    setContextSelection({ type: "relation", relationId: edgeMenu.relationId })
    setEdgeMenu(null)
  }, [edgeMenu, setContextSelection])

  const handleAttachTriggerMenu = useCallback(() => {
    if (!edgeMenu?.relationId) return
    const rel = persistedRelations.find((r) => r.id === edgeMenu.relationId)
    setTriggerPicker({
      x: edgeMenu.x,
      y: edgeMenu.y,
      relationId: edgeMenu.relationId,
      sourceName: rel?.source_layer_name ?? "",
      targetName: rel?.target_layer_name ?? "",
    })
    setEdgeMenu(null)
  }, [edgeMenu, persistedRelations])

  const handleAddComputationMenu = useCallback(() => {
    if (!edgeMenu?.relationId) return
    setComputationForm({
      x: edgeMenu.x,
      y: edgeMenu.y,
      relationId: edgeMenu.relationId,
    })
    setEdgeMenu(null)
  }, [edgeMenu])

  const handleDeleteRelation = useCallback(() => {
    if (!edgeMenu?.relationId) return
    setDeleteRelationId(edgeMenu.relationId)
    setEdgeMenu(null)
  }, [edgeMenu])

  const confirmDeleteRelation = useCallback(async () => {
    if (!deleteRelationId) return
    try {
      await deleteRelation(deleteRelationId)
      toast.success("Relation deleted")
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)))
    }
    setDeleteRelationId(null)
  }, [deleteRelationId, deleteRelation])

  if (datasets.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        onEdgeContextMenu={handleEdgeContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="bg-muted/20"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls position="top-right" />
        <MiniMap
          position="bottom-right"
          className="!bg-background border border-border rounded !mb-12"
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>

      {/* Schema toolbar with mode toggle */}
      <SchemaToolbar
        mode={schemaMode}
        onModeChange={setSchemaMode}
        relationCount={stats.relationCount}
        triggerCount={stats.triggerCount}
        computedCount={stats.computedCount}
        onDetect={handleServerDetect}
        detecting={serverDetecting}
      />

      {/* Detection loader badge */}
      <DetectionBadge detecting={detecting} resultCount={detectedCount} />

      {/* Hybrid mode overlay hint */}
      {schemaMode === "hybrid" && (
        <div className="absolute top-3 right-[200px] z-20 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-950/90 px-3 py-1.5 shadow-sm backdrop-blur text-xs text-emerald-700 dark:text-emerald-300">
          <Zap size={12} />
          Hybrid mode — click edges to configure triggers and computations
        </div>
      )}

      {/* Edge context menu */}
      {edgeMenu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Relation context menu"
          className="fixed z-50 min-w-[220px] rounded-lg border bg-background shadow-xl py-1 text-xs"
          style={{ left: edgeMenu.x, top: edgeMenu.y }}
        >
          {edgeMenu.relationId && (
            <>
              <button
                role="menuitem"
                onClick={handleViewDetails}
                className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors text-foreground flex items-center gap-2"
              >
                <Eye size={12} className="text-muted-foreground" />
                View in inspector
              </button>
              {schemaMode === "hybrid" && (
                <>
                  <div className="h-px bg-border my-0.5" role="separator" />
                  <button
                    role="menuitem"
                    onClick={handleAttachTriggerMenu}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors text-foreground flex items-center gap-2"
                  >
                    <Activity size={12} className="text-cyan-500" />
                    Attach trigger
                  </button>
                  <button
                    role="menuitem"
                    onClick={handleAddComputationMenu}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors text-foreground flex items-center gap-2"
                  >
                    <Zap size={12} className="text-emerald-500" />
                    Add computation
                  </button>
                </>
              )}
              <div className="h-px bg-border my-0.5" role="separator" />
              <button
                role="menuitem"
                onClick={handleDeleteRelation}
                className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors text-destructive flex items-center gap-2"
              >
                <Trash2 size={12} />
                Delete relation
              </button>
            </>
          )}
          {!edgeMenu.relationId && (
            <div className="px-3 py-1.5 text-muted-foreground italic">
              Persist this relation first to configure it
            </div>
          )}
        </div>
      )}

      {/* Floating trigger picker */}
      {triggerPicker && (
        <FloatingTriggerPicker
          x={triggerPicker.x}
          y={triggerPicker.y}
          relationId={triggerPicker.relationId}
          sourceName={triggerPicker.sourceName}
          targetName={triggerPicker.targetName}
          onClose={() => setTriggerPicker(null)}
        />
      )}

      {/* Floating computation form */}
      {computationForm && (
        <FloatingComputationForm
          x={computationForm.x}
          y={computationForm.y}
          relationId={computationForm.relationId}
          onClose={() => setComputationForm(null)}
        />
      )}

      <PulseSuggestionsPanel
        localRelations={localRelations}
        persistedIds={persistedPairKeys}
        onPersist={handlePersist}
        onIgnore={(id) => { deleteRelation(id).catch(() => {}) }}
      />

      <ConfirmDialog
        open={deleteRelationId !== null}
        title="Delete relation"
        description="Delete this relation? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDeleteRelation}
        onCancel={() => setDeleteRelationId(null)}
      />
    </div>
  )
}
