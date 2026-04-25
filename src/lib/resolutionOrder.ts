/**
 * Resolution order — auto-ordering for trigger operations based on
 * field dependencies (DAG topological sort).
 *
 * Issue #168
 *
 * Example:
 *   ST_Within(geom) → zone_id          (no dependency)
 *   ST_Length(geom)  → length_m         (no dependency)
 *   Custom(length_m * 12.5) → cost      (depends on length_m)
 *   SUM(nb_users) WHERE zone_id         (depends on zone_id, AFTER phase)
 *
 * Algorithm:
 *   1. For each operation, detect which fields it reads (from expression/filter)
 *   2. Build edges: if op A writes field X and op B reads field X, A → B
 *   3. Topological sort (Kahn's algorithm)
 *   4. Assign _order values (10, 20, 30...)
 *   5. Detect cycles → error
 */

export interface OrderableOp {
  id: string
  field: string  // field this op writes to
  phase: "before" | "after"
  /** Fields this op reads (parsed from expression, filter, distant_field) */
  readFields: string[]
  /** Explicit order override (null = auto) */
  explicitOrder: number | null
}

export interface OrderResult {
  /** Ordered list of operation IDs */
  ordered: string[]
  /** Assigned _order values keyed by op id */
  orders: Map<string, number>
  /** Cycle detection: list of cycle paths if any */
  cycles: string[][]
  /** Warnings */
  warnings: string[]
}

/**
 * Extract field references from a SQL expression.
 * Looks for patterns like ($1->>'field_name') and bare field names
 * after common operators (=, >, <, AND, OR, WHERE).
 */
export function extractReadFields(expression: string, allFields: string[]): string[] {
  const found = new Set<string>()

  // Pattern 1: ($1->>'field_name') JSONB access
  const jsonbPattern = /\$1\s*->>?\s*'(\w+)'/g
  let match: RegExpExecArray | null
  while ((match = jsonbPattern.exec(expression)) !== null) {
    found.add(match[1])
  }

  // Pattern 2: bare field names that exist in allFields
  for (const field of allFields) {
    // Word boundary match, but not when it's the target field itself
    const re = new RegExp(`\\b${field}\\b`, "i")
    if (re.test(expression)) {
      found.add(field)
    }
  }

  return Array.from(found)
}

/**
 * Compute resolution order for a set of operations.
 * Separates BEFORE and AFTER phases (BEFORE always runs first).
 */
export function computeResolutionOrder(ops: OrderableOp[]): OrderResult {
  const warnings: string[] = []
  const cycles: string[][] = []

  // Separate by phase
  const beforeOps = ops.filter((o) => o.phase === "before")
  const afterOps = ops.filter((o) => o.phase === "after")

  // Order within each phase
  const beforeOrder = topoSort(beforeOps, warnings, cycles)
  const afterOrder = topoSort(afterOps, warnings, cycles)

  // Merge: all BEFORE first, then AFTER
  const ordered = [...beforeOrder, ...afterOrder]

  // Assign _order values
  const orders = new Map<string, number>()
  ordered.forEach((id, idx) => {
    // Check if op has explicit order
    const op = ops.find((o) => o.id === id)
    if (op?.explicitOrder != null) {
      orders.set(id, op.explicitOrder)
    } else {
      orders.set(id, (idx + 1) * 10)
    }
  })

  return { ordered, orders, cycles, warnings }
}

function topoSort(
  ops: OrderableOp[],
  warnings: string[],
  cycles: string[][],
): string[] {
  if (ops.length === 0) return []

  // Build adjacency: if op A writes field X and op B reads field X, edge A → B
  const fieldWriters = new Map<string, string>() // field → op id
  for (const op of ops) {
    if (fieldWriters.has(op.field)) {
      warnings.push(`Field "${op.field}" written by multiple ops: ${fieldWriters.get(op.field)}, ${op.id}`)
    }
    fieldWriters.set(op.field, op.id)
  }

  // Build graph
  const adj = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  for (const op of ops) {
    adj.set(op.id, [])
    inDegree.set(op.id, 0)
  }

  for (const op of ops) {
    for (const readField of op.readFields) {
      const writerId = fieldWriters.get(readField)
      if (writerId && writerId !== op.id) {
        adj.get(writerId)!.push(op.id)
        inDegree.set(op.id, (inDegree.get(op.id) || 0) + 1)
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    // Stable sort: prefer ops with explicit order
    queue.sort((a, b) => {
      const opA = ops.find((o) => o.id === a)
      const opB = ops.find((o) => o.id === b)
      const orderA = opA?.explicitOrder ?? Infinity
      const orderB = opB?.explicitOrder ?? Infinity
      return orderA - orderB
    })

    const current = queue.shift()!
    sorted.push(current)

    for (const neighbor of adj.get(current) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  // Check for cycles
  if (sorted.length < ops.length) {
    const remaining = ops
      .filter((o) => !sorted.includes(o.id))
      .map((o) => o.id)
    cycles.push(remaining)
    warnings.push(`Cycle detected among operations: ${remaining.join(", ")}`)
    // Add remaining in original order as fallback
    sorted.push(...remaining)
  }

  return sorted
}

/**
 * Visualize the resolution pipeline as a text diagram.
 */
export function renderPipelineDiagram(
  ops: OrderableOp[],
  orders: Map<string, number>,
): string {
  const lines: string[] = []

  const beforeOps = ops
    .filter((o) => o.phase === "before")
    .sort((a, b) => (orders.get(a.id) || 0) - (orders.get(b.id) || 0))

  const afterOps = ops
    .filter((o) => o.phase === "after")
    .sort((a, b) => (orders.get(a.id) || 0) - (orders.get(b.id) || 0))

  if (beforeOps.length > 0) {
    lines.push("┌─ BEFORE ─────────────────────────────┐")
    for (const op of beforeOps) {
      const order = orders.get(op.id) || 0
      const deps = op.readFields.length > 0 ? `  ↑ needs: ${op.readFields.join(", ")}` : ""
      lines.push(`│ ${String(order).padStart(3)} ${op.id.slice(0, 12).padEnd(13)} → ${op.field}${deps}`)
    }
    lines.push("└──────────────────────────────────────┘")
  }

  if (afterOps.length > 0) {
    lines.push("┌─ AFTER ──────────────────────────────┐")
    for (const op of afterOps) {
      const order = orders.get(op.id) || 0
      const deps = op.readFields.length > 0 ? `  ↑ needs: ${op.readFields.join(", ")}` : ""
      lines.push(`│ ${String(order).padStart(3)} ${op.id.slice(0, 12).padEnd(13)} → ${op.field}${deps}`)
    }
    lines.push("└──────────────────────────────────────┘")
  }

  return lines.join("\n")
}
