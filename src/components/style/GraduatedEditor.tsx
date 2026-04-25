/**
 * GraduatedEditor — Classify layer by numeric ranges with color ramps.
 *
 * 1. User picks a numeric field
 * 2. Selects classify method + number of classes
 * 3. "Classify" fetches field stats and computes breaks
 * 4. Applies selected color ramp to the class breaks
 */

import { useState, useCallback } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import type { GraduatedEntry, SymbolDef, GeomFamily, ClassifyMethod, ColorRampDef } from "@/types/layerStyle"
import type { LayerField } from "@/types/dataset"
import { defaultSymbol } from "@/types/layerStyle"
import { sampleRamp, SEQUENTIAL_RAMPS, DIVERGING_RAMPS, ALL_RAMPS } from "@/lib/colorRamps"
import { getFieldStats } from "@/api/client"
import { SwatchPicker, SliderInput, SelectInput, StyleSection } from "./shared"

const METHODS: { value: ClassifyMethod; label: string }[] = [
  { value: "equal_interval", label: "Equal Interval" },
  { value: "quantile", label: "Quantile" },
  { value: "natural_breaks", label: "Natural Breaks" },
  { value: "std_dev", label: "Std Deviation" },
]

interface Props {
  geom: GeomFamily
  fields: LayerField[]
  datasetId: string
  layerName: string
  graduatedField: string
  classifyMethod: ClassifyMethod
  colorRamp: ColorRampDef | undefined
  classes: GraduatedEntry[]
  onFieldChange: (field: string) => void
  onMethodChange: (method: ClassifyMethod) => void
  onRampChange: (ramp: ColorRampDef) => void
  onClassesChange: (classes: GraduatedEntry[]) => void
}

export function GraduatedEditor({
  geom, fields, datasetId, layerName,
  graduatedField, classifyMethod, colorRamp, classes,
  onFieldChange, onMethodChange, onRampChange, onClassesChange,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [numClasses, setNumClasses] = useState(5)

  const ramp = colorRamp ?? SEQUENTIAL_RAMPS[0]
  const numericFields = fields.filter((f) => f.type === "int" || f.type === "float" || f.type === "int64" || f.type === "float64")

  const classify = useCallback(async () => {
    if (!graduatedField) return
    setLoading(true)
    try {
      const stats = await getFieldStats(datasetId, layerName, graduatedField)
      const breaks = computeBreaks(stats.min, stats.max, numClasses, classifyMethod, stats.quantiles)
      const colors = sampleRamp(ramp, breaks.length)

      const entries: GraduatedEntry[] = breaks.map((br, i) => ({
        lower: br.lower,
        upper: br.upper,
        label: `${br.lower.toFixed(1)} - ${br.upper.toFixed(1)}`,
        symbol: { ...defaultSymbol(geom, colors[i]) } as SymbolDef,
      }))

      onClassesChange(entries)
    } catch (err) {
      console.error("Graduated classification failed:", err)
    } finally {
      setLoading(false)
    }
  }, [graduatedField, datasetId, layerName, numClasses, classifyMethod, ramp, geom, onClassesChange])

  return (
    <StyleSection title="Graduated">
      <SelectInput
        label="Field"
        value={graduatedField || ""}
        options={[
          { value: "", label: "Select numeric field..." },
          ...numericFields.map((f) => ({ value: f.name, label: `${f.name} (${f.type})` })),
        ]}
        onChange={onFieldChange}
      />

      <SelectInput
        label="Method"
        value={classifyMethod}
        options={METHODS}
        onChange={onMethodChange}
      />

      <SliderInput
        label="Classes"
        value={numClasses}
        min={2}
        max={12}
        step={1}
        onChange={setNumClasses}
      />

      {/* Color ramp selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-label text-muted-foreground w-14 shrink-0">Ramp</span>
        <select
          value={ramp.name}
          onChange={(e) => {
            const found = ALL_RAMPS.find((r) => r.name === e.target.value)
            if (found) onRampChange(found)
          }}
          className="flex-1 h-6 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <optgroup label="Sequential">
            {SEQUENTIAL_RAMPS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </optgroup>
          <optgroup label="Diverging">
            {DIVERGING_RAMPS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </optgroup>
        </select>
      </div>

      {/* Ramp preview */}
      <div className="flex items-center gap-1.5">
        <span className="text-label text-muted-foreground w-14 shrink-0" />
        <div className="flex-1 h-3 rounded overflow-hidden flex">
          {sampleRamp(ramp, 20).map((c, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <button
        onClick={classify}
        disabled={!graduatedField || loading}
        className="flex items-center justify-center gap-1.5 w-full h-7 rounded border border-input bg-background text-xs font-medium hover:bg-accent disabled:opacity-40 transition-colors"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        {loading ? "Classifying..." : "Classify"}
      </button>

      {/* Class breaks table */}
      {classes.length > 0 && (
        <div className="max-h-[240px] overflow-y-auto space-y-0.5 rounded border border-border p-1">
          {classes.map((cls, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <SwatchPicker
                color={(cls.symbol as any).color ?? "#888888"}
                onChange={(color) => {
                  const next = [...classes]
                  const sym = { ...next[i].symbol } as any
                  sym.color = color
                  if (sym.kind === "fill") sym.strokeColor = color
                  next[i] = { ...next[i], symbol: sym }
                  onClassesChange(next)
                }}
              />
              <span className="flex-1 text-label tabular-nums truncate">
                {cls.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {classes.length > 0 && (
        <div className="text-label-sm text-muted-foreground text-center">
          {classes.length} classes
        </div>
      )}
    </StyleSection>
  )
}

// ── Break computation ─────────────────────────────────────────────────

function computeBreaks(
  min: number,
  max: number,
  n: number,
  method: ClassifyMethod,
  quantiles?: Record<string, number>,
): { lower: number; upper: number }[] {
  if (min >= max || n < 1) return [{ lower: min, upper: max }]

  if (method === "equal_interval") {
    const step = (max - min) / n
    return Array.from({ length: n }, (_, i) => ({
      lower: min + step * i,
      upper: i === n - 1 ? max : min + step * (i + 1),
    }))
  }

  if (method === "quantile" && quantiles) {
    // Use API-provided quantiles to approximate
    const qKeys = Object.keys(quantiles).map(Number).sort((a, b) => a - b)
    const qValues = qKeys.map((k) => quantiles[String(k)])
    const allBreaks = [min, ...qValues, max]
    // Resample to n classes
    const step = (allBreaks.length - 1) / n
    const breaks: { lower: number; upper: number }[] = []
    for (let i = 0; i < n; i++) {
      const loIdx = Math.floor(i * step)
      const hiIdx = Math.min(Math.floor((i + 1) * step), allBreaks.length - 1)
      breaks.push({ lower: allBreaks[loIdx], upper: i === n - 1 ? max : allBreaks[hiIdx] })
    }
    return breaks
  }

  // Fallback to equal interval for other methods (natural_breaks would need the full dataset)
  const step = (max - min) / n
  return Array.from({ length: n }, (_, i) => ({
    lower: min + step * i,
    upper: i === n - 1 ? max : min + step * (i + 1),
  }))
}
