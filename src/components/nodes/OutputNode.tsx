import { Handle, Position, type NodeProps } from "@xyflow/react"
import { PORT_COLORS } from "./portTypes"
import { StatusBadge } from "./StatusBadge"
import type { NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "./nodeStyles"
import { Download } from "lucide-react"

export function OutputNode({ data }: NodeProps) {
  const d = data as Record<string, unknown>
  return (
    <div className={nodeContainerClass("output")}>
      <Handle type="target" position={Position.Left} className={`!w-3 !h-3 ${PORT_COLORS.geometry} !border-2 !border-white dark:!border-gray-900`} />
      <div className={nodeHeaderClass("output")}>
        <Download className="h-3 w-3 inline mr-1 -mt-0.5" />
        Output
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {(d.label as string) ?? "Export"}
      </div>
      <StatusBadge status={d.status as NodeExecStatus | undefined} featureCount={d.featureCount as number | undefined} />
    </div>
  )
}
