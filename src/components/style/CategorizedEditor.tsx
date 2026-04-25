/**
 * CategorizedEditor — Classify layer by unique attribute values.
 *
 * 1. User picks a field
 * 2. "Classify" fetches distinct values from the API
 * 3. Each value gets a color from the selected qualitative ramp
 * 4. User can tweak individual colors via inline picker
 */

import { useState, useCallback } from "react"
import { Loader2, RefreshCw, X } from "lucide-react"
import type { CategoryEntry, SymbolDef, GeomFamily } from "@/types/layerStyle"
import type { LayerField } from "@/types/dataset"
import { defaultSymbol } from "@/types/layerStyle"
import { pickQualitative, QUALITATIVE_RAMPS } from "@/lib/colorRamps"
import { getDistinctValues } from "@/api/client"
import { SwatchPicker, SelectInput, StyleSection } from "./shared"

interface Props {
  geom: GeomFamily
  fields: LayerField[]
  datasetId: string
  layerName: string
  classField: string
  categories: CategoryEntry[]
  onFieldChange: (field: string) => void
  onCategoriesChange: (cats: CategoryEntry[]) => void
}

export function CategorizedEditor({
  geom, fields, datasetId, layerName,
  classField, categories, onFieldChange, onCategoriesChange,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [rampName, setRampName] = useState("Paired")

  const ramp = QUALITATIVE_RAMPS.find((r) => r.name === rampName) ?? QUALITATIVE_RAMPS[0]

  const classify = useCallback(async () => {
    if (!classField) return
    setLoading(true)
    try {
      const result = await getDistinctValues(datasetId, layerName, classField, 100)
      const colors = pickQualitative(ramp, result.values.length + 1)
      const cats: CategoryEntry[] = result.values.map((v, i) => ({
        value: v,
        label: String(v),
        symbol: defaultSymbol(geom, colors[i]) as SymbolDef,
      }))
      cats.push({
        value: null,
        label: "Other",
        symbol: defaultSymbol(geom, colors[result.values.length] ?? "#888888"),
      })
      onCategoriesChange(cats)
    } catch (err) {
      console.error("Classification failed:", err)
    } finally {
      setLoading(false)
    }
  }, [classField, datasetId, layerName, ramp, geom, onCategoriesChange])

  const updateCategoryColor = (idx: number, color: string) => {
    const next = [...categories]
    const sym = { ...next[idx].symbol }
    if (sym.kind === "fill") {
      (sym as any).color = color;
      (sym as any).strokeColor = color
    } else {
      (sym as any).color = color
    }
    next[idx] = { ...next[idx], symbol: sym }
    onCategoriesChange(next)
  }

  const removeCategory = (idx: number) => {
    onCategoriesChange(categories.filter((_, i) => i !== idx))
  }

  return (
    <StyleSection title="Categorized">
      <SelectInput
        label="Field"
        value={classField || ""}
        options={[
          { value: "", label: "Select field..." },
          ...fields.map((f) => ({ value: f.name, label: `${f.name} (${f.type})` })),
        ]}
        onChange={onFieldChange}
      />

      {/* Ramp selector with preview */}
      <div className="flex items-center gap-1.5">
        <span className="text-label text-muted-foreground w-14 shrink-0">Ramp</span>
        <select
          value={rampName}
          onChange={(e) => setRampName(e.target.value)}
          className="flex-1 h-6 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {QUALITATIVE_RAMPS.map((r) => (
            <option key={r.name} value={r.name}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Ramp preview */}
      <div className="flex items-center gap-1.5">
        <span className="w-14 shrink-0" />
        <div className="flex gap-0.5 flex-1">
          {ramp.colors.slice(0, 12).map((c, i) => (
            <div key={i} className="h-3 flex-1 first:rounded-l last:rounded-r" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <button
        onClick={classify}
        disabled={!classField || loading}
        className="flex items-center justify-center gap-1.5 w-full h-7 rounded border border-input bg-background text-xs font-medium hover:bg-accent disabled:opacity-40 transition-colors"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        {loading ? "Classifying..." : "Classify"}
      </button>

      {/* Category table */}
      {categories.length > 0 && (
        <div className="max-h-[240px] overflow-y-auto space-y-0.5 rounded border border-border p-1">
          {categories.map((cat, i) => (
            <div key={`${cat.value}-${i}`} className="flex items-center gap-1.5 group">
              <SwatchPicker
                color={(cat.symbol as any).color ?? "#888888"}
                onChange={(c) => updateCategoryColor(i, c)}
              />
              <span className="flex-1 text-label truncate" title={cat.label}>
                {cat.value === null ? <em className="text-muted-foreground">Other</em> : cat.label}
              </span>
              <button
                onClick={() => removeCategory(i)}
                className="p-0.5 rounded text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                title="Remove"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {categories.length > 0 && (
        <div className="text-label-sm text-muted-foreground text-center">
          {categories.length} categories ({categories.filter((c) => c.value !== null).length} values + fallback)
        </div>
      )}
    </StyleSection>
  )
}
