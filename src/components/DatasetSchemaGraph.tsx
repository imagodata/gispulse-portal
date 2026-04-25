/**
 * DatasetSchemaGraph — Mini read-only schema graph for the Explorer Dashboard.
 *
 * Issue #191 (A7-S3): shows datasets as nodes + their layers as sub-labels.
 * Click on a node to select the dataset. Uses ReactFlow in read-only mode.
 * Falls back to a text summary if > 12 datasets (too many nodes = unreadable).
 */

import { useMemo, useCallback } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { HardDrive, Layers } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { DatasetMeta } from "@/types/dataset"
import { useRelationStore } from "@/stores/relationStore"

// ---------------------------------------------------------------------------
// Custom dataset node
// ---------------------------------------------------------------------------

interface DatasetNodeData extends Record<string, unknown> {
  name: string
  layerCount: number
  featureCount: number
  crs: string
  onSelect?: () => void
}

function DatasetNode({ data }: NodeProps) {
  const d = data as DatasetNodeData
  return (
    <div
      onClick={d.onSelect}
      className={`rounded-lg border bg-background shadow-sm px-3 py-2 min-w-[120px] max-w-[160px] cursor-pointer hover:border-primary/50 transition-colors ${d.onSelect ? "" : ""}`}
    >
      <Handle type="source" position={Position.Right} className="!w-1.5 !h-1.5 !bg-slate-400" />
      <Handle type="target" position={Position.Left} className="!w-1.5 !h-1.5 !bg-slate-400" />
      <div className="flex items-center gap-1.5 mb-1">
        <HardDrive size={11} className="text-blue-500 shrink-0" />
        <span className="text-label-lg font-semibold truncate flex-1">{d.name}</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <div className="flex items-center gap-0.5 text-label-sm text-muted-foreground">
          <Layers size={8} />
          <span>{d.layerCount} layer{d.layerCount !== 1 ? "s" : ""}</span>
        </div>
        {d.featureCount > 0 && (
          <span className="text-label-sm text-muted-foreground">
            {d.featureCount.toLocaleString()} ft
          </span>
        )}
        {d.crs && d.crs !== "EPSG:4326" && (
          <Badge variant="outline" className="text-label-xs px-1 py-0 h-3.5 font-mono">
            {d.crs.replace("EPSG:", "")}
          </Badge>
        )}
      </div>
    </div>
  )
}

const NODE_TYPES = { dataset: DatasetNode }

// ---------------------------------------------------------------------------
// Layout helpers — simple grid
// ---------------------------------------------------------------------------

function gridLayout(count: number): { x: number; y: number }[] {
  const cols = Math.ceil(Math.sqrt(count))
  return Array.from({ length: count }, (_, i) => ({
    x: (i % cols) * 200,
    y: Math.floor(i / cols) * 110,
  }))
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface DatasetSchemaGraphProps {
  datasets: DatasetMeta[]
  onSelectDataset: (ds: DatasetMeta) => void
}

export function DatasetSchemaGraph({ datasets, onSelectDataset }: DatasetSchemaGraphProps) {
  const persistedRelations = useRelationStore((s) => s.relations)
  const positions = useMemo(() => gridLayout(datasets.length), [datasets.length])

  const nodes: Node[] = useMemo(() =>
    datasets.map((ds, i) => ({
      id: ds.id,
      type: "dataset",
      position: positions[i] ?? { x: 0, y: 0 },
      draggable: false,
      selectable: false,
      data: {
        name: ds.name,
        layerCount: ds.layers?.length ?? 0,
        featureCount: ds.layers?.reduce((s, l) => s + (l.feature_count ?? 0), 0) ?? 0,
        crs: ds.crs ?? "",
        onSelect: () => onSelectDataset(ds),
      } satisfies DatasetNodeData,
    })),
    [datasets, positions, onSelectDataset],
  )

  // Build edges from persisted relations (linking datasets that share related layers)
  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = []
    const seen = new Set<string>()

    // Map layer name → dataset id
    const layerToDataset = new Map<string, string>()
    for (const ds of datasets) {
      for (const l of ds.layers ?? []) {
        // First dataset wins for each layer name (same as SchemaView)
        if (!layerToDataset.has(l.name)) {
          layerToDataset.set(l.name, ds.id)
        }
      }
    }

    // Use persisted relations to draw edges between datasets
    for (const rel of persistedRelations) {
      const srcDsId = layerToDataset.get(rel.source_layer_name)
      const tgtDsId = layerToDataset.get(rel.target_layer_name)
      if (!srcDsId || !tgtDsId || srcDsId === tgtDsId) continue

      const pairKey = `${srcDsId}::${tgtDsId}`
      if (seen.has(pairKey) || seen.has(`${tgtDsId}::${srcDsId}`)) continue
      seen.add(pairKey)

      const hasTriggerId = !!rel.trigger_id
      result.push({
        id: `rel-${rel.id}`,
        source: srcDsId,
        target: tgtDsId,
        label: rel.label || `${rel.source_layer_name} → ${rel.target_layer_name}`,
        type: "default",
        style: {
          stroke: hasTriggerId ? "#06b6d4" : "#94a3b8",
          strokeDasharray: hasTriggerId ? undefined : "4 2",
          strokeWidth: hasTriggerId ? 1.5 : 1,
        },
        labelStyle: { fontSize: 9, fill: hasTriggerId ? "#06b6d4" : "#94a3b8" },
      })
    }

    return result
  }, [datasets, persistedRelations])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const ds = datasets.find((d) => d.id === node.id)
      if (ds) onSelectDataset(ds)
    },
    [datasets, onSelectDataset],
  )

  if (datasets.length === 0) return null

  // Text summary fallback for large projects
  if (datasets.length > 12) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {datasets.map((ds) => (
            <button
              key={ds.id}
              onClick={() => onSelectDataset(ds)}
              className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-label-lg hover:border-primary/50 transition-colors"
            >
              <HardDrive size={11} className="text-blue-500" />
              <span className="font-medium truncate max-w-[100px]">{ds.name}</span>
              <Badge variant="secondary" className="text-label-sm px-1 h-4">
                {ds.layers?.length ?? 0}L
              </Badge>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const height = Math.max(160, Math.ceil(datasets.length / Math.ceil(Math.sqrt(datasets.length))) * 110 + 20)

  return (
    <div className="rounded-lg border overflow-hidden" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        attributionPosition="bottom-right"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
      </ReactFlow>
    </div>
  )
}
