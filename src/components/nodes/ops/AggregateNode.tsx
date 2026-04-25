/**
 * AggregateNode — AFTER-phase aggregation operation.
 * Aggregate function (COUNT/SUM/STRING_AGG) + spatial predicate (ST_Contains/ST_Within/ST_Intersects).
 * Updates a distant table, e.g. COUNT ST_Contains → UPDATE zones SET total_structures = ...
 */

import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "../portTypes"
import { StatusBadge } from "../StatusBadge"
import { useEditorStore, type NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "../nodeStyles"
import { BarChart3, ArrowRight } from "lucide-react"
import { AGGREGATE_OPS, type AggregateData } from "./types"
import type { SpatialOperation } from "@/types/editor"
import { useUpstreamSource } from "@/hooks/useUpstreamSource"
import { useTableColumns } from "@/hooks/useTableColumns"

/* ── Decompose the combined operation into function + predicate ── */
const AGG_FUNCTIONS = [
  { value: "count",      label: "COUNT" },
  { value: "sum",        label: "SUM" },
  { value: "string_agg", label: "STRING_AGG" },
] as const

const PREDICATES = [
  { value: "st_contains",   label: "ST_Contains",   description: "Features contained in zone" },
  { value: "st_within",     label: "ST_Within",      description: "Features within zone" },
  { value: "st_intersects", label: "ST_Intersects",  description: "Intersecting features" },
] as const

type AggFn = typeof AGG_FUNCTIONS[number]["value"]
type Predicate = typeof PREDICATES[number]["value"]

function parseOperation(op: string): { fn: AggFn; pred: Predicate } {
  for (const f of AGG_FUNCTIONS) {
    for (const p of PREDICATES) {
      if (op === `${f.value}_${p.value}`) return { fn: f.value, pred: p.value }
    }
  }
  // fallback: parse prefix
  if (op.startsWith("string_agg_")) return { fn: "string_agg", pred: op.replace("string_agg_", "") as Predicate }
  if (op.startsWith("sum_"))        return { fn: "sum",        pred: op.replace("sum_", "") as Predicate }
  return { fn: "count", pred: op.replace("count_", "") as Predicate || "st_contains" }
}

function buildOperation(fn: AggFn, pred: Predicate): SpatialOperation {
  return `${fn}_${pred}` as SpatialOperation
}

/** Whether this function needs a source field input */
function needsSourceField(fn: AggFn): boolean {
  return fn === "sum" || fn === "string_agg"
}

const inputClass = "nodrag w-full text-label rounded border border-[var(--gp-node-output)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-output)] font-mono"
const selectClass = "nodrag w-full text-label rounded border border-[var(--gp-node-output)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-output)]"
const sectionLabel = "text-label-xs uppercase tracking-wider text-muted-foreground"

export function AggregateNode({ id, data }: NodeProps) {
  const d = data as unknown as AggregateData & { status?: NodeExecStatus }
  const { setNodes } = useReactFlow()
  const setGraphDirty = useEditorStore((s) => s.setGraphDirty)

  const { fn, pred } = parseOperation(d.operation || "count_st_contains")
  const predDef = PREDICATES.find((p) => p.value === pred)
  const opDef = AGGREGATE_OPS.find((o) => o.operation === d.operation)

  // Auto-populate: upstream source columns + distant table columns
  const upstream = useUpstreamSource(id)
  const { columns: sourceColumns } = useTableColumns(
    upstream?.schema ?? "", upstream?.table ?? "",
  )
  const { columns: distantColumns, tables: availableTables } = useTableColumns(
    d.distantSchema ?? "", d.distantTable ?? "",
  )

  const update = (key: string, value: unknown) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n)),
    )
    setGraphDirty(true)
  }

  const setOperation = (newFn: AggFn, newPred: Predicate) => {
    const op = buildOperation(newFn, newPred)
    const label = AGGREGATE_OPS.find((o) => o.operation === op)?.label
      ?? `${AGG_FUNCTIONS.find((f) => f.value === newFn)?.label} ${PREDICATES.find((p) => p.value === newPred)?.label}`
    update("operation", op)
    update("label", label)
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
    <div className={nodeContainerClass("output")}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${PORT_COLORS.event} !border-2 !border-white dark:!border-gray-900`}
      />

      <div className={nodeHeaderClass("output")}>
        <BarChart3 className="h-3 w-3 inline mr-1 -mt-0.5" />
        Aggregate · AFTER
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {d.label || opDef?.label || "Aggregate"}
      </div>

      <div className="mt-1.5 space-y-1.5">
        {/* ── Function + Predicate ── */}
        <div className="space-y-1">
          <div className="flex gap-1">
            {/* Aggregate function */}
            <select
              value={fn}
              onChange={(e) => {
                e.stopPropagation()
                setOperation(e.target.value as AggFn, pred)
              }}
              onClick={(e) => e.stopPropagation()}
              className={`${selectClass} w-[45%] font-semibold`}
            >
              {AGG_FUNCTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {/* Spatial predicate */}
            <select
              value={pred}
              onChange={(e) => {
                e.stopPropagation()
                setOperation(fn, e.target.value as Predicate)
              }}
              onClick={(e) => e.stopPropagation()}
              className={`${selectClass} flex-1`}
              title={predDef?.description}
            >
              {PREDICATES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Predicate description */}
          {predDef && (
            <div className="text-label-xs text-muted-foreground italic pl-0.5 truncate">
              {predDef.description}
            </div>
          )}
        </div>

        {/* ── Source field (for SUM / STRING_AGG) — auto-populated from upstream ── */}
        {needsSourceField(fn) && (
          <div className="space-y-0.5">
            <div className={sectionLabel}>
              {fn === "sum" ? "Field to sum" : "Field to concatenate"}
            </div>
            {sourceColumns.length > 0 ? (
              <select
                value={d.sourceField || ""}
                onChange={(e) => { e.stopPropagation(); update("sourceField", e.target.value) }}
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
                value={d.sourceField || ""}
                onChange={(e) => { e.stopPropagation(); update("sourceField", e.target.value) }}
                onClick={(e) => e.stopPropagation()}
                placeholder={fn === "sum" ? "e.g. length_m" : "e.g. name"}
                className={inputClass}
              />
            )}
          </div>
        )}

        {/* ── Target: UPDATE distant table — auto-populated ── */}
        <div className="space-y-0.5">
          <div className={`${sectionLabel} flex items-center gap-0.5`}>
            <ArrowRight className="h-2 w-2" />
            Update target
          </div>
          {availableTables.length > 0 ? (
            <select
              value={distantLabel}
              onChange={(e) => { e.stopPropagation(); handleDistantTableChange(e.target.value) }}
              onClick={(e) => e.stopPropagation()}
              className={`${selectClass} font-mono`}
            >
              <option value="">-- select table --</option>
              {availableTables.map((t) => (
                <option key={t.label} value={t.label}>{t.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={distantLabel}
              onChange={(e) => { e.stopPropagation(); handleDistantTableChange(e.target.value) }}
              onClick={(e) => e.stopPropagation()}
              placeholder="schema.table"
              className={inputClass}
            />
          )}
          {distantColumns.length > 0 ? (
            <select
              value={d.distantField || ""}
              onChange={(e) => { e.stopPropagation(); update("distantField", e.target.value) }}
              onClick={(e) => e.stopPropagation()}
              className={`${selectClass} font-mono`}
            >
              <option value="">-- select field --</option>
              {distantColumns.map((c) => (
                <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={d.distantField || ""}
              onChange={(e) => { e.stopPropagation(); update("distantField", e.target.value) }}
              onClick={(e) => e.stopPropagation()}
              placeholder="field to update"
              className={inputClass}
            />
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      {(d.filter || d.distantFilter) && (
        <div className="mt-1 space-y-0.5">
          {d.filter && (
            <div className="text-label text-muted-foreground font-mono truncate" title={`Source WHERE ${d.filter}`}>
              <span className="text-[var(--gp-node-output)]">WHERE</span> {d.filter}
            </div>
          )}
          {d.distantFilter && (
            <div className="text-label text-muted-foreground font-mono truncate" title={`Target WHERE ${d.distantFilter}`}>
              <span className="text-[var(--gp-node-output)]">dst WHERE</span> {d.distantFilter}
            </div>
          )}
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
        className={`!w-3 !h-3 ${PORT_COLORS.tabular} !border-2 !border-white dark:!border-gray-900`}
      />
    </div>
  )
}
