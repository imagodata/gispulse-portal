/**
 * AddComputationForm — Shared form for adding a computed field to a relation.
 *
 * Used in both EdgeInspector (inline) and SchemaView (floating).
 */

import { useState, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useRelationStore } from "@/stores/relationStore"

interface AddComputationFormProps {
  relationId: string
  onDone: () => void
  /** Use floating visual style (border + bg) vs inline (muted bg) */
  variant?: "inline" | "floating"
}

export function AddComputationForm({
  relationId,
  onDone,
  variant = "inline",
}: AddComputationFormProps) {
  const addComputation = useRelationStore((s) => s.addComputation)
  const [name, setName] = useState("")
  const [expression, setExpression] = useState("")
  const [aggFunction, setAggFunction] = useState("")
  const [sourceField, setSourceField] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (!name.trim() || !expression.trim()) return
    setSaving(true)
    try {
      await addComputation(relationId, {
        name: name.trim(),
        expression: expression.trim(),
        agg_function: aggFunction.trim() || null,
        source_field: sourceField.trim() || null,
      })
      toast.success(`Computed field "${name}" added`)
      onDone()
    } catch (err) {
      toast.error("Failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }, [name, expression, aggFunction, sourceField, relationId, addComputation, onDone])

  const inputClass = variant === "floating"
    ? "w-full bg-muted/50 border rounded px-2 py-1 mt-0.5 font-mono text-xs"
    : "w-full text-xs bg-background border rounded px-2 py-1 mt-0.5 font-mono"

  const selectClass = variant === "floating"
    ? "w-full bg-muted/50 border rounded px-2 py-1 mt-0.5 text-xs"
    : "w-full text-xs bg-background border rounded px-2 py-1 mt-0.5"

  return (
    <div className={variant === "inline" ? "space-y-2 p-2 border rounded bg-muted/30" : "p-3 space-y-2"}>
      <div>
        <label className="text-label text-muted-foreground">Field name</label>
        <input
          autoFocus={variant === "floating"}
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="nb_batiments"
        />
      </div>
      <div>
        <label className="text-label text-muted-foreground">Expression</label>
        <input
          className={inputClass}
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder="COUNT(*)"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-label text-muted-foreground">Agg function</label>
          <select
            className={selectClass}
            value={aggFunction}
            onChange={(e) => setAggFunction(e.target.value)}
          >
            <option value="">None</option>
            <option value="COUNT">COUNT</option>
            <option value="SUM">SUM</option>
            <option value="AVG">AVG</option>
            <option value="MIN">MIN</option>
            <option value="MAX">MAX</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-label text-muted-foreground">Source field</label>
          <input
            className={inputClass}
            value={sourceField}
            onChange={(e) => setSourceField(e.target.value)}
            placeholder="*"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" className="h-6 text-xs" onClick={handleSave} disabled={saving || !name.trim() || !expression.trim()}>
          {saving ? "..." : "Add"}
        </Button>
      </div>
    </div>
  )
}
