import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "./portTypes"
import { StatusBadge } from "./StatusBadge"
import type { NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "./nodeStyles"
import { useDatasetStore } from "@/stores/datasetStore"
import { Database } from "lucide-react"

export function DatasetSourceNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>
  const datasets = useDatasetStore((s) => s.datasets)
  const { setNodes } = useReactFlow()

  const currentDatasetId = d.datasetId as string | undefined
  const currentLayerName = d.layerName as string | undefined
  const currentDataset = datasets.find((ds) => ds.id === currentDatasetId)
  const layerCount = currentDataset?.layers?.length ?? 0

  const handleDatasetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    const dsId = e.target.value
    const ds = datasets.find((d) => d.id === dsId)
    const firstLayer = ds?.layers?.[0]?.name ?? ""
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, datasetId: dsId, layerName: firstLayer, label: firstLayer || ds?.name || "Dataset" } }
          : n
      )
    )
  }

  const handleLayerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    const layerName = e.target.value
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, layerName, label: layerName } }
          : n
      )
    )
  }

  return (
    <div className={nodeContainerClass("source")}>
      <div className={nodeHeaderClass("source")}>
        <Database className="h-3 w-3 inline mr-1 -mt-0.5" />
        Source
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {String(d.label ?? "Dataset")}
      </div>

      {datasets.length > 0 && (
        <div className="mt-1.5 space-y-1">
          <select
            value={currentDatasetId ?? ""}
            onChange={handleDatasetChange}
            onClick={(e) => e.stopPropagation()}
            className="nodrag w-full text-label rounded border border-[var(--gp-node-source)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-source)]"
          >
            <option value="">Select dataset...</option>
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
          {currentDataset && layerCount > 1 && (
            <select
              value={currentLayerName ?? ""}
              onChange={handleLayerChange}
              onClick={(e) => e.stopPropagation()}
              className="nodrag w-full text-label rounded border border-[var(--gp-node-source)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-source)]"
            >
              {(currentDataset.layers ?? []).map((l) => (
                <option key={l.name} value={l.name}>{l.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <StatusBadge status={d.status as NodeExecStatus | undefined} featureCount={d.featureCount as number | undefined} />
      <Handle type="source" position={Position.Right} className={`!w-3 !h-3 ${PORT_COLORS.geometry} !border-2 !border-white dark:!border-gray-900`} />
    </div>
  )
}
