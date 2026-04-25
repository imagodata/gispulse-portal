import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "./portTypes"
import { StatusBadge } from "./StatusBadge"
import type { NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "./nodeStyles"
import { Zap } from "lucide-react"

const TRIGGER_TYPES = ["On DML", "On Schedule", "On Threshold"] as const

export function TriggerNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>
  const { setNodes } = useReactFlow()

  const triggerType = (d.triggerType as string) ?? "On DML"
  const tableName = (d.tableName as string) ?? ""
  const eventType = (d.eventType as string) ?? "INSERT"

  const update = (key: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n)
    )
  }

  // Compact summary line
  const summary = triggerType === "On DML"
    ? `${eventType} on ${tableName || "?"}`
    : triggerType === "On Schedule"
      ? (d.cron as string) || "*/5 * * * *"
      : (d.threshold as string) || "count > 100"

  return (
    <div className={nodeContainerClass("trigger")}>
      <div className={nodeHeaderClass("trigger")}>
        <Zap className="h-3 w-3 inline mr-1 -mt-0.5" />
        Trigger
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {(d.label as string) ?? "Trigger"}
      </div>

      {/* Compact: type selector only */}
      <select
        value={triggerType}
        onChange={(e) => { e.stopPropagation(); update("triggerType", e.target.value) }}
        onClick={(e) => e.stopPropagation()}
        className="nodrag mt-1.5 w-full text-label rounded border border-[var(--gp-node-trigger)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-trigger)]"
      >
        {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* Summary line — details editable in property panel */}
      <p className="mt-1 text-label text-muted-foreground font-mono truncate" title={summary}>
        {summary}
      </p>

      <StatusBadge status={d.status as NodeExecStatus | undefined} featureCount={d.featureCount as number | undefined} />
      <Handle type="source" position={Position.Right} className={`!w-3 !h-3 ${PORT_COLORS.event} !border-2 !border-white dark:!border-gray-900`} />
    </div>
  )
}
