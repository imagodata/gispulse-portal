import { useState } from "react"
import { Input } from "@/components/ui/input"
import { ChevronDown, Trash2, Code } from "lucide-react"
import type { TriggerOperation, TriggerPhase, SpatialOperation } from "@/types/editor"
import { SPATIAL_OPS_BEFORE, SPATIAL_OPS_AFTER } from "../constants"
import { LayerSelect } from "../shared"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function needsDistantTable(op: TriggerOperation): boolean {
  if (op.phase === "after") return true
  return ["st_within", "st_contains", "st_intersects", "st_nearest",
    "st_dwithin_startpoint", "st_dwithin_endpoint"].includes(op.operation)
}

function needsAggField(op: SpatialOperation): boolean {
  return op.startsWith("sum_") || op === "string_agg_st_intersects"
}

function needsDistance(op: SpatialOperation): boolean {
  return ["st_nearest", "st_dwithin_startpoint", "st_dwithin_endpoint"].includes(op)
}

function isLocalCalc(op: SpatialOperation): boolean {
  return ["st_area", "st_length", "centroid"].includes(op)
}

function isAggregation(phase: TriggerPhase, op: SpatialOperation): boolean {
  return phase === "after" && op !== "custom_expression"
}

function generateSqlPreview(op: TriggerOperation): string {
  const src = op.table || "<source_table>"
  const field = op.field || "<field>"
  const dist = op.distant_table || "<distant_table>"
  const distField = op.distant_field || "id"
  const filter = op.filter ? `\n  AND ${op.filter}` : ""
  const distFilter = op.distant_filter ? `\n    AND ${op.distant_filter}` : ""
  const events = op.event || "INSERT,UPDATE"

  if (op.operation === "custom_expression") {
    return `-- ${op.phase.toUpperCase()} ${events} on ${src}\n${op.custom_expression || "-- custom SQL expression"}`
  }

  if (op.phase === "before") {
    if (isLocalCalc(op.operation)) {
      const fn = op.operation === "st_area" ? "ST_Area" : op.operation === "st_length" ? "ST_Length" : "ST_Centroid"
      return `-- BEFORE ${events} on ${src}\nNEW.${field} := ${fn}(NEW.geom);`
    }
    const stFn = op.operation.replace("st_", "ST_").replace("dwithin_startpoint", "DWithin").replace("dwithin_endpoint", "DWithin")
    return `-- BEFORE ${events} on ${src}\nNEW.${field} := (\n  SELECT d.${distField} FROM ${dist} d\n  WHERE ${stFn}(NEW.geom, d.geom)${distFilter}\n  LIMIT 1\n);${filter ? `\n-- WHERE ${op.filter}` : ""}`
  }

  // AFTER
  const opParts = op.operation.split("_st_")
  const aggFn = opParts[0]?.toUpperCase() ?? "COUNT"
  const stRel = opParts[1] ? `ST_${opParts[1].charAt(0).toUpperCase()}${opParts[1].slice(1)}` : "ST_Contains"
  const aggExpr = aggFn === "COUNT" ? "COUNT(*)" : aggFn === "STRING_AGG" ? `STRING_AGG(d.${distField}, ', ')` : `${aggFn}(d.${distField})`

  return `-- AFTER ${events} on ${src}\nUPDATE ${src} SET ${field} = (\n  SELECT ${aggExpr} FROM ${dist} d\n  WHERE ${stRel}(${src}.geom, d.geom)${distFilter}\n)${filter ? `\nWHERE ${op.filter}` : ""};`
}

// ---------------------------------------------------------------------------
// OperationCard
// ---------------------------------------------------------------------------

interface OperationCardProps {
  op: TriggerOperation
  index: number
  layers: string[]
  onChange: (op: TriggerOperation) => void
  onRemove: () => void
}

export function OperationCard({ op, index, layers, onChange, onRemove }: OperationCardProps) {
  const [sqlOpen, setSqlOpen] = useState(false)
  const spatialOps = op.phase === "before" ? SPATIAL_OPS_BEFORE : SPATIAL_OPS_AFTER
  const showDistant = needsDistantTable(op)
  const isCustom = op.operation === "custom_expression"
  const isAgg = isAggregation(op.phase, op.operation)
  const showAggField = needsAggField(op.operation)
  const showDist = needsDistance(op.operation)
  const borderColor = op.phase === "before" ? "border-l-[var(--gp-node-trigger)]" : "border-l-blue-500"

  return (
    <div className={`rounded-lg border border-l-2 ${borderColor} p-4 space-y-3`}>
      {/* Header: phase + operation + controls */}
      <div className="flex items-center gap-2">
        <span className="text-label font-bold text-muted-foreground/60 shrink-0">OP {index + 1}</span>

        <div className="flex gap-0.5 rounded-md border p-0.5">
          {(["before", "after"] as TriggerPhase[]).map((ph) => (
            <button
              key={ph}
              type="button"
              onClick={() => {
                const ops = ph === "before" ? SPATIAL_OPS_BEFORE : SPATIAL_OPS_AFTER
                onChange({ ...op, phase: ph, operation: ops[0].value })
              }}
              className={`rounded px-2.5 py-1 text-label-lg font-semibold transition-colors ${
                op.phase === ph ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {ph.toUpperCase()}
            </button>
          ))}
        </div>

        <select
          value={op.event}
          onChange={(e) => onChange({ ...op, event: e.target.value })}
          className="h-7 rounded-md border bg-background px-2 text-label-lg"
        >
          <option value="INSERT,UPDATE">INS+UPD</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
        </select>

        <div className="flex-1" />

        <label className="flex items-center gap-1.5 shrink-0">
          <input type="checkbox" checked={op.coalesce ?? false} onChange={(e) => onChange({ ...op, coalesce: e.target.checked })} className="rounded" />
          <span className="text-label-lg text-muted-foreground">Coalesce</span>
        </label>

        <Input
          type="number"
          value={op.order ?? ""}
          onChange={(e) => onChange({ ...op, order: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="#"
          className="text-label-lg h-7 w-12 px-2 text-center"
          title="Execution order"
        />

        <button type="button" onClick={onRemove} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Source → Operation layout */}
      <div className="grid grid-cols-2 gap-3">
        {/* SOURCE */}
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-label font-semibold uppercase tracking-wider text-muted-foreground/60">Source</p>
          <div className="space-y-1.5">
            <LayerSelect value={op.table} onChange={(v) => onChange({ ...op, table: v })} layers={layers} />
            <Input value={op.field} onChange={(e) => onChange({ ...op, field: e.target.value })} placeholder="Field to compute" className="text-sm h-8" />
            <Input value={op.filter ?? ""} onChange={(e) => onChange({ ...op, filter: e.target.value || undefined })} placeholder="WHERE filter (optional)" className="text-label-lg h-7" />
          </div>
        </div>

        {/* OPERATION */}
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-label font-semibold uppercase tracking-wider text-muted-foreground/60">
            {isAgg ? "Aggregation" : "Operation"}
          </p>
          <select
            value={op.operation}
            onChange={(e) => onChange({ ...op, operation: e.target.value as SpatialOperation })}
            className="w-full h-9 rounded-md border bg-background px-3 text-sm"
          >
            {spatialOps.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <p className="text-label-lg text-muted-foreground italic">
            {spatialOps.find((s) => s.value === op.operation)?.description}
          </p>
        </div>
      </div>

      {/* Distant / Reference table (conditional) */}
      {showDistant && !isLocalCalc(op.operation) && !isCustom && (
        <div className="rounded-lg bg-muted/30 p-3 border border-dashed space-y-2">
          <p className="text-label font-semibold uppercase tracking-wider text-muted-foreground/60">
            {isAgg ? "Distant table (aggregation target)" : "Reference table"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-label text-muted-foreground">Table</label>
              <LayerSelect value={op.distant_table ?? ""} onChange={(v) => onChange({ ...op, distant_table: v })} layers={layers} />
            </div>
            <div className="space-y-1.5">
              <label className="text-label text-muted-foreground">
                {showAggField ? "Agg field" : "Join key"}
              </label>
              <Input
                value={op.distant_field ?? ""}
                onChange={(e) => onChange({ ...op, distant_field: e.target.value })}
                placeholder={showAggField ? "field to aggregate" : "id"}
                className="text-sm h-8"
              />
            </div>
          </div>
          <Input
            value={op.distant_filter ?? ""}
            onChange={(e) => onChange({ ...op, distant_filter: e.target.value || undefined })}
            placeholder="WHERE filter on distant (optional)"
            className="text-label-lg h-7"
          />
          {showDist && (
            <div className="space-y-1">
              <label className="text-label text-muted-foreground">Max distance (m)</label>
              <Input
                type="number"
                value={op.distant_filter ?? ""}
                onChange={(e) => onChange({ ...op, distant_filter: e.target.value || undefined })}
                placeholder="1000"
                className="text-sm h-8 w-32"
              />
            </div>
          )}
        </div>
      )}

      {/* Custom expression */}
      {isCustom && (
        <textarea
          value={op.custom_expression ?? ""}
          onChange={(e) => onChange({ ...op, custom_expression: e.target.value })}
          placeholder="SQL expression..."
          className="w-full h-20 rounded-md border bg-background px-3 py-2 text-[12px] font-mono resize-y"
        />
      )}

      {/* SQL Preview (collapsible) */}
      <button
        type="button"
        onClick={() => setSqlOpen(!sqlOpen)}
        className="flex items-center gap-1.5 text-label-lg text-muted-foreground hover:text-foreground transition-colors"
      >
        <Code className="h-3 w-3" />
        SQL Preview
        <ChevronDown className={`h-3 w-3 transition-transform ${sqlOpen ? "rotate-180" : ""}`} />
      </button>
      {sqlOpen && (
        <pre className="rounded-md bg-muted p-3 text-label-lg font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
          {generateSqlPreview(op)}
        </pre>
      )}
    </div>
  )
}
