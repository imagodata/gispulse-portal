/**
 * GraduatedEditor — Classify a numeric attribute into class breaks.
 *
 * Workflow:
 *   1. User picks a numeric field
 *   2. Selects classify method + number of classes
 *   3. "Classify" calls POST /datasets/{id}/layers/{layer}/breaks (server-side
 *      jenks/quantile/equal_interval/std_dev/pretty)
 *   4. Histogram preview is rendered from /stats quantiles for visual context
 *   5. User can edit individual class break boundaries (switches method to
 *      "manual" so subsequent re-classify clicks don't overwrite their edits)
 *
 * Server-side breaks are authoritative: the backend ships proper jenks
 * (Fisher-Jenks) and pretty break implementations the client cannot
 * replicate accurately without shipping a full classification library.
 *
 * Histogram preview: 20-bin SVG bar chart derived from /stats quantiles
 * (linear interpolation between the 5/25/50/75/95 quantiles + min/max).
 * It is a *qualitative* visualisation — for budget reasons we don't pull
 * a charting library (~150 KB gzip avoided).
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { Loader2, RefreshCw, Pencil, Check, X } from "lucide-react"
import type {
  GraduatedEntry,
  SymbolDef,
  GeomFamily,
  ClassifyMethod,
  ColorRampDef,
} from "@/types/layerStyle"
import type { LayerField } from "@/types/dataset"
import { defaultSymbol } from "@/types/layerStyle"
import {
  sampleRamp,
  SEQUENTIAL_RAMPS,
  DIVERGING_RAMPS,
  ALL_RAMPS,
} from "@/lib/colorRamps"
import {
  getBreaks,
  getFieldStats,
  classifyMethodToBreaksMethod,
  type BreaksResult,
  type FieldStatsResult,
} from "@/api/styles"
import { useT } from "@/i18n/useT"
import type { StringKey } from "@/i18n/strings"
import { SwatchPicker, SliderInput, SelectInput, StyleSection } from "./shared"

const METHODS: { value: ClassifyMethod; labelKey: StringKey }[] = [
  { value: "equal_interval", labelKey: "style.method.equal_interval" },
  { value: "quantile",       labelKey: "style.method.quantile" },
  { value: "natural_breaks", labelKey: "style.method.natural_breaks" },
  { value: "std_dev",        labelKey: "style.method.std_dev" },
  { value: "manual",         labelKey: "style.method.manual" },
]

const HISTOGRAM_BINS = 20

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
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<FieldStatsResult | null>(null)
  const [numClasses, setNumClasses] = useState(5)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")

  const ramp = colorRamp ?? SEQUENTIAL_RAMPS[0]
  const numericFields = fields.filter(
    (f) => f.type === "int" || f.type === "float" || f.type === "int64" || f.type === "float64",
  )

  // ── Fetch stats whenever the graduatedField changes ─────────────────
  const lastStatsKey = useRef<string>("")
  useEffect(() => {
    if (!graduatedField) {
      lastStatsKey.current = ""
      return
    }
    const key = `${datasetId}::${layerName}::${graduatedField}`
    if (key === lastStatsKey.current) return
    lastStatsKey.current = key

    let cancelled = false
    // Defer setStatsLoading to next microtask so we never setState
    // synchronously in the effect body (per react-hooks/set-state-in-effect).
    queueMicrotask(() => { if (!cancelled) setStatsLoading(true) })
    getFieldStats(datasetId, layerName, graduatedField)
      .then((s) => { if (!cancelled) setStats(s) })
      .catch((err) => {
        if (!cancelled) {
          console.error("Field stats failed:", err)
          setStats(null)
        }
      })
      .finally(() => { if (!cancelled) setStatsLoading(false) })

    return () => { cancelled = true }
  }, [datasetId, layerName, graduatedField])

  // Clear stats whenever field is cleared — defer to next microtask so we
  // never setState synchronously inside the effect body.
  useEffect(() => {
    if (graduatedField) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setStats(null)
      setStatsLoading(false)
    })
    return () => { cancelled = true }
  }, [graduatedField])

  // ── Classify (server-side) ─────────────────────────────────────────
  const classify = useCallback(async () => {
    if (!graduatedField) return
    const breaksMethod = classifyMethodToBreaksMethod(classifyMethod)
    if (breaksMethod === null) {
      // Manual mode — don't overwrite user edits
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res: BreaksResult = await getBreaks(
        datasetId,
        layerName,
        graduatedField,
        breaksMethod,
        numClasses,
      )

      // Server returns N+1 break boundaries → N class entries
      const breakPoints = res.breaks
      if (breakPoints.length < 2) {
        setError(t("style.error.not_enough_breaks"))
        return
      }
      const colors = sampleRamp(ramp, breakPoints.length - 1)
      const entries: GraduatedEntry[] = []
      for (let i = 0; i < breakPoints.length - 1; i++) {
        const lower = breakPoints[i]
        const upper = breakPoints[i + 1]
        entries.push({
          lower,
          upper,
          label: res.labels?.[i] ?? `${formatBreak(lower)} – ${formatBreak(upper)}`,
          symbol: defaultSymbol(geom, colors[i]) as SymbolDef,
        })
      }
      onClassesChange(entries)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("Graduated classification failed:", err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [
    graduatedField, classifyMethod, datasetId, layerName,
    numClasses, ramp, geom, onClassesChange, t,
  ])

  // ── Reapply ramp colours when user changes the ramp without re-classifying
  const applyRamp = useCallback(
    (newRamp: ColorRampDef) => {
      onRampChange(newRamp)
      if (classes.length === 0) return
      const colors = sampleRamp(newRamp, classes.length)
      const next = classes.map((c, i) => {
        const sym = { ...c.symbol } as Record<string, unknown>
        sym.color = colors[i]
        if (sym.kind === "fill") sym.strokeColor = colors[i]
        return { ...c, symbol: sym as SymbolDef }
      })
      onClassesChange(next)
    },
    [classes, onClassesChange, onRampChange],
  )

  // ── Manual edit of a class boundary ────────────────────────────────
  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditValue(String(classes[idx].upper))
  }
  const cancelEdit = () => { setEditingIdx(null); setEditValue("") }
  const commitEdit = () => {
    if (editingIdx === null) return
    const v = Number(editValue)
    if (!Number.isFinite(v)) { cancelEdit(); return }

    const next = classes.map((c, i) => {
      if (i === editingIdx) {
        return { ...c, upper: v, label: `${formatBreak(c.lower)} – ${formatBreak(v)}` }
      }
      if (i === editingIdx + 1) {
        // adjacent class lower bound also moves
        return { ...c, lower: v, label: `${formatBreak(v)} – ${formatBreak(c.upper)}` }
      }
      return c
    })
    onClassesChange(next)
    onMethodChange("manual")
    setEditingIdx(null)
    setEditValue("")
  }

  // ── Histogram bins from quantiles ──────────────────────────────────
  const histogram = useMemo(() => buildHistogram(stats), [stats])

  return (
    <StyleSection title={t("style.section.graduated")}>
      <SelectInput
        label={t("style.field")}
        value={graduatedField || ""}
        options={[
          { value: "", label: t("style.field.placeholder_numeric") },
          ...numericFields.map((f) => ({ value: f.name, label: `${f.name} (${f.type})` })),
        ]}
        onChange={onFieldChange}
      />

      {/* Method */}
      <SelectInput
        label={t("style.method")}
        value={classifyMethod}
        options={METHODS.map((m) => ({ value: m.value, label: t(m.labelKey) }))}
        onChange={onMethodChange}
      />

      <SliderInput
        label={t("style.classes")}
        value={numClasses}
        min={2}
        max={12}
        step={1}
        onChange={setNumClasses}
      />

      {/* Color ramp */}
      <div className="flex items-center gap-1.5">
        <label htmlFor="graduated-ramp" className="text-label text-muted-foreground w-14 shrink-0">
          {t("style.ramp")}
        </label>
        <select
          id="graduated-ramp"
          value={ramp.name}
          onChange={(e) => {
            const found = ALL_RAMPS.find((r) => r.name === e.target.value)
            if (found) applyRamp(found)
          }}
          className="flex-1 h-6 rounded border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <optgroup label={t("style.ramp.sequential")}>
            {SEQUENTIAL_RAMPS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </optgroup>
          <optgroup label={t("style.ramp.diverging")}>
            {DIVERGING_RAMPS.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </optgroup>
        </select>
      </div>

      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="text-label text-muted-foreground w-14 shrink-0" />
        <div className="flex-1 h-3 rounded overflow-hidden flex">
          {sampleRamp(ramp, 20).map((c, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      {/* Histogram preview */}
      {graduatedField && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-label-sm text-muted-foreground">
            <span>{t("style.histogram")}</span>
            {statsLoading && <Loader2 size={10} className="animate-spin" />}
          </div>
          <Histogram
            bins={histogram}
            min={stats?.min ?? 0}
            max={stats?.max ?? 0}
            classBreaks={classes.length > 0
              ? [classes[0].lower, ...classes.map((c) => c.upper)]
              : []}
          />
        </div>
      )}

      <button
        onClick={classify}
        disabled={!graduatedField || loading || classifyMethod === "manual"}
        title={classifyMethod === "manual" ? t("style.classify.manual_disabled") : undefined}
        aria-label={t("style.classify")}
        className="flex items-center justify-center gap-1.5 w-full h-7 rounded border border-input bg-background text-xs font-medium hover:bg-accent disabled:opacity-40 transition-colors"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        {loading ? t("style.classifying") : t("style.classify")}
      </button>

      {error && (
        <div className="text-label-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {/* Class breaks table */}
      {classes.length > 0 && (
        <div className="max-h-[240px] overflow-y-auto space-y-0.5 rounded border border-border p-1">
          {classes.map((cls, i) => (
            <div key={i} className="flex items-center gap-1.5 group">
              <SwatchPicker
                color={(cls.symbol as { color?: string }).color ?? "#888888"}
                onChange={(color) => {
                  const next = [...classes]
                  const sym = { ...next[i].symbol } as Record<string, unknown>
                  sym.color = color
                  if (sym.kind === "fill") sym.strokeColor = color
                  next[i] = { ...next[i], symbol: sym as SymbolDef }
                  onClassesChange(next)
                }}
              />
              {editingIdx === i ? (
                <>
                  <span className="text-label tabular-nums text-muted-foreground shrink-0">
                    {formatBreak(cls.lower)} –
                  </span>
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit()
                      if (e.key === "Escape") cancelEdit()
                    }}
                    aria-label={t("style.edit_break")}
                    className="flex-1 min-w-0 h-5 rounded border border-input bg-background px-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
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
                  <span className="flex-1 text-label tabular-nums truncate">
                    {cls.label}
                  </span>
                  {/* Edit available on every class except the last (whose upper is dataset max) */}
                  {i < classes.length - 1 && (
                    <button
                      onClick={() => startEdit(i)}
                      aria-label={t("style.edit_break")}
                      className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {classes.length > 0 && (
        <div className="text-label-sm text-muted-foreground text-center">
          {classes.length} {t("style.classes_lc")}
          {classifyMethod === "manual" && ` · ${t("style.method.manual")}`}
        </div>
      )}
    </StyleSection>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatBreak(v: number): string {
  if (!Number.isFinite(v)) return "—"
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return v.toExponential(2)
  if (abs >= 100) return v.toFixed(0)
  if (abs >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

/**
 * Build a coarse histogram from a stats payload. We don't have raw values,
 * only quantiles ({0.05, 0.25, 0.5, 0.75, 0.95} typical), so we reconstruct
 * a piecewise-linear PDF by treating each (q_i, q_{i+1}) gap as a uniform
 * slab carrying the corresponding mass (q_{i+1} – q_i of the data).
 */
function buildHistogram(stats: FieldStatsResult | null): number[] {
  if (!stats || !Number.isFinite(stats.min) || !Number.isFinite(stats.max) || stats.min >= stats.max) {
    return []
  }
  const range = stats.max - stats.min
  const bins = new Array<number>(HISTOGRAM_BINS).fill(0)

  // Build the (quantile, value) anchors and sort by quantile
  const anchors: Array<[number, number]> = [[0, stats.min]]
  if (stats.quantiles) {
    for (const k of Object.keys(stats.quantiles)) {
      const q = Number(k)
      if (Number.isFinite(q) && q > 0 && q < 1) {
        anchors.push([q, stats.quantiles[k]])
      }
    }
  }
  anchors.push([1, stats.max])
  anchors.sort((a, b) => a[0] - b[0])

  // Distribute the mass q_{i+1} – q_i uniformly across the bin range
  for (let i = 0; i < anchors.length - 1; i++) {
    const [q0, v0] = anchors[i]
    const [q1, v1] = anchors[i + 1]
    const mass = q1 - q0
    if (mass <= 0 || v1 <= v0) continue

    const lo = Math.max(0, Math.floor(((v0 - stats.min) / range) * HISTOGRAM_BINS))
    const hi = Math.min(HISTOGRAM_BINS - 1, Math.floor(((v1 - stats.min) / range) * HISTOGRAM_BINS))
    const span = hi - lo + 1
    const perBin = mass / span
    for (let b = lo; b <= hi; b++) bins[b] += perBin
  }
  return bins
}

interface HistogramProps {
  bins: number[]
  min: number
  max: number
  classBreaks: number[]
}

function Histogram({ bins, min, max, classBreaks }: HistogramProps) {
  if (bins.length === 0) {
    return (
      <div
        className="h-12 rounded border border-dashed border-border flex items-center justify-center text-label-sm text-muted-foreground"
        role="img"
        aria-label="No histogram data"
      >
        —
      </div>
    )
  }
  const peak = Math.max(...bins) || 1
  const W = 200
  const H = 36
  const range = max - min || 1

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 8}`}
      className="w-full h-12"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Histogram from ${formatBreak(min)} to ${formatBreak(max)}`}
    >
      {/* Bars */}
      {bins.map((v, i) => {
        const h = (v / peak) * H
        const x = (i * W) / bins.length
        const w = W / bins.length - 0.5
        return (
          <rect
            key={i}
            x={x}
            y={H - h}
            width={Math.max(w, 0.5)}
            height={h}
            className="fill-primary/30"
          />
        )
      })}
      {/* Class break lines */}
      {classBreaks.slice(1, -1).map((br, i) => {
        const x = ((br - min) / range) * W
        return (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={0}
            y2={H}
            className="stroke-primary"
            strokeWidth={0.75}
            strokeDasharray="2,2"
          />
        )
      })}
      {/* Axis labels */}
      <text
        x={0}
        y={H + 7}
        className="fill-muted-foreground"
        style={{ fontSize: 7, fontFamily: "monospace" }}
      >
        {formatBreak(min)}
      </text>
      <text
        x={W}
        y={H + 7}
        textAnchor="end"
        className="fill-muted-foreground"
        style={{ fontSize: 7, fontFamily: "monospace" }}
      >
        {formatBreak(max)}
      </text>
    </svg>
  )
}
