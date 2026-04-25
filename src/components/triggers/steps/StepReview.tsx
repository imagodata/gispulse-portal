import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ClipboardCopy, Play, CheckCircle } from "lucide-react"
import { TRIGGER_TYPES, SEVERITY_LEVELS } from "../constants"
import type { UseTriggerFormReturn } from "../hooks/useTriggerForm"
import type { TriggerOperation } from "@/types/editor"

// ---------------------------------------------------------------------------
// SQL generation (full trigger function)
// ---------------------------------------------------------------------------

function generateFullSql(form: UseTriggerFormReturn): string {
  const { triggerType, dmlTable, dmlEvents, operations } = form
  if (triggerType !== "dml" || operations.length === 0) return "-- No SQL generated (non-DML or no operations)"

  const lines: string[] = []
  const table = dmlTable || "<table>"
  const events = dmlEvents.join(" OR ")

  const beforeOps = operations.filter((o) => o.phase === "before")
  const afterOps = operations.filter((o) => o.phase === "after")

  if (beforeOps.length > 0) {
    lines.push(`-- BEFORE ${events} on ${table}`)
    lines.push(`CREATE OR REPLACE FUNCTION trg_before_${table}()`)
    lines.push(`RETURNS TRIGGER AS $$`)
    lines.push(`BEGIN`)
    for (const op of beforeOps) {
      lines.push(`  -- Op: ${op.operation} -> ${op.field || "?"}`)
      lines.push(`  ${generateOpSql(op)};`)
    }
    lines.push(`  RETURN NEW;`)
    lines.push(`END $$ LANGUAGE plpgsql;`)
    lines.push("")
  }

  if (afterOps.length > 0) {
    lines.push(`-- AFTER ${events} on ${table}`)
    lines.push(`CREATE OR REPLACE FUNCTION trg_after_${table}()`)
    lines.push(`RETURNS TRIGGER AS $$`)
    lines.push(`BEGIN`)
    for (const op of afterOps) {
      lines.push(`  -- Op: ${op.operation} -> ${op.field || "?"}`)
      lines.push(`  ${generateOpSql(op)};`)
    }
    lines.push(`  RETURN NULL;`)
    lines.push(`END $$ LANGUAGE plpgsql;`)
  }

  return lines.join("\n")
}

function generateOpSql(op: TriggerOperation): string {
  const src = op.table || "<source>"
  const field = op.field || "<field>"
  const dist = op.distant_table || "<distant>"
  const distField = op.distant_field || "id"
  const distFilter = op.distant_filter ? ` AND ${op.distant_filter}` : ""

  if (op.operation === "custom_expression") return op.custom_expression || "-- custom"

  if (op.phase === "before") {
    if (["st_area", "st_length", "centroid"].includes(op.operation)) {
      const fn = op.operation === "st_area" ? "ST_Area" : op.operation === "st_length" ? "ST_Length" : "ST_Centroid"
      return `NEW.${field} := ${fn}(NEW.geom)`
    }
    return `NEW.${field} := (SELECT d.${distField} FROM ${dist} d WHERE ST_Within(NEW.geom, d.geom)${distFilter} LIMIT 1)`
  }

  const parts = op.operation.split("_st_")
  const aggFn = (parts[0] ?? "count").toUpperCase()
  const aggExpr = aggFn === "COUNT" ? "COUNT(*)" : `${aggFn}(d.${distField})`
  return `UPDATE ${src} SET ${field} = (SELECT ${aggExpr} FROM ${dist} d WHERE ST_Contains(${src}.geom, d.geom)${distFilter})`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StepReviewProps {
  form: UseTriggerFormReturn
}

export function StepReview({ form }: StepReviewProps) {
  const [copied, setCopied] = useState(false)

  const {
    name, description, triggerType, activeCategory, severity,
    ruleId, autoEval, operations, predicates, actions,
  } = form

  const typeDef = TRIGGER_TYPES.find((t) => t.value === triggerType)
  const sevDef = SEVERITY_LEVELS.find((s) => s.value === severity)
  const conditionCount = predicates.predicates.length
  const actionCount = actions.length
  const beforeOps = operations.filter((o) => o.phase === "before").length
  const afterOps = operations.filter((o) => o.phase === "after").length

  const sql = generateFullSql(form)

  const handleCopy = () => {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-semibold">Summary</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div>
            <span className="text-muted-foreground">Name</span>
            <p className="font-medium">{name || "(unnamed)"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Type</span>
            <p className="font-medium">{typeDef?.label} ({activeCategory})</p>
          </div>
          <div>
            <span className="text-muted-foreground">Severity</span>
            <p className="font-medium flex items-center gap-1.5">
              {sevDef && <span className={`h-2 w-2 rounded-full ${sevDef.bg}`} />}
              {sevDef?.label}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Linked Rule</span>
            <p className="font-medium">{ruleId || "None"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Auto-eval</span>
            <p className="font-medium">{autoEval ? "ON" : "OFF"}</p>
          </div>
          {description && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Description</span>
              <p className="font-medium">{description}</p>
            </div>
          )}
        </div>

        {/* Counts */}
        <div className="flex gap-2 pt-2 border-t">
          {operations.length > 0 && (
            <Badge variant="secondary" className="text-label">
              {operations.length} spatial op{operations.length !== 1 ? "s" : ""} ({beforeOps} before, {afterOps} after)
            </Badge>
          )}
          {conditionCount > 0 && (
            <Badge variant="secondary" className="text-label">
              {conditionCount} condition{conditionCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {actionCount > 0 && (
            <Badge variant="secondary" className="text-label">
              {actionCount} action{actionCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* SQL Preview */}
      {triggerType === "dml" && operations.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Generated SQL</h3>
            <Button variant="ghost" size="xs" className="h-6 text-label" onClick={handleCopy}>
              {copied ? <CheckCircle className="h-3 w-3 mr-1 text-green-500" /> : <ClipboardCopy className="h-3 w-3 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="rounded-md bg-muted p-3 text-label-lg font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
            {sql}
          </pre>
        </div>
      )}

      {/* Dry run placeholder */}
      <div className="rounded-lg border border-dashed p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Dry Run</h3>
          <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
            <Play className="h-3 w-3 mr-1.5" />
            Run dry-run
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Simulate trigger evaluation without side effects. Available after saving.
        </p>
      </div>
    </div>
  )
}
