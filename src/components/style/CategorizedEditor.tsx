/**
 * CategorizedEditor — Classify a layer by unique attribute values.
 *
 * Workflow:
 *   1. User picks an attribute field
 *   2. "Classify" auto-fills via GET /datasets/{id}/layers/{layer}/distinct
 *   3. Distinct values are CAPPED at 12 to keep the legend readable; the
 *      remaining values fall into a fallback "Other" bucket whose colour is
 *      the qualitative ramp's last slot.
 *   4. Each entry can be: re-coloured (swatch), removed (X), or relabelled
 *      via inline editing.
 *
 * The cap is enforced client-side. The backend `/distinct` endpoint is
 * called with limit=100 so we still have headroom if a future iteration
 * lifts the legend cap.
 */

import { useState, useCallback } from "react"
import { Loader2, RefreshCw, X, Pencil, Check } from "lucide-react"
import type { CategoryEntry, SymbolDef, GeomFamily } from "@/types/layerStyle"
import type { LayerField } from "@/types/dataset"
import { defaultSymbol } from "@/types/layerStyle"
import { pickQualitative, QUALITATIVE_RAMPS } from "@/lib/colorRamps"
import { getDistinctValues } from "@/api/styles"
import { useT } from "@/i18n/useT"
import { SwatchPicker, SelectInput, StyleSection } from "./shared"

const MAX_CATEGORIES = 12

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
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overflow, setOverflow] = useState<number>(0) // # values dropped into Other
  const [rampName, setRampName] = useState("Paired")
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState("")

  const ramp = QUALITATIVE_RAMPS.find((r) => r.name === rampName) ?? QUALITATIVE_RAMPS[0]

  const classify = useCallback(async () => {
    if (!classField) return
    setLoading(true)
    setError(null)
    try {
      // We ask the backend for up to 100 distinct values so we can detect
      // overflow vs the legend cap (12). The cap is applied client-side.
      const result = await getDistinctValues(datasetId, layerName, classField, 100)
      const all = result.values
      const capped = all.slice(0, MAX_CATEGORIES)
      // result.count is the *total* distinct count from the backend, which
      // may exceed the requested limit (100). Prefer that signal when set.
      const totalDistinct =
        Number.isFinite(result.count) && result.count > all.length ? result.count : all.length
      const totalOverflow = Math.max(0, totalDistinct - capped.length)

      // +1 colour for the "Other" bucket
      const colors = pickQualitative(ramp, capped.length + 1)
      const cats: CategoryEntry[] = capped.map((v, i) => ({
        value: v,
        label: String(v),
        symbol: defaultSymbol(geom, colors[i]) as SymbolDef,
      }))

      // Always append a fallback "Other" — even when there's no overflow,
      // a future tile fetch might surface a value that wasn't in the
      // distinct sample (NULL handling, late-arriving rows, etc.).
      cats.push({
        value: null,
        label: t("style.categorized.other"),
        symbol: defaultSymbol(geom, colors[capped.length] ?? "#888888"),
      })

      onCategoriesChange(cats)
      setOverflow(totalOverflow)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("Categorized classification failed:", err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [classField, datasetId, layerName, ramp, geom, onCategoriesChange, t])

  const updateCategoryColor = (idx: number, color: string) => {
    const next = [...categories]
    const sym = { ...next[idx].symbol } as Record<string, unknown>
    sym.color = color
    if (sym.kind === "fill") sym.strokeColor = color
    next[idx] = { ...next[idx], symbol: sym as unknown as SymbolDef }
    onCategoriesChange(next)
  }

  const removeCategory = (idx: number) => {
    onCategoriesChange(categories.filter((_, i) => i !== idx))
  }

  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditLabel(categories[idx].label)
  }
  const cancelEdit = () => { setEditingIdx(null); setEditLabel("") }
  const commitEdit = () => {
    if (editingIdx === null) return
    const next = [...categories]
    next[editingIdx] = { ...next[editingIdx], label: editLabel }
    onCategoriesChange(next)
    cancelEdit()
  }

  const valueCount = categories.filter((c) => c.value !== null).length

  return (
    <StyleSection title={t("style.section.categorized")}>
      <SelectInput
        label={t("style.field")}
        value={classField || ""}
        options={[
          { value: "", label: t("style.field.placeholder_any") },
          ...fields.map((f) => ({ value: f.name, label: `${f.name} (${f.type})` })),
        ]}
        onChange={onFieldChange}
      />

      {/* Ramp selector with preview */}
      <div className="flex items-center gap-1.5">
        <label htmlFor="categorized-ramp" className="text-label text-muted-foreground w-14 shrink-0">
          {t("style.ramp")}
        </label>
        <select
          id="categorized-ramp"
          value={rampName}
          onChange={(e) => setRampName(e.target.value)}
          className="flex-1 h-6 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {QUALITATIVE_RAMPS.map((r) => (
            <option key={r.name} value={r.name}>{r.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="w-14 shrink-0" />
        <div className="flex gap-0.5 flex-1">
          {ramp.colors.slice(0, MAX_CATEGORIES).map((c, i) => (
            <div
              key={i}
              className="h-3 flex-1 first:rounded-l last:rounded-r"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={classify}
        disabled={!classField || loading}
        aria-label={t("style.categorized.fetch_distinct")}
        className="flex items-center justify-center gap-1.5 w-full h-7 rounded border border-input bg-background text-xs font-medium hover:bg-accent disabled:opacity-40 transition-colors"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        {loading ? t("style.classifying") : t("style.classify")}
      </button>

      {error && (
        <div className="text-label-sm text-destructive" role="alert">{error}</div>
      )}

      {overflow > 0 && categories.length > 0 && (
        <div className="text-label-sm text-muted-foreground" role="status">
          {t("style.categorized.cap_notice").replace("{n}", String(MAX_CATEGORIES))}
          {` (+${overflow})`}
        </div>
      )}

      {/* Category table */}
      {categories.length > 0 && (
        <div className="max-h-[240px] overflow-y-auto space-y-0.5 rounded border border-border p-1">
          {categories.map((cat, i) => (
            <div
              key={`${String(cat.value)}-${i}`}
              className="flex items-center gap-1.5 group"
            >
              <SwatchPicker
                color={(cat.symbol as { color?: string }).color ?? "#888888"}
                onChange={(c) => updateCategoryColor(i, c)}
              />
              {editingIdx === i ? (
                <>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit()
                      if (e.key === "Escape") cancelEdit()
                    }}
                    aria-label={t("common.edit")}
                    className="flex-1 min-w-0 h-5 rounded border border-input bg-background px-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                  <button
                    onClick={commitEdit}
                    aria-label={t("common.save")}
                    className="p-0.5 rounded text-primary hover:bg-accent shrink-0"
                  >
                    <Check size={10} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    aria-label={t("common.cancel")}
                    className="p-0.5 rounded text-muted-foreground hover:bg-accent shrink-0"
                  >
                    <X size={10} />
                  </button>
                </>
              ) : (
                <>
                  <span
                    className="flex-1 text-label truncate"
                    title={cat.label}
                  >
                    {cat.value === null
                      ? <em className="text-muted-foreground">{cat.label}</em>
                      : cat.label}
                  </span>
                  <button
                    onClick={() => startEdit(i)}
                    aria-label={t("common.edit")}
                    className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  >
                    <Pencil size={10} />
                  </button>
                  {cat.value !== null && (
                    <button
                      onClick={() => removeCategory(i)}
                      aria-label={t("common.delete")}
                      className="p-0.5 rounded text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <X size={10} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {categories.length > 0 && (
        <div className="text-label-sm text-muted-foreground text-center">
          {t("style.categorized.summary")
            .replace("{n}", String(categories.length))
            .replace("{k}", String(valueCount))}
        </div>
      )}
    </StyleSection>
  )
}

// Exported for tests
export const CATEGORIZED_MAX = MAX_CATEGORIES
