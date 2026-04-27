/**
 * Pure types + helpers for SchemaForm. Kept separate from the React
 * component so react-refresh stays happy (only-export-components).
 */

export type JSONSchema = {
  type?: string | string[]
  title?: string
  description?: string
  default?: unknown
  enum?: unknown[]
  minimum?: number
  maximum?: number
  pattern?: string
  required?: string[]
  properties?: Record<string, JSONSchema>
  items?: JSONSchema
  additionalProperties?: boolean | JSONSchema
}

export function fieldType(schema: JSONSchema): string {
  if (Array.isArray(schema.type)) return schema.type.find((t) => t !== "null") ?? "string"
  return schema.type ?? "string"
}

/**
 * Returns true if this schema is a non-trivial object schema (has
 * `properties`). Capabilities use top-level object schemas where each
 * property is one parameter.
 */
export function isRenderableSchema(schema: JSONSchema | null | undefined): boolean {
  if (!schema || typeof schema !== "object") return false
  if (fieldType(schema) !== "object") return false
  return Boolean(schema.properties && Object.keys(schema.properties).length > 0)
}

export function validateField(schema: JSONSchema, value: unknown, isRequired: boolean): string | null {
  const empty = value === undefined || value === null || value === ""
  if (isRequired && empty) return "Required"
  if (empty) return null
  const t = fieldType(schema)
  if (schema.enum && !schema.enum.includes(value as never)) return "Invalid choice"
  if (t === "number" || t === "integer") {
    const n = Number(value)
    if (Number.isNaN(n)) return "Must be a number"
    if (t === "integer" && !Number.isInteger(n)) return "Must be an integer"
    if (schema.minimum !== undefined && n < schema.minimum) return `Min ${schema.minimum}`
    if (schema.maximum !== undefined && n > schema.maximum) return `Max ${schema.maximum}`
  }
  if (t === "string" && schema.pattern) {
    try {
      if (!new RegExp(schema.pattern).test(String(value))) return "Invalid format"
    } catch {
      // ignore malformed pattern
    }
  }
  return null
}

/**
 * Validate a value against a top-level object schema. Returns a map
 * of {propertyKey: errorMessage} for fields that fail validation.
 * Empty map means valid. Used by callers to gate submit before
 * dispatching capability runs.
 */
export function validateAgainstSchema(
  schema: JSONSchema | null | undefined,
  value: Record<string, unknown>,
): Record<string, string> {
  if (!isRenderableSchema(schema)) return {}
  const required = new Set(schema!.required ?? [])
  const props = schema!.properties ?? {}
  const out: Record<string, string> = {}
  for (const [k, sub] of Object.entries(props)) {
    const err = validateField(sub, value[k], required.has(k))
    if (err) out[k] = err
  }
  return out
}
