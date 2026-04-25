import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  AnyPredicate,
  CompoundPredicate,
  AttrPredicate,
  GeomPredicate,
  AttrOp,
  GeomOp,
  AggregateFunction,
} from "@/types/editor"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ATTR_OPS: { value: AttrOp; label: string }[] = [
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
  { value: "in", label: "IN" },
  { value: "like", label: "LIKE" },
]

const GEOM_OPS: { value: GeomOp; label: string }[] = [
  { value: "intersects", label: "ST_Intersects" },
  { value: "within", label: "ST_Within" },
  { value: "contains", label: "ST_Contains" },
  { value: "crosses", label: "ST_Crosses" },
  { value: "overlaps", label: "ST_Overlaps" },
  { value: "touches", label: "ST_Touches" },
  { value: "distance_lt", label: "Distance <" },
  { value: "distance_gt", label: "Distance >" },
]

const AGGREGATE_FNS: { value: AggregateFunction; label: string }[] = [
  { value: "count", label: "COUNT" },
  { value: "sum", label: "SUM" },
  { value: "avg", label: "AVG" },
  { value: "min", label: "MIN" },
  { value: "max", label: "MAX" },
]

const AGG_COMPARE_OPS: { value: string; label: string }[] = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
]

const MAX_DEPTH = 2

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAggregationPredicate(node: GeomPredicate): boolean {
  return !!node.aggregate_fn
}

function describeAggregation(node: GeomPredicate): string {
  if (!node.aggregate_fn) return ""
  const fn = node.aggregate_fn.toUpperCase()
  const op = AGG_COMPARE_OPS.find((o) => o.value === node.aggregate_op)?.label ?? ">"
  const val = node.aggregate_value ?? "?"
  const table = node.ref_table || "?"
  const geomOp = GEOM_OPS.find((o) => o.value === node.op)?.label ?? "?"
  const field = node.ref_column || "*"
  return `Fire if ${fn}(${field}) of ${table} features matching ${geomOp} ${op} ${val}`
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PredicateBuilderProps {
  value: CompoundPredicate
  onChange: (node: CompoundPredicate) => void
  fields?: string[]
  tables?: string[]
}

interface GroupProps {
  node: CompoundPredicate
  onChange: (node: CompoundPredicate) => void
  onRemove?: () => void
  depth: number
  fields: string[]
  tables: string[]
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function PredicateBuilder({ value, onChange, fields = [], tables = [] }: PredicateBuilderProps) {
  return (
    <PredicateGroup node={value} onChange={onChange} depth={0} fields={fields} tables={tables} />
  )
}

// ---------------------------------------------------------------------------
// Compound group (recursive)
// ---------------------------------------------------------------------------

function PredicateGroup({ node, onChange, onRemove, depth, fields, tables }: GroupProps) {
  const bgClass = depth % 2 === 0 ? "bg-muted/30" : "bg-muted/60"

  const updateChild = useCallback(
    (idx: number, child: AnyPredicate) => {
      const next = [...node.predicates]
      next[idx] = child
      onChange({ ...node, predicates: next })
    },
    [node, onChange],
  )

  const removeChild = useCallback(
    (idx: number) => {
      onChange({ ...node, predicates: node.predicates.filter((_, i) => i !== idx) })
    },
    [node, onChange],
  )

  const addAttr = useCallback(() => {
    const newNode: AttrPredicate = { type: "attr", field: "", op: "eq", value: "" }
    onChange({ ...node, predicates: [...node.predicates, newNode] })
  }, [node, onChange])

  const addGeom = useCallback(() => {
    const newNode: GeomPredicate = {
      type: "geom",
      op: "intersects",
      ref_table: "",
      ref_geom_col: "geom",
    }
    onChange({ ...node, predicates: [...node.predicates, newNode] })
  }, [node, onChange])

  const addAggregation = useCallback(() => {
    const newNode: GeomPredicate = {
      type: "geom",
      op: "contains",
      ref_table: "",
      ref_geom_col: "geom",
      aggregate_fn: "count",
      aggregate_op: "gt",
      aggregate_value: 0,
    }
    onChange({ ...node, predicates: [...node.predicates, newNode] })
  }, [node, onChange])

  const addGroup = useCallback(() => {
    if (depth >= MAX_DEPTH - 1) return
    const newNode: CompoundPredicate = { type: "compound", logic: "AND", predicates: [] }
    onChange({ ...node, predicates: [...node.predicates, newNode] })
  }, [node, onChange, depth])

  const setLogic = useCallback(
    (logic: "AND" | "OR" | "NOT") => {
      onChange({ ...node, logic })
    },
    [node, onChange],
  )

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${bgClass}`}>
      {/* Header: logic selector + remove */}
      <div className="flex items-center gap-1">
        {(["AND", "OR", "NOT"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLogic(l)}
            className={`rounded px-2.5 py-1 text-label font-semibold transition-colors ${
              node.logic === l
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {l}
          </button>
        ))}
        <div className="flex-1" />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="h-5 w-5 flex items-center justify-center rounded text-label text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Remove group"
          >
            {"\u2715"}
          </button>
        )}
      </div>

      {/* Children */}
      {node.predicates.map((child, idx) => (
        <div key={idx}>
          {child.type === "compound" ? (
            <PredicateGroup
              node={child}
              onChange={(c) => updateChild(idx, c)}
              onRemove={() => removeChild(idx)}
              depth={depth + 1}
              fields={fields}
              tables={tables}
            />
          ) : child.type === "attr" ? (
            <AttrPredicateEditor
              node={child}
              onChange={(c) => updateChild(idx, c)}
              onRemove={() => removeChild(idx)}
              fields={fields}
            />
          ) : isAggregationPredicate(child as GeomPredicate) ? (
            <AggregationPredicateEditor
              node={child as GeomPredicate}
              onChange={(c) => updateChild(idx, c)}
              onRemove={() => removeChild(idx)}
              tables={tables}
            />
          ) : (
            <GeomPredicateEditor
              node={child as GeomPredicate}
              onChange={(c) => updateChild(idx, c)}
              onRemove={() => removeChild(idx)}
              tables={tables}
            />
          )}
        </div>
      ))}

      {/* Add buttons */}
      <div className="flex items-center gap-1.5 pt-1">
        <Button type="button" variant="outline" size="sm" className="h-7 text-label-lg" onClick={addAttr}>
          + Attribute
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-label-lg" onClick={addGeom}>
          + Geometry
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-label-lg" onClick={addAggregation}>
          + Aggregation
        </Button>
        {depth < MAX_DEPTH - 1 && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-label-lg" onClick={addGroup}>
            + Group
          </Button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Attribute predicate row
// ---------------------------------------------------------------------------

function AttrPredicateEditor({
  node, onChange, onRemove, fields,
}: {
  node: AttrPredicate
  onChange: (node: AttrPredicate) => void
  onRemove: () => void
  fields: string[]
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2">
      <span className="text-label font-semibold text-muted-foreground shrink-0">ATTR</span>

      {fields.length > 0 ? (
        <select
          value={node.field}
          onChange={(e) => onChange({ ...node, field: e.target.value })}
          className="h-7 rounded-md border bg-background px-2 text-xs flex-1 min-w-0"
        >
          <option value="">field...</option>
          {fields.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      ) : (
        <Input value={node.field} onChange={(e) => onChange({ ...node, field: e.target.value })} placeholder="field" className="text-xs h-7 flex-1 min-w-0 px-2" />
      )}

      <select value={node.op} onChange={(e) => onChange({ ...node, op: e.target.value as AttrOp })} className="h-7 rounded-md border bg-background px-2 text-xs">
        {ATTR_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <Input value={String(node.value ?? "")} onChange={(e) => onChange({ ...node, value: e.target.value })} placeholder="value" className="text-xs h-7 w-24 px-2" />

      <button type="button" onClick={onRemove} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" title="Remove">
        {"\u2715"}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Geometry predicate — distant table reference
// ---------------------------------------------------------------------------

function GeomPredicateEditor({
  node, onChange, onRemove, tables,
}: {
  node: GeomPredicate
  onChange: (node: GeomPredicate) => void
  onRemove: () => void
  tables: string[]
}) {
  const showDistance = node.op === "distance_lt" || node.op === "distance_gt"

  return (
    <div className="rounded-lg border border-l-2 border-l-[var(--gp-geom-polygon)] bg-background p-3 space-y-2">
      {/* Row 1: type + op + remove */}
      <div className="flex items-center gap-1.5">
        <span className="text-label font-semibold text-[var(--gp-geom-polygon)] shrink-0">GEOM</span>

        <select value={node.op} onChange={(e) => onChange({ ...node, op: e.target.value as GeomOp })} className="h-7 rounded-md border bg-background px-2 text-xs">
          {GEOM_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="flex-1" />

        <button type="button" onClick={onRemove} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" title="Remove">
          {"\u2715"}
        </button>
      </div>

      {/* Distant table block */}
      <div className="rounded-lg bg-muted/30 p-2.5 border border-dashed space-y-2">
        <p className="text-label font-semibold uppercase tracking-wider text-muted-foreground/60">Distant table</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-label text-muted-foreground">Table</label>
            {tables.length > 0 ? (
              <select value={node.ref_table} onChange={(e) => onChange({ ...node, ref_table: e.target.value })} className="w-full h-7 rounded-md border bg-background px-2 text-xs">
                <option value="">Select table...</option>
                {tables.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <Input value={node.ref_table} onChange={(e) => onChange({ ...node, ref_table: e.target.value })} placeholder="table name" className="text-xs h-7" />
            )}
          </div>
          <div className="space-y-1">
            <label className="text-label text-muted-foreground">Geom column</label>
            <Input value={node.ref_geom_col ?? "geom"} onChange={(e) => onChange({ ...node, ref_geom_col: e.target.value })} placeholder="geom" className="text-xs h-7" />
          </div>
        </div>
        <Input value={node.ref_filter ?? ""} onChange={(e) => onChange({ ...node, ref_filter: e.target.value || undefined })} placeholder="WHERE filter (optional)" className="text-label-lg h-7" />
      </div>

      {/* Optional: distance + buffer */}
      <div className="flex items-center gap-2">
        {showDistance && (
          <div className="flex items-center gap-1.5">
            <label className="text-label text-muted-foreground">Distance (m)</label>
            <Input type="number" value={node.distance ?? ""} onChange={(e) => onChange({ ...node, distance: e.target.value ? Number(e.target.value) : undefined })} className="text-xs h-7 w-20" />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <label className="text-label text-muted-foreground">Buffer (m)</label>
          <Input type="number" value={node.buffer_m ?? ""} onChange={(e) => onChange({ ...node, buffer_m: e.target.value ? Number(e.target.value) : undefined })} placeholder="0" className="text-xs h-7 w-20" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aggregation predicate — spatial count/sum on distant table
// ---------------------------------------------------------------------------

function AggregationPredicateEditor({
  node, onChange, onRemove, tables,
}: {
  node: GeomPredicate
  onChange: (node: GeomPredicate) => void
  onRemove: () => void
  tables: string[]
}) {
  const desc = describeAggregation(node)
  const needsField = node.aggregate_fn !== "count"

  return (
    <div className="rounded-lg border border-l-2 border-l-amber-500 bg-background p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <span className="text-label font-semibold text-amber-600 dark:text-amber-400 shrink-0">AGG</span>
        <div className="flex-1" />
        <button type="button" onClick={onRemove} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" title="Remove">
          {"\u2715"}
        </button>
      </div>

      {/* Natural language description */}
      {desc && (
        <p className="text-xs text-muted-foreground italic bg-accent/50 rounded px-2 py-1">
          {desc}
        </p>
      )}

      {/* Aggregation config */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-label text-muted-foreground">Aggregate</label>
          <select
            value={node.aggregate_fn ?? "count"}
            onChange={(e) => onChange({ ...node, aggregate_fn: e.target.value as AggregateFunction })}
            className="w-full h-8 rounded-md border bg-background px-2 text-xs"
          >
            {AGGREGATE_FNS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-label text-muted-foreground">Spatial relation</label>
          <select
            value={node.op}
            onChange={(e) => onChange({ ...node, op: e.target.value as GeomOp })}
            className="w-full h-8 rounded-md border bg-background px-2 text-xs"
          >
            {GEOM_OPS.filter((o) => !o.value.startsWith("distance")).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Distant table block */}
      <div className="rounded-lg bg-muted/30 p-2.5 border border-dashed space-y-2">
        <p className="text-label font-semibold uppercase tracking-wider text-muted-foreground/60">Distant table</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-label text-muted-foreground">Table</label>
            {tables.length > 0 ? (
              <select value={node.ref_table} onChange={(e) => onChange({ ...node, ref_table: e.target.value })} className="w-full h-7 rounded-md border bg-background px-2 text-xs">
                <option value="">Select table...</option>
                {tables.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <Input value={node.ref_table} onChange={(e) => onChange({ ...node, ref_table: e.target.value })} placeholder="table name" className="text-xs h-7" />
            )}
          </div>
          <div className="space-y-1">
            <label className="text-label text-muted-foreground">{needsField ? "Agg field" : "Geom col"}</label>
            {needsField ? (
              <Input value={node.ref_column ?? ""} onChange={(e) => onChange({ ...node, ref_column: e.target.value || undefined })} placeholder="field to aggregate" className="text-xs h-7" />
            ) : (
              <Input value={node.ref_geom_col ?? "geom"} onChange={(e) => onChange({ ...node, ref_geom_col: e.target.value })} placeholder="geom" className="text-xs h-7" />
            )}
          </div>
        </div>
        <Input value={node.ref_filter ?? ""} onChange={(e) => onChange({ ...node, ref_filter: e.target.value || undefined })} placeholder="WHERE filter (e.g. status='active')" className="text-label-lg h-7" />
      </div>

      {/* Threshold comparison */}
      <div className="flex items-center gap-2">
        <span className="text-label text-muted-foreground font-medium">Threshold</span>
        <select
          value={node.aggregate_op ?? "gt"}
          onChange={(e) => onChange({ ...node, aggregate_op: e.target.value as GeomPredicate["aggregate_op"] })}
          className="h-8 rounded-md border bg-background px-2 text-xs w-14"
        >
          {AGG_COMPARE_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Input
          type="number"
          value={node.aggregate_value ?? ""}
          onChange={(e) => onChange({ ...node, aggregate_value: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="value"
          className="text-xs h-8 w-24"
        />
      </div>
    </div>
  )
}
