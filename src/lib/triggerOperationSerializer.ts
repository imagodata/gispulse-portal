/**
 * Serializes a ReactFlow graph of Forge nodes into trigger_operations rows
 * compatible with the Forge ESB bridge (db_triggers.trigger_operations).
 *
 * Issue #161 — Graph → trigger_operations serializer
 */

import type { Node, Edge } from "@xyflow/react"
import type { TriggerOperation } from "@/types/editor"
import type {
  TableSourceData,
  SpatialOpData,
  AggregateData,
  CustomExpressionData,
  ValidationData,
} from "@/components/nodes/ops"

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface SerializedTriggerOps {
  /** trigger_operations rows to INSERT */
  operations: TriggerOperation[]
  /** trigger_composite_rules rows (for coalesce) */
  compositeRules: Array<{
    schema: string
    table: string
    field: string
    trigger: "BEFORE" | "AFTER"
    operation: string
    coalesce: boolean
  }>
  /** Custom expressions to store in trigger_custom_expressions */
  customExpressions: Array<{
    id: string // node id as temporary reference
    expression: string
  }>
  /** SQL preview string */
  sql: string
  /** Validation errors */
  errors: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findSourceTable(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
): TableSourceData | null {
  // Walk backwards from this node to find the ForgeTableSource
  const visited = new Set<string>()
  const queue = [nodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const node = nodes.find((n) => n.id === current)
    if (!node) continue
    const d = node.data as Record<string, unknown>
    if (d.nodeKind === "tableSource") return d as unknown as TableSourceData
    // Find upstream nodes
    for (const edge of edges) {
      if (edge.target === current) queue.push(edge.source)
    }
  }
  return null
}

function operationSuffix(phase: string): string {
  return phase === "after" ? "_after" : "_before"
}

// ---------------------------------------------------------------------------
// Main serializer
// ---------------------------------------------------------------------------

export function serializeTriggerOperations(
  nodes: Node[],
  edges: Edge[],
): SerializedTriggerOps {
  const operations: TriggerOperation[] = []
  const compositeRules: SerializedTriggerOps["compositeRules"] = []
  const customExpressions: SerializedTriggerOps["customExpressions"] = []
  const errors: string[] = []

  // Sort forge nodes topologically (by connections), then by explicit order
  const forgeNodes = nodes.filter((n) => {
    const d = n.data as Record<string, unknown>
    return typeof d.nodeKind === "string"
  })

  let orderCounter = 10

  for (const node of forgeNodes) {
    const d = node.data as Record<string, unknown>
    const nodeKind = d.nodeKind as string

    // Find the source table for context
    const source = findSourceTable(node.id, nodes, edges)

    if (nodeKind === "tableSource") {
      // Table source nodes are context, not operations themselves
      continue
    }

    if (!source) {
      errors.push(`Node "${d.label || node.id}": no Table Source connected`)
      continue
    }

    if (nodeKind === "spatialOp") {
      const sd = d as unknown as SpatialOpData
      const opName = `${sd.operation}${operationSuffix(sd.phase)}`
      operations.push({
        schema: source.schema,
        table: source.table,
        field: sd.field,
        phase: sd.phase,
        operation: sd.operation,
        event: source.event,
        distant_schema: sd.distantSchema,
        distant_table: sd.distantTable,
        distant_field: sd.distantField,
        filter: sd.filter,
        order: sd.order ?? orderCounter,
        coalesce: sd.coalesce,
        enabled: true,
      })
      if (sd.coalesce) {
        compositeRules.push({
          schema: source.schema,
          table: source.table,
          field: sd.field,
          trigger: sd.phase === "after" ? "AFTER" : "BEFORE",
          operation: opName,
          coalesce: true,
        })
      }
      orderCounter += 10
    }

    if (nodeKind === "aggregate") {
      const ad = d as unknown as AggregateData
      operations.push({
        schema: source.schema,
        table: source.table,
        field: ad.sourceField || "",
        phase: "after",
        operation: ad.operation,
        event: source.event,
        distant_schema: ad.distantSchema,
        distant_table: ad.distantTable,
        distant_field: ad.distantField,
        filter: ad.filter,
        distant_filter: ad.distantFilter,
        order: ad.order ?? orderCounter,
        enabled: true,
      })
      orderCounter += 10
    }

    if (nodeKind === "customExpression") {
      const cd = d as unknown as CustomExpressionData
      if (!cd.expression?.trim()) {
        errors.push(`Node "${cd.label || node.id}": empty expression`)
        continue
      }
      const opName = `custom_expression${operationSuffix(cd.phase)}`
      operations.push({
        schema: source.schema,
        table: source.table,
        field: cd.field,
        phase: cd.phase,
        operation: "custom_expression",
        event: source.event,
        custom_expression: cd.expression,
        order: cd.order ?? orderCounter,
        coalesce: cd.coalesce,
        enabled: true,
      })
      customExpressions.push({ id: node.id, expression: cd.expression })
      if (cd.coalesce) {
        compositeRules.push({
          schema: source.schema,
          table: source.table,
          field: cd.field,
          trigger: cd.phase === "after" ? "AFTER" : "BEFORE",
          operation: opName,
          coalesce: true,
        })
      }
      orderCounter += 10
    }

    if (nodeKind === "validation") {
      const vd = d as unknown as ValidationData
      for (const rule of vd.rules || []) {
        // Each validation rule becomes a custom_expression_before
        const expr = generateValidationSQL(rule.type, rule.config, rule.onFail)
        operations.push({
          schema: source.schema,
          table: source.table,
          field: `_validation_${rule.type}`,
          phase: "before",
          operation: "custom_expression",
          event: source.event,
          custom_expression: expr,
          order: vd.order ?? orderCounter,
          enabled: true,
        })
        customExpressions.push({ id: `${node.id}_${rule.type}`, expression: expr })
        orderCounter += 10
      }
    }
  }

  // Generate SQL preview
  const sql = generateSQLPreview(operations, compositeRules, customExpressions)

  return { operations, compositeRules, customExpressions, sql, errors }
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

function generateValidationSQL(
  type: string,
  config: Record<string, unknown>,
  onFail: string,
): string {
  const failAction =
    onFail === "block"
      ? "RAISE EXCEPTION"
      : onFail === "warn"
        ? "RAISE WARNING"
        : "NULL" // tag mode: just returns null, doesn't block

  switch (type) {
    case "geometry_valid":
      return `CASE WHEN NOT ST_IsValid(($1->>'geom')::geometry) THEN ${failAction === "NULL" ? "NULL" : `${failAction} 'Invalid geometry'`} ELSE NULL END`
    case "not_null":
      return `CASE WHEN ($1->>'${config.field}') IS NULL THEN ${failAction === "NULL" ? "NULL" : `${failAction} '${config.field} is required'`} ELSE NULL END`
    case "range":
      return `CASE WHEN ($1->>'${config.field}')::NUMERIC NOT BETWEEN ${config.min} AND ${config.max} THEN ${failAction === "NULL" ? "NULL" : `${failAction} '${config.field} out of range'`} ELSE NULL END`
    default:
      return `-- TODO: implement validation for ${type}`
  }
}

function sqlQuote(val: string | undefined | null): string {
  if (val == null || val === "") return "NULL"
  return `'${val.replace(/'/g, "''")}'`
}

function generateSQLPreview(
  operations: TriggerOperation[],
  _compositeRules: SerializedTriggerOps["compositeRules"],
  _customExpressions: SerializedTriggerOps["customExpressions"],
): string {
  const lines: string[] = []

  lines.push("-- ============================================")
  lines.push("-- GISPulse trigger operations (preview)")
  lines.push("-- ============================================")
  lines.push("")

  const beforeOps = operations.filter((o) => o.phase === "before")
  const afterOps = operations.filter((o) => o.phase === "after")

  for (const [label, ops] of [
    ["BEFORE operations (modify NEW inline)", beforeOps],
    ["AFTER operations (propagate to distant tables)", afterOps],
  ] as const) {
    if (ops.length === 0) continue
    lines.push(`-- ${label}`)
    for (const op of ops) {
      lines.push(`-- [${op.order ?? 0}] ${op.schema}.${op.table}.${op.field}`)
      lines.push(`--   operation: ${op.operation} (${op.phase.toUpperCase()})`)
      lines.push(`--   event: ${op.event}`)
      if (op.distant_table) {
        lines.push(`--   target: ${op.distant_schema ?? ""}.${op.distant_table}.${op.distant_field ?? ""}`)
      }
      if (op.filter) {
        lines.push(`--   filter: ${op.filter}`)
      }
      if (op.custom_expression) {
        lines.push(`--   expression: ${op.custom_expression}`)
      }
      if (op.coalesce) {
        lines.push(`--   coalesce: true (skip if already set)`)
      }
      lines.push("")
    }
  }

  // Summary as structured JSON (for API submission)
  lines.push("-- Structured payload for POST /api/triggers/{id}/operations:")
  lines.push(`-- ${JSON.stringify(operations.map((op) => ({
    schema: op.schema,
    table: op.table,
    field: op.field,
    phase: op.phase,
    operation: op.operation,
    event: op.event,
    distant_schema: op.distant_schema || null,
    distant_table: op.distant_table || null,
    distant_field: op.distant_field || null,
    filter: op.filter || null,
    order: op.order ?? 0,
    coalesce: op.coalesce ?? false,
    custom_expression: op.custom_expression || null,
    enabled: op.enabled,
  })), null, 2).split("\n").join("\n-- ")}`)

  return lines.join("\n")
}
