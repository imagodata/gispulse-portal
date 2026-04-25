/**
 * SpatialOpNode — Spatial operation (BEFORE phase).
 * ST_Within, ST_Intersects, ST_Contains, ST_DWithin, ST_Length, ST_Area, etc.
 * Sets a field on the current row before the DML commits.
 */

import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "../portTypes"
import { StatusBadge } from "../StatusBadge"
import { useEditorStore, type NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "../nodeStyles"
import { MapPin, SkipForward, Plus, X } from "lucide-react"
import { SPATIAL_OPS, type SpatialOpData } from "./types"
import { useUpstreamSource } from "@/hooks/useUpstreamSource"
import { useTableColumns } from "@/hooks/useTableColumns"

const inputClass = "nodrag w-full text-label rounded border border-[var(--gp-node-transform)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-transform)] font-mono"
const selectClass = "nodrag w-full text-label rounded border border-[var(--gp-node-transform)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-transform)]"

export function SpatialOpNode({ id, data }: NodeProps) {
  const d = data as unknown as SpatialOpData & { status?: NodeExecStatus }
  const { setNodes } = useReactFlow()
  const setGraphDirty = useEditorStore((s) => s.setGraphDirty)

  const opDef = SPATIAL_OPS.find((o) => o.operation === d.operation)

  // Auto-populate: upstream source columns + distant table columns
  const upstream = useUpstreamSource(id)
  const { columns: sourceColumns } = useTableColumns(
    upstream?.schema ?? "", upstream?.table ?? "",
  )
  const { columns: _distantColumns, tables: availableTables } = useTableColumns(
    d.distantSchema ?? "", d.distantTable ?? "",
  )

  const update = (key: string, value: unknown) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n)),
    )
    setGraphDirty(true)
  }

  const distantLabel = d.distantSchema
    ? `${d.distantSchema}.${d.distantTable}`
    : d.distantTable || ""

  const handleDistantTableChange = (val: string) => {
    const parts = val.split(".")
    if (parts.length >= 2) {
      update("distantSchema", parts[0])
      update("distantTable", parts.slice(1).join("."))
    } else {
      update("distantSchema", "")
      update("distantTable", val)
    }
  }

  return (
    <div className={nodeContainerClass("transform")}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${PORT_COLORS.event} !border-2 !border-white dark:!border-gray-900`}
      />

      <div className={nodeHeaderClass("transform")}>
        <MapPin className="h-3 w-3 inline mr-1 -mt-0.5" />
        Spatial · BEFORE
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {d.label || opDef?.label || "Spatial Op"}
      </div>

      <div className="mt-1.5 space-y-1">
        {/* Operation selector */}
        <select
          value={d.operation || "st_within"}
          onChange={(e) => {
            e.stopPropagation()
            const op = SPATIAL_OPS.find((o) => o.operation === e.target.value)
            update("operation", e.target.value)
            if (op) update("label", op.label)
          }}
          onClick={(e) => e.stopPropagation()}
          className={selectClass}
        >
          {SPATIAL_OPS.map((op) => (
            <option key={op.operation} value={op.operation}>{op.label}</option>
          ))}
        </select>

        {/* Target field — auto-populated from upstream source */}
        {sourceColumns.length > 0 ? (
          <select
            value={d.field || ""}
            onChange={(e) => { e.stopPropagation(); update("field", e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            className={`${selectClass} font-mono`}
          >
            <option value="">-- select field --</option>
            {sourceColumns.map((c) => (
              <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={d.field || ""}
            onChange={(e) => { e.stopPropagation(); update("field", e.target.value) }}
            onClick={(e) => e.stopPropagation()}
            placeholder="-> field"
            className={inputClass}
          />
        )}

        {/* Distant table (for ops that need it) — auto-populated */}
        {opDef?.needsDistant && (
          availableTables.length > 0 ? (
            <select
              value={distantLabel}
              onChange={(e) => { e.stopPropagation(); handleDistantTableChange(e.target.value) }}
              onClick={(e) => e.stopPropagation()}
              className={`${selectClass} font-mono`}
            >
              <option value="">-- distant table --</option>
              {availableTables.map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={distantLabel}
              onChange={(e) => {
                e.stopPropagation()
                handleDistantTableChange(e.target.value)
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="distant schema.table"
              className={inputClass}
            />
          )
        )}

        {/* Distance for ST_DWithin variants */}
        {(d.operation === "st_dwithin_startpoint" || d.operation === "st_dwithin_endpoint" || d.operation === "st_nearest") && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={d.distance ?? 50}
              onChange={(e) => { e.stopPropagation(); update("distance", Number(e.target.value)) }}
              onClick={(e) => e.stopPropagation()}
              className="nodrag w-16 text-label rounded border border-[var(--gp-node-transform)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-transform)] font-mono"
            />
            <span className="text-label text-muted-foreground">m</span>
          </div>
        )}

        {/* Polymorphic UNION sources for DWithin startpoint/endpoint */}
        {opDef?.supportsMultiSource && (
          <div className="space-y-0.5">
            <div className="text-label-xs uppercase tracking-wider text-muted-foreground">Sources (UNION)</div>
            {(d.unionSources || []).map((src, idx) => (
              <div key={idx} className="flex items-center gap-0.5">
                <input
                  type="text"
                  value={src.schema ? `${src.schema}.${src.table}` : src.table}
                  onChange={(e) => {
                    e.stopPropagation()
                    const parts = e.target.value.split(".")
                    const sources = [...(d.unionSources || [])]
                    sources[idx] = parts.length >= 2
                      ? { schema: parts[0], table: parts.slice(1).join(".") }
                      : { schema: "", table: e.target.value }
                    update("unionSources", sources)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="schema.table"
                  className="nodrag flex-1 text-label-sm font-mono rounded border border-[var(--gp-node-transform)]/30 bg-background px-1 py-0.5 outline-none"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    const sources = (d.unionSources || []).filter((_, i) => i !== idx)
                    update("unionSources", sources)
                  }}
                  className="nodrag text-muted-foreground hover:text-red-500 p-0"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                update("unionSources", [...(d.unionSources || []), { schema: "", table: "" }])
              }}
              className="nodrag flex items-center gap-0.5 text-label-sm text-[var(--gp-node-transform)] hover:underline"
            >
              <Plus className="h-2 w-2" />
              Add source
            </button>
          </div>
        )}
      </div>

      {/* Filter (WHERE clause) */}
      {d.filter && (
        <div className="mt-1 text-label text-muted-foreground font-mono truncate" title={`WHERE ${d.filter}`}>
          WHERE {d.filter}
        </div>
      )}

      {/* Coalesce indicator */}
      {d.coalesce && (
        <div className="mt-1 flex items-center gap-1 text-label text-amber-600">
          <SkipForward className="h-2.5 w-2.5" />
          <span>coalesce</span>
        </div>
      )}

      {/* Order badge */}
      {d.order != null && (
        <div className="mt-0.5 text-label text-muted-foreground font-mono">
          order: {d.order}
        </div>
      )}

      <StatusBadge status={d.status} />
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3 !h-3 ${PORT_COLORS.geometry} !border-2 !border-white dark:!border-gray-900`}
      />
    </div>
  )
}
