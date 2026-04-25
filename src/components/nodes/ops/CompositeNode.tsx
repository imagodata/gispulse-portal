/**
 * CompositeNode — Ordered list of operations on a single table.
 *
 * Renders as one node containing N sub-operations that execute sequentially
 * (each sees the results of the previous). Maps to N rows in trigger_operations
 * with incrementing _order values.
 *
 * Issue #164
 */

import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "../portTypes"
import { StatusBadge } from "../StatusBadge"
import type { NodeExecStatus } from "@/stores/editorStore"
import { nodeHeaderClass } from "../nodeStyles"
import {
  Layers, Plus, X, SkipForward, ChevronUp, ChevronDown,
} from "lucide-react"
import type { SpatialOperation, TriggerPhase } from "@/types/editor"
import { SPATIAL_OPS, AGGREGATE_OPS } from "./types"

// ---------------------------------------------------------------------------
// Sub-operation within a composite
// ---------------------------------------------------------------------------

export interface CompositeSubOp {
  id: string
  operation: SpatialOperation | "custom_expression"
  phase: TriggerPhase
  field: string
  distantSchema?: string
  distantTable?: string
  distantField?: string
  distance?: number
  filter?: string
  coalesce: boolean
  expression?: string
  /** For polymorphic ops: union of multiple source tables */
  unionSources?: Array<{ schema: string; table: string }>
}

export interface CompositeNodeData {
  nodeKind: "composite"
  label: string
  ops: CompositeSubOp[]
}

// All available operations for the dropdown
const ALL_OPS = [
  ...SPATIAL_OPS.map((o) => ({ value: o.operation, label: o.label, phase: o.phase })),
  ...AGGREGATE_OPS.map((o) => ({ value: o.operation, label: o.label, phase: o.phase })),
  { value: "custom_expression" as const, label: "Custom SQL", phase: "before" as TriggerPhase },
]

let subOpCounter = 0
function nextSubOpId() {
  return `sub-${Date.now()}-${++subOpCounter}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompositeNode({ id, data }: NodeProps) {
  const d = data as unknown as CompositeNodeData & { status?: NodeExecStatus }
  const { setNodes } = useReactFlow()

  const ops = d.ops || []

  const updateOps = (newOps: CompositeSubOp[]) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ops: newOps } } : n)),
    )
  }

  const addOp = () => {
    updateOps([
      ...ops,
      {
        id: nextSubOpId(),
        operation: "st_within",
        phase: "before",
        field: "",
        coalesce: false,
      },
    ])
  }

  const removeOp = (idx: number) => {
    updateOps(ops.filter((_, i) => i !== idx))
  }

  const updateOp = (idx: number, patch: Partial<CompositeSubOp>) => {
    updateOps(ops.map((op, i) => (i === idx ? { ...op, ...patch } : op)))
  }

  const moveOp = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= ops.length) return
    const next = [...ops]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    updateOps(next)
  }

  // Phase summary
  const beforeCount = ops.filter((o) => o.phase === "before").length
  const afterCount = ops.filter((o) => o.phase === "after").length

  return (
    <div className={`rounded-lg border-2 border-dashed border-[var(--gp-node-transform)] bg-blue-50/50 dark:bg-blue-950/30 px-2.5 py-2 shadow-sm min-w-[220px] max-w-[280px]`}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${PORT_COLORS.event} !border-2 !border-white dark:!border-gray-900`}
      />

      <div className={nodeHeaderClass("transform")}>
        <Layers className="h-3 w-3 inline mr-1 -mt-0.5" />
        Composite
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-foreground truncate">
          {d.label || "Composite"}
        </span>
        <span className="text-label text-muted-foreground">
          {ops.length} ops
        </span>
      </div>

      {/* Phase badges */}
      <div className="flex gap-1 mt-1">
        {beforeCount > 0 && (
          <span className="text-label-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono">
            BEFORE ×{beforeCount}
          </span>
        )}
        {afterCount > 0 && (
          <span className="text-label-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-mono">
            AFTER ×{afterCount}
          </span>
        )}
      </div>

      {/* Sub-operations list */}
      <div className="mt-1.5 space-y-0.5 max-h-[300px] overflow-y-auto">
        {ops.map((op, idx) => {
          return (
            <div
              key={op.id}
              className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-label ${
                op.phase === "before"
                  ? "bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-800/50"
                  : "bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/50"
              }`}
            >
              {/* Order controls */}
              <div className="flex flex-col shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); moveOp(idx, -1) }}
                  disabled={idx === 0}
                  className="nodrag text-muted-foreground hover:text-foreground disabled:opacity-20 p-0"
                >
                  <ChevronUp className="h-2 w-2" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); moveOp(idx, 1) }}
                  disabled={idx === ops.length - 1}
                  className="nodrag text-muted-foreground hover:text-foreground disabled:opacity-20 p-0"
                >
                  <ChevronDown className="h-2 w-2" />
                </button>
              </div>

              {/* Order number */}
              <span className="text-label-xs font-mono text-muted-foreground w-3 text-center shrink-0">
                {(idx + 1) * 10}
              </span>

              {/* Operation selector */}
              <select
                value={op.operation}
                onChange={(e) => {
                  e.stopPropagation()
                  const def = ALL_OPS.find((o) => o.value === e.target.value)
                  updateOp(idx, {
                    operation: e.target.value as SpatialOperation,
                    phase: def?.phase || "before",
                  })
                }}
                onClick={(e) => e.stopPropagation()}
                className="nodrag flex-1 min-w-0 text-label-sm rounded border-none bg-transparent outline-none truncate"
              >
                {ALL_OPS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Field */}
              <input
                type="text"
                value={op.field}
                onChange={(e) => { e.stopPropagation(); updateOp(idx, { field: e.target.value }) }}
                onClick={(e) => e.stopPropagation()}
                placeholder="field"
                className="nodrag w-16 text-label-sm font-mono bg-transparent border-b border-current/20 outline-none px-0.5"
              />

              {/* Coalesce */}
              {op.coalesce && (
                <SkipForward className="h-2 w-2 text-amber-500 shrink-0" />
              )}

              {/* Remove */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeOp(idx) }}
                className="nodrag text-muted-foreground hover:text-red-500 p-0 shrink-0"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Add button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); addOp() }}
        className="nodrag mt-1 flex items-center gap-1 text-label text-[var(--gp-node-transform)] hover:underline"
      >
        <Plus className="h-2.5 w-2.5" />
        Add operation
      </button>

      <StatusBadge status={d.status} />
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3 !h-3 ${PORT_COLORS.geometry} !border-2 !border-white dark:!border-gray-900`}
      />
    </div>
  )
}
