import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "./portTypes"
import { StatusBadge } from "./StatusBadge"
import type { NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "./nodeStyles"
import { GitBranch } from "lucide-react"

export function BranchNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>
  const { setNodes } = useReactFlow()

  const condition = (d.condition as string) ?? ""

  const update = (value: string) => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, condition: value } } : n)
    )
  }

  return (
    <div className={nodeContainerClass("control")}>
      <Handle type="target" position={Position.Left} className={`!w-3 !h-3 ${PORT_COLORS.geometry} !border-2 !border-white dark:!border-gray-900`} />

      <div className={nodeHeaderClass("control")}>
        <GitBranch className="h-3 w-3 inline mr-1 -mt-0.5" />
        Branch
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {(d.label as string) ?? "If / Else"}
      </div>

      <input
        type="text"
        value={condition}
        onChange={(e) => { e.stopPropagation(); update(e.target.value) }}
        onClick={(e) => e.stopPropagation()}
        placeholder="e.g. area > 1000"
        className="nodrag mt-1.5 w-full text-label rounded border border-[var(--gp-node-control)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-control)]"
      />

      <div className="mt-1 flex justify-between text-label-sm font-mono">
        <span className="text-emerald-600">true →</span>
        <span className="text-red-500">false →</span>
      </div>

      <StatusBadge status={d.status as NodeExecStatus | undefined} featureCount={d.featureCount as number | undefined} />

      <Handle type="source" position={Position.Right} id={`${id}-true`} style={{ top: "40%" }} className={`!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-gray-900`} />
      <Handle type="source" position={Position.Right} id={`${id}-false`} style={{ top: "75%" }} className="!w-3 !h-3 !bg-red-500 !border-2 !border-white dark:!border-gray-900" />
    </div>
  )
}
