/**
 * TableSourceNode — DML source table for trigger operations.
 * Represents the table being watched: schema.table + event (INSERT/UPDATE/DELETE).
 * Auto-populates table list from loaded datasets.
 */

import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "../portTypes"
import { StatusBadge } from "../StatusBadge"
import { useEditorStore, type NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "../nodeStyles"
import { Table2 } from "lucide-react"
import type { TableSourceData } from "./types"
import { useTableColumns } from "@/hooks/useTableColumns"

const DML_EVENTS = ["INSERT", "UPDATE", "DELETE", "INSERT,UPDATE"] as const

const inputClass = "nodrag w-full text-label rounded border border-[var(--gp-node-trigger)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-trigger)] font-mono"
const selectClass = "nodrag w-full text-label rounded border border-[var(--gp-node-trigger)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-trigger)]"

export function TableSourceNode({ id, data }: NodeProps) {
  const d = data as unknown as TableSourceData & { status?: NodeExecStatus }
  const { setNodes } = useReactFlow()
  const setGraphDirty = useEditorStore((s) => s.setGraphDirty)
  const { tables } = useTableColumns("", "")

  const update = (key: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n)),
    )
    setGraphDirty(true)
  }

  const currentValue = d.schema ? `${d.schema}.${d.table}` : d.table || ""
  const summary = `${d.event || "INSERT"} on ${currentValue || "?"}`

  const handleTableChange = (val: string) => {
    const parts = val.split(".")
    if (parts.length >= 2) {
      update("schema", parts[0])
      update("table", parts.slice(1).join("."))
    } else {
      update("schema", "")
      update("table", val)
    }
  }

  return (
    <div className={nodeContainerClass("trigger")}>
      <div className={nodeHeaderClass("trigger")}>
        <Table2 className="h-3 w-3 inline mr-1 -mt-0.5" />
        Table Source
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {d.label || "Table Source"}
      </div>

      <div className="mt-1.5 space-y-1">
        {/* Schema.Table — dropdown if datasets loaded, fallback to text input */}
        {tables.length > 0 ? (
          <select
            value={currentValue}
            onChange={(e) => { e.stopPropagation(); handleTableChange(e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            className={`${selectClass} font-mono`}
          >
            <option value="">-- select table --</option>
            {tables.map((t) => (
              <option key={t.label} value={t.label}>{t.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => { e.stopPropagation(); handleTableChange(e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            placeholder="schema.table"
            className={inputClass}
          />
        )}

        {/* DML Event */}
        <select
          value={d.event || "INSERT"}
          onChange={(e) => { e.stopPropagation(); update("event", e.target.value) }}
          onClick={(e) => e.stopPropagation()}
          className={selectClass}
        >
          {DML_EVENTS.map((ev) => (
            <option key={ev} value={ev}>{ev}</option>
          ))}
        </select>
      </div>

      <p className="mt-1 text-label text-muted-foreground font-mono truncate" title={summary}>
        {summary}
      </p>

      <StatusBadge status={d.status} />
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3 !h-3 ${PORT_COLORS.event} !border-2 !border-white dark:!border-gray-900`}
      />
    </div>
  )
}
