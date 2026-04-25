import { Input } from "@/components/ui/input"
import type { JsonSchema, JsonSchemaProperty } from "@/types/editor"

interface SchemaFormProps {
  schema: JsonSchema
  value: Record<string, unknown>
  onChange: (key: string, val: unknown) => void
}

function FieldHint({ text }: { text?: string }) {
  if (!text) return null
  return <p className="text-label text-muted-foreground mt-0.5">{text}</p>
}

function FieldLabel({ name, required, htmlFor }: { name: string; required: boolean; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium">
      {name}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  )
}

function renderField(
  key: string,
  prop: JsonSchemaProperty,
  value: unknown,
  required: boolean,
  onChange: (key: string, val: unknown) => void,
) {
  const type = prop.type ?? "string"
  const fieldId = `schema-field-${key}`

  if (prop.enum && prop.enum.length > 0) {
    return (
      <div key={key} className="space-y-1">
        <FieldLabel name={key} required={required} htmlFor={fieldId} />
        <select
          id={fieldId}
          value={String(value ?? prop.default ?? "")}
          onChange={(e) => onChange(key, e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">-- select --</option>
          {prop.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
        <FieldHint text={prop.description} />
      </div>
    )
  }

  if (type === "boolean") {
    return (
      <div key={key} className="flex items-center gap-2 py-1">
        <input
          id={fieldId}
          type="checkbox"
          checked={Boolean(value ?? prop.default ?? false)}
          onChange={(e) => onChange(key, e.target.checked)}
          className="h-4 w-4 rounded border border-input accent-primary"
        />
        <FieldLabel name={key} required={required} htmlFor={fieldId} />
        <FieldHint text={prop.description} />
      </div>
    )
  }

  if (type === "number" || type === "integer") {
    return (
      <div key={key} className="space-y-1">
        <FieldLabel name={key} required={required} htmlFor={fieldId} />
        <Input
          id={fieldId}
          type="number"
          value={value != null ? String(value) : ""}
          placeholder={prop.default != null ? String(prop.default) : undefined}
          min={prop.minimum}
          max={prop.maximum}
          step={type === "integer" ? 1 : "any"}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === "") {
              onChange(key, null)
            } else {
              onChange(key, type === "integer" ? parseInt(raw, 10) : parseFloat(raw))
            }
          }}
          className="text-xs"
        />
        <FieldHint text={prop.description} />
      </div>
    )
  }

  // Default: string
  return (
    <div key={key} className="space-y-1">
      <FieldLabel name={key} required={required} htmlFor={fieldId} />
      <Input
        id={fieldId}
        type="text"
        value={String(value ?? prop.default ?? "")}
        placeholder={prop.default != null ? String(prop.default) : undefined}
        onChange={(e) => onChange(key, e.target.value)}
        className="text-xs"
      />
      <FieldHint text={prop.description} />
    </div>
  )
}

export function SchemaForm({ schema, value, onChange }: SchemaFormProps) {
  const properties = schema.properties ?? {}
  const requiredFields = new Set(schema.required ?? [])
  const keys = Object.keys(properties)

  if (keys.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4">
        This capability has no configurable parameters.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {keys.map((key) =>
        renderField(key, properties[key], value[key], requiredFields.has(key), onChange),
      )}
    </div>
  )
}
