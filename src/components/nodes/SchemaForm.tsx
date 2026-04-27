/**
 * Generic JSON Schema → React form renderer.
 *
 * Supported keywords: type (string/number/integer/boolean/object/array),
 * enum, default, title, description, minimum, maximum, pattern, required,
 * properties, items.
 *
 * Used by NodePropertyPanel to drive capability parameters from
 * `CapabilitySchema.json_schema` instead of the legacy hardcoded
 * CAPABILITY_PARAMS map (covered ~7 of 118 capabilities).
 *
 * Validation: callers compute errors via `validateAgainstSchema()` from
 * schemaFormUtils before submit; the form itself shows inline errors
 * derived from the same helper.
 */

import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import {
  fieldType,
  isRenderableSchema,
  validateAgainstSchema,
  type JSONSchema,
} from "./schemaFormUtils"

export type SchemaFormProps = {
  schema: JSONSchema | undefined | null
  value: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  /** Optional i18n hook: (key, fallback) → label/description */
  translate?: (key: string, fallback: string) => string
}

const inputClass = "text-xs h-7"
const selectClass = "w-full h-8 rounded-md border bg-background px-2 text-xs"

function FieldLabel({ label, description, required }: { label: string; description?: string; required?: boolean }) {
  return (
    <label className="text-label text-muted-foreground flex items-center gap-1">
      <span>{label}</span>
      {required && <span className="text-red-500" aria-hidden="true">*</span>}
      {description && <span className="text-label-sm opacity-70 truncate" title={description}>· {description}</span>}
    </label>
  )
}

function PrimitiveInput({
  schema,
  value,
  onChange,
  error,
}: {
  schema: JSONSchema
  value: unknown
  onChange: (v: unknown) => void
  error?: string | null
}) {
  const t = fieldType(schema)
  const ariaInvalid = error ? true : undefined

  if (schema.enum) {
    return (
      <>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value)}
          className={selectClass}
          aria-invalid={ariaInvalid}
        >
          <option value="">--</option>
          {schema.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
          ))}
        </select>
        {error && <p className="text-label-sm text-red-500 mt-0.5">{error}</p>}
      </>
    )
  }

  if (t === "boolean") {
    return (
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={ariaInvalid}
        />
        <span>{schema.title ?? "Enabled"}</span>
      </label>
    )
  }

  if (t === "number" || t === "integer") {
    return (
      <>
        <Input
          type="number"
          step={t === "integer" ? 1 : "any"}
          value={value === undefined || value === null ? "" : String(value)}
          min={schema.minimum}
          max={schema.maximum}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === "" ? "" : Number(raw))
          }}
          placeholder={schema.description}
          className={inputClass}
          aria-invalid={ariaInvalid}
        />
        {error && <p className="text-label-sm text-red-500 mt-0.5">{error}</p>}
      </>
    )
  }

  // string / fallback
  return (
    <>
      <Input
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        pattern={schema.pattern}
        placeholder={schema.description}
        className={inputClass}
        aria-invalid={ariaInvalid}
      />
      {error && <p className="text-label-sm text-red-500 mt-0.5">{error}</p>}
    </>
  )
}

function ArrayInput({
  schema,
  value,
  onChange,
}: {
  schema: JSONSchema
  value: unknown
  onChange: (v: unknown) => void
}) {
  const items = Array.isArray(value) ? value : []
  const itemSchema: JSONSchema = schema.items ?? { type: "string" }

  return (
    <div className="space-y-1 rounded-md border border-dashed p-1.5">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-1 items-start">
          <div className="flex-1">
            <PrimitiveInput
              schema={itemSchema}
              value={item}
              onChange={(v) => {
                const next = [...items]
                next[idx] = v
                onChange(next)
              }}
            />
          </div>
          <button
            type="button"
            className="text-label-sm text-red-500 hover:underline px-1"
            aria-label={`Remove item ${idx + 1}`}
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-label-sm text-muted-foreground hover:text-foreground hover:underline"
        onClick={() => onChange([...items, itemSchema.default ?? ""])}
      >
        + Add item
      </button>
    </div>
  )
}

function ObjectInput({
  schema,
  value,
  onChange,
  translate,
}: {
  schema: JSONSchema
  value: unknown
  onChange: (v: unknown) => void
  translate?: SchemaFormProps["translate"]
}) {
  const obj = (value as Record<string, unknown>) ?? {}
  const props = schema.properties ?? {}
  const required = new Set(schema.required ?? [])

  return (
    <fieldset className="rounded-md border p-1.5 space-y-1.5">
      {schema.title && <legend className="text-label-sm px-1 text-muted-foreground">{schema.title}</legend>}
      {Object.entries(props).map(([k, sub]) => {
        const subT = fieldType(sub)
        const label = translate?.(k, sub.title ?? k) ?? sub.title ?? k
        return (
          <div key={k} className="space-y-0.5">
            <FieldLabel label={label} description={sub.description} required={required.has(k)} />
            {subT === "object" ? (
              <ObjectInput schema={sub} value={obj[k]} onChange={(v) => onChange({ ...obj, [k]: v })} translate={translate} />
            ) : subT === "array" ? (
              <ArrayInput schema={sub} value={obj[k]} onChange={(v) => onChange({ ...obj, [k]: v })} />
            ) : (
              <PrimitiveInput schema={sub} value={obj[k]} onChange={(v) => onChange({ ...obj, [k]: v })} />
            )}
          </div>
        )
      })}
    </fieldset>
  )
}

export function SchemaForm({ schema, value, onChange, translate }: SchemaFormProps) {
  const errors = useMemo(() => validateAgainstSchema(schema, value), [schema, value])

  if (!isRenderableSchema(schema)) return null

  const props = schema!.properties ?? {}
  const required = new Set(schema!.required ?? [])

  return (
    <div className="space-y-2">
      {Object.entries(props).map(([k, sub]) => {
        const subT = fieldType(sub)
        const label = translate?.(k, sub.title ?? k) ?? sub.title ?? k
        const description = sub.description
        const err = errors[k]
        return (
          <div key={k} className="space-y-0.5">
            <FieldLabel label={label} description={description} required={required.has(k)} />
            {subT === "object" ? (
              <ObjectInput schema={sub} value={value[k]} onChange={(v) => onChange(k, v)} translate={translate} />
            ) : subT === "array" ? (
              <ArrayInput schema={sub} value={value[k]} onChange={(v) => onChange(k, v)} />
            ) : (
              <PrimitiveInput schema={sub} value={value[k]} onChange={(v) => onChange(k, v)} error={err} />
            )}
          </div>
        )
      })}
    </div>
  )
}

