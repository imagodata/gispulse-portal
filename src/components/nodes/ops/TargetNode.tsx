/**
 * TargetNode — Target table for AFTER updates.
 * Represents the distant table being updated by aggregate/propagation operations.
 */

import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "../portTypes"
import { StatusBadge } from "../StatusBadge"
import type { NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "../nodeStyles"
import { Target } from "lucide-react"
import type { TargetData } from "./types"

export function TargetNode({ id, data }: NodeProps) {
  const d = data as unknown as TargetData & { status?: NodeExecStatus }
  const { setNodes } = useReactFlow()

  const update = (key: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n)),
    )
  }

  const fullTarget = d.distantSchema
    ? `${d.distantSchema}.${d.distantTable}.${d.distantField}`
    : `${d.distantTable || "?"}.${d.distantField || "?"}`

  return (
    <div className={nodeContainerClass("output")}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${PORT_COLORS.tabular} !border-2 !border-white dark:!border-gray-900`}
      />

      <div className={nodeHeaderClass("output")}>
        <Target className="h-3 w-3 inline mr-1 -mt-0.5" />
        Target · UPDATE
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {d.label || "Target"}
      </div>

      <div className="mt-1.5 space-y-1">
        <input
          type="text"
          value={d.distantSchema ? `${d.distantSchema}.${d.distantTable}` : d.distantTable || ""}
          onChange={(e) => {
            e.stopPropagation()
            const parts = e.target.value.split(".")
            if (parts.length >= 2) {
              update("distantSchema", parts[0])
              update("distantTable", parts.slice(1).join("."))
            } else {
              // Clear schema when prefix is removed (#205)
              update("distantSchema", "")
              update("distantTable", e.target.value)
            }
          }}
          onClick={(e) => e.stopPropagation()}
          placeholder="schema.table"
          className="nodrag w-full text-label rounded border border-[var(--gp-node-output)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-output)] font-mono"
        />

        <input
          type="text"
          value={d.distantField || ""}
          onChange={(e) => { e.stopPropagation(); update("distantField", e.target.value) }}
          onClick={(e) => e.stopPropagation()}
          placeholder="field"
          className="nodrag w-full text-label rounded border border-[var(--gp-node-output)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-output)] font-mono"
        />

        {d.distantFilter && (
          <div className="text-label text-muted-foreground font-mono truncate" title={d.distantFilter}>
            WHERE {d.distantFilter}
          </div>
        )}
      </div>

      <p className="mt-1 text-label text-muted-foreground font-mono truncate" title={fullTarget}>
        → {fullTarget}
      </p>

      <StatusBadge status={d.status} />
    </div>
  )
}
