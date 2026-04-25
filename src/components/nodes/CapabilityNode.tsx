import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "./portTypes"
import { StatusBadge } from "./StatusBadge"
import type { NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "./nodeStyles"
import { Cog } from "lucide-react"

/** Capability icons/labels for compact display */
const CAPABILITY_INFO: Record<string, { emoji: string; short: string }> = {
  buffer:       { emoji: "◎", short: "Buffer" },
  intersect:    { emoji: "∩", short: "Intersect" },
  spatial_join: { emoji: "⋈", short: "Spatial Join" },
  filter:       { emoji: "⊘", short: "Filter" },
  dissolve:     { emoji: "◈", short: "Dissolve" },
  reproject:    { emoji: "↻", short: "Reproject" },
  classify:     { emoji: "▤", short: "Classify" },
  clip:         { emoji: "✂", short: "Clip" },
  union:        { emoji: "∪", short: "Union" },
  difference:   { emoji: "∖", short: "Difference" },
  centroid:     { emoji: "⊕", short: "Centroid" },
  simplify:     { emoji: "△", short: "Simplify" },
}

/** Primary param to show inline per capability */
const PRIMARY_PARAM: Record<string, { key: string; label: string; type: "number" | "select" | "text"; options?: string[] }> = {
  buffer:       { key: "distance", label: "Distance", type: "number" },
  intersect:    { key: "predicate", label: "Predicate", type: "select", options: ["intersects", "within", "contains", "touches", "crosses"] },
  spatial_join: { key: "predicate", label: "Predicate", type: "select", options: ["intersects", "within", "contains", "nearest"] },
  filter:       { key: "expression", label: "Where", type: "text" },
  dissolve:     { key: "by", label: "Group by", type: "text" },
  reproject:    { key: "target_crs", label: "CRS", type: "text" },
  classify:     { key: "method", label: "Method", type: "select", options: ["equal_interval", "quantile", "jenks", "std_dev"] },
}

export function CapabilityNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>
  const capability = (d.capability as string) ?? ""
  const label = (d.label as string) ?? capability
  const config = (d.config as Record<string, unknown>) ?? {}
  const { setNodes } = useReactFlow()
  const info = CAPABILITY_INFO[capability]
  const primary = PRIMARY_PARAM[capability]

  const updateConfig = (key: string, value: unknown) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, config: { ...config, [key]: value } } }
          : n
      )
    )
  }

  // Config summary for non-primary params
  const configSummary = Object.entries(config)
    .filter(([k, v]) => v !== "" && v !== null && k !== primary?.key)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(", ")

  return (
    <div className={nodeContainerClass("transform")}>
      <Handle type="target" position={Position.Left} className={`!w-3 !h-3 ${PORT_COLORS.geometry} !border-2 !border-white dark:!border-gray-900`} />

      <div className={nodeHeaderClass("transform")}>
        {info ? (
          <span className="mr-1">{info.emoji}</span>
        ) : (
          <Cog className="h-3 w-3 inline mr-1 -mt-0.5" />
        )}
        {info?.short ?? (capability || "Transform")}
      </div>
      <div className="text-xs font-semibold text-foreground truncate">{label}</div>

      {/* Single primary parameter inline */}
      {primary && (
        <div className="mt-1.5 flex items-center gap-1">
          <label className="text-label-sm text-muted-foreground shrink-0">{primary.label}</label>
          {primary.type === "number" && (
            <input
              type="number"
              value={config[primary.key] as number ?? ""}
              onChange={(e) => { e.stopPropagation(); updateConfig(primary.key, e.target.value ? Number(e.target.value) : "") }}
              onClick={(e) => e.stopPropagation()}
              className="nodrag flex-1 text-label rounded border border-[var(--gp-node-transform)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-transform)] w-16"
            />
          )}
          {primary.type === "select" && (
            <select
              value={(config[primary.key] as string) ?? ""}
              onChange={(e) => { e.stopPropagation(); updateConfig(primary.key, e.target.value) }}
              onClick={(e) => e.stopPropagation()}
              className="nodrag flex-1 text-label rounded border border-[var(--gp-node-transform)]/30 bg-background px-1 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-transform)]"
            >
              <option value="">--</option>
              {primary.options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {primary.type === "text" && (
            <input
              type="text"
              value={(config[primary.key] as string) ?? ""}
              onChange={(e) => { e.stopPropagation(); updateConfig(primary.key, e.target.value) }}
              onClick={(e) => e.stopPropagation()}
              placeholder="..."
              className="nodrag flex-1 text-label rounded border border-[var(--gp-node-transform)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-transform)]"
            />
          )}
        </div>
      )}

      {/* Extra config summary */}
      {configSummary && (
        <p className="mt-0.5 text-label-sm text-muted-foreground font-mono truncate" title={configSummary}>
          {configSummary}
        </p>
      )}

      <StatusBadge status={d.status as NodeExecStatus | undefined} featureCount={d.featureCount as number | undefined} />
      <Handle type="source" position={Position.Right} className={`!w-3 !h-3 ${PORT_COLORS.geometry} !border-2 !border-white dark:!border-gray-900`} />
    </div>
  )
}
