/**
 * BusinessRuleNode — Domain-specific business logic (BEFORE or AFTER).
 *
 * Examples:
 *   cost = length_m * unit_cost[cable_type]
 *   classification = CASE WHEN density > 1000 THEN 'urbain' ...
 *   risk_score = flood * 0.4 + erosion * 0.3 + fire * 0.3
 *
 * Differs from CustomExpressionNode:
 *   - Has explicit dependency declarations (fields it reads)
 *   - Auto-ordered by resolution engine based on deps
 *   - Named with a business-friendly label
 *   - Simpler expression editor (single-line or short multi-line)
 *
 * Issue #167
 */

import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "../portTypes"
import { StatusBadge } from "../StatusBadge"
import { useEditorStore, type NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "../nodeStyles"
import { Calculator, SkipForward, Plus, X } from "lucide-react"
import type { BusinessRuleData } from "./types"

export function BusinessRuleNode({ id, data }: NodeProps) {
  const d = data as unknown as BusinessRuleData & { status?: NodeExecStatus }
  const { setNodes } = useReactFlow()
  const setGraphDirty = useEditorStore((s) => s.setGraphDirty)

  const update = (key: string, value: unknown) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n)),
    )
    setGraphDirty(true)
  }

  const deps = d.dependencies || []

  const addDep = () => update("dependencies", [...deps, ""])
  const removeDep = (idx: number) => update("dependencies", deps.filter((_, i) => i !== idx))
  const updateDep = (idx: number, val: string) => {
    const next = [...deps]
    next[idx] = val
    update("dependencies", next)
  }

  return (
    <div className={nodeContainerClass("code")}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${PORT_COLORS.event} !border-2 !border-white dark:!border-gray-900`}
      />

      <div className={nodeHeaderClass("code")}>
        <Calculator className="h-3 w-3 inline mr-1 -mt-0.5" />
        Business Rule · {(d.phase || "before").toUpperCase()}
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {d.label || "Business Rule"}
      </div>

      <div className="mt-1.5 space-y-1">
        {/* Phase */}
        <select
          value={d.phase || "before"}
          onChange={(e) => { e.stopPropagation(); update("phase", e.target.value) }}
          onClick={(e) => e.stopPropagation()}
          className="nodrag w-full text-label rounded border border-[var(--gp-node-code)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-code)]"
        >
          <option value="before">BEFORE</option>
          <option value="after">AFTER</option>
        </select>

        {/* Target field */}
        <input
          type="text"
          value={d.field || ""}
          onChange={(e) => { e.stopPropagation(); update("field", e.target.value) }}
          onClick={(e) => e.stopPropagation()}
          placeholder="→ result field"
          className="nodrag w-full text-label rounded border border-[var(--gp-node-code)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-code)] font-mono"
        />

        {/* Expression */}
        <textarea
          value={d.expression || ""}
          onChange={(e) => { e.stopPropagation(); update("expression", e.target.value) }}
          onClick={(e) => e.stopPropagation()}
          rows={3}
          placeholder="length_m * 12.5"
          className="nodrag w-full text-label rounded border border-[var(--gp-node-code)]/30 bg-slate-900/80 text-green-400 px-1.5 py-1 outline-none focus:ring-1 focus:ring-[var(--gp-node-code)] font-mono resize-y"
        />

        {/* Dependencies */}
        <div className="space-y-0.5">
          <div className="text-label-xs uppercase tracking-wider text-muted-foreground">
            Depends on
          </div>
          {deps.map((dep, idx) => (
            <div key={idx} className="flex items-center gap-0.5">
              <input
                type="text"
                value={dep}
                onChange={(e) => { e.stopPropagation(); updateDep(idx, e.target.value) }}
                onClick={(e) => e.stopPropagation()}
                placeholder="field_name"
                className="nodrag flex-1 text-label-sm font-mono rounded border border-[var(--gp-node-code)]/30 bg-background px-1 py-0.5 outline-none"
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeDep(idx) }}
                className="nodrag text-muted-foreground hover:text-red-500 p-0"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); addDep() }}
            className="nodrag flex items-center gap-0.5 text-label-sm text-[var(--gp-node-code)] hover:underline"
          >
            <Plus className="h-2 w-2" />
            Add dependency
          </button>
        </div>
      </div>

      {d.coalesce && (
        <div className="mt-1 flex items-center gap-1 text-label text-amber-600">
          <SkipForward className="h-2.5 w-2.5" />
          <span>coalesce</span>
        </div>
      )}

      {d.order != null && (
        <div className="mt-0.5 text-label text-muted-foreground font-mono">
          order: {d.order}
        </div>
      )}

      <StatusBadge status={d.status} />
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3 !h-3 ${PORT_COLORS.any} !border-2 !border-white dark:!border-gray-900`}
      />
    </div>
  )
}
