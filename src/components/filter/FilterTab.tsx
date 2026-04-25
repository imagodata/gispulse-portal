/**
 * FilterTab — Main filtering interface.
 *
 * Supports two modes:
 * - Simple: single expression + spatial predicate (original)
 * - Chain: multi-step filter chain with types, priorities, and combination strategies
 *
 * Also shows execution stats (time, cache hit, backend) and validation feedback.
 */

import { useCallback } from "react"
import { useDatasetStore } from "@/stores/datasetStore"
import {
  useFilterStore,
  type SpatialPredicate,
  type FilterTypeId,
  type CombinationStrategyId,
} from "@/stores/filterStore"
import { useMapStore } from "@/stores/mapStore"
import {
  previewFilter,
  applyFilter,
  applyChain,
  validateExpression,
  type FilterRequest,
  type FilterChainRequest,
} from "@/api/filter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  PlayIcon,
  EyeIcon,
  RotateCcwIcon,
  Loader2Icon,
  PlusIcon,
  XIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ZapIcon,
  DatabaseIcon,
  LinkIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

const PREDICATES: { id: SpatialPredicate; label: string; icon: string }[] = [
  { id: "intersects", label: "Intersects", icon: "\u2297" },
  { id: "contains", label: "Contains", icon: "\u2287" },
  { id: "within", label: "Within", icon: "\u2286" },
  { id: "crosses", label: "Crosses", icon: "\u2715" },
  { id: "touches", label: "Touches", icon: "\u2299" },
  { id: "overlaps", label: "Overlaps", icon: "\u2298" },
  { id: "disjoint", label: "Disjoint", icon: "\u2205" },
  { id: "equals", label: "Equals", icon: "\u2261" },
  { id: "dwithin", label: "DWithin", icon: "\u2194" },
]

const FILTER_TYPES: { id: FilterTypeId; label: string }[] = [
  { id: "field_condition", label: "Field condition" },
  { id: "spatial_selection", label: "Spatial selection" },
  { id: "spatial_relation", label: "Spatial relation" },
  { id: "buffer_intersect", label: "Buffer intersect" },
  { id: "custom_expression", label: "Custom expression" },
  { id: "fid_list", label: "FID list" },
  { id: "bbox_filter", label: "Bbox filter" },
]

const STRATEGIES: { id: CombinationStrategyId; label: string }[] = [
  { id: "priority_and", label: "AND (priority)" },
  { id: "priority_or", label: "OR (priority)" },
  { id: "custom", label: "Custom" },
  { id: "replace", label: "Replace" },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LayerSelect({
  label,
  datasetId,
  layerName,
  onChange,
}: {
  label: string
  datasetId: string | null
  layerName: string | null
  onChange: (dsId: string, ln: string) => void
}) {
  const datasets = useDatasetStore((s) => s.datasets)
  const options = datasets.flatMap((ds) =>
    (ds.layers ?? [])
      .filter((l) => l.geometry_type)
      .map((l) => ({
        key: `${ds.id}::${l.name}`,
        dsId: ds.id,
        dsName: ds.name,
        layerName: l.name,
        geomType: l.geometry_type,
        count: l.feature_count,
      })),
  )
  const currentKey = datasetId && layerName ? `${datasetId}::${layerName}` : ""
  const selectId = `filter-layer-select-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

  return (
    <div className="space-y-1">
      <label htmlFor={selectId} className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        id={selectId}
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        value={currentKey}
        onChange={(e) => {
          const opt = options.find((o) => o.key === e.target.value)
          if (opt) onChange(opt.dsId, opt.layerName)
        }}
      >
        <option value="">-- Select layer --</option>
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.dsName} / {opt.layerName} ({opt.count} feat.)
          </option>
        ))}
      </select>
    </div>
  )
}

function ExecutionStats() {
  const { executionTimeMs, isCached, backend } = useFilterStore()
  if (executionTimeMs === null) return null
  return (
    <div className="flex items-center gap-2 text-label text-muted-foreground">
      <span className="flex items-center gap-0.5">
        <ZapIcon className="size-3" />
        {executionTimeMs.toFixed(0)}ms
      </span>
      {isCached && (
        <Badge variant="outline" className="h-4 px-1 text-label">cached</Badge>
      )}
      {backend && (
        <span className="flex items-center gap-0.5">
          <DatabaseIcon className="size-3" />
          {backend}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FilterTab() {
  const store = useFilterStore()
  const {
    filterMode,
    sourceDatasetId,
    sourceLayerName,
    targetDatasetId,
    targetLayerName,
    expression,
    spatialPredicate,
    bufferDistance,
    bufferEnabled,
    chainFilters,
    combinationStrategy,
    validationErrors,
    loading,
    previewCount,
    previewTotal,
    filteredCount,
    error,
    setFilterMode,
    setSource,
    setTarget,
    setExpression,
    togglePredicate,
    setBufferDistance,
    setBufferEnabled,
    setLoading,
    setPreview,
    setResults,
    setError,
    setValidationErrors,
    setIsValidating,
    pushHistory,
    reset,
    addChainFilter,
    removeChainFilter,
    updateChainFilter,
    reorderChainFilter,
    setCombinationStrategy,
  } = store

  const zoomToExtent = useMapStore((s) => s.zoomToExtent)

  // --- Simple mode request builder ---
  const buildSimpleRequest = useCallback((): FilterRequest | null => {
    if (!targetDatasetId || !targetLayerName) return null
    return {
      dataset_id: targetDatasetId,
      layer_name: targetLayerName,
      expression: expression || null,
      spatial_predicate: spatialPredicate || null,
      ref_dataset_id: spatialPredicate ? sourceDatasetId : null,
      ref_layer_name: spatialPredicate ? sourceLayerName : null,
      buffer_distance: bufferEnabled ? bufferDistance : null,
    }
  }, [targetDatasetId, targetLayerName, expression, spatialPredicate, sourceDatasetId, sourceLayerName, bufferEnabled, bufferDistance])

  // --- Chain mode request builder ---
  const buildChainRequest = useCallback((): FilterChainRequest | null => {
    if (!targetDatasetId || !targetLayerName || chainFilters.length === 0) return null
    return {
      dataset_id: targetDatasetId,
      layer_name: targetLayerName,
      combination_strategy: combinationStrategy,
      filters: chainFilters.map((f) => ({
        type: f.type,
        expression: f.expression,
        layer_name: f.layerName,
        priority: f.priority,
        operator: f.operator,
      })),
    }
  }, [targetDatasetId, targetLayerName, chainFilters, combinationStrategy])

  // --- Validate expression ---
  const handleValidate = useCallback(async () => {
    if (!expression) return
    setIsValidating(true)
    try {
      const res = await validateExpression(expression)
      setValidationErrors(res.errors)
      if (res.is_valid) toast.success("Expression is valid")
      else toast.error(`Validation: ${res.errors.join(", ")}`)
    } catch {
      setValidationErrors(["Validation request failed"])
    } finally {
      setIsValidating(false)
    }
  }, [expression, setIsValidating, setValidationErrors])

  // --- Preview ---
  const handlePreview = useCallback(async () => {
    if (filterMode === "simple") {
      const req = buildSimpleRequest()
      if (!req) return
      setLoading(true)
      setError(null)
      try {
        const res = await previewFilter(req)
        setPreview(res.count, res.total, res.bbox, res.execution_time_ms, res.is_cached, res.backend)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Preview failed")
      } finally {
        setLoading(false)
      }
    }
    // Chain mode: no separate preview, use apply
  }, [filterMode, buildSimpleRequest, setLoading, setError, setPreview])

  // --- Apply ---
  const handleApply = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (filterMode === "chain") {
        const req = buildChainRequest()
        if (!req) return
        const res = await applyChain(req)
        setResults(res.features, res.filtered_count, res.execution_time_ms, res.is_cached, res.backend)
        if (res.bbox) zoomToExtent(res.bbox)
        toast.success(`${res.filtered_count} / ${res.total_count} features (chain)`)
      } else {
        const req = buildSimpleRequest()
        if (!req) return
        const res = await applyFilter(req)
        setResults(res.features, res.filtered_count, res.execution_time_ms, res.is_cached, res.backend)
        if (res.bbox) zoomToExtent(res.bbox)
        pushHistory({
          expression,
          spatialPredicate,
          sourceLayerName,
          targetLayerName,
          bufferDistance,
          resultCount: res.filtered_count,
        })
        toast.success(`${res.filtered_count} / ${res.total_count} features`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Filter failed")
      toast.error("Filter failed")
    }
  }, [filterMode, buildSimpleRequest, buildChainRequest, setLoading, setError, setResults, zoomToExtent, pushHistory, expression, spatialPredicate, sourceLayerName, targetLayerName, bufferDistance])

  const handleReset = useCallback(() => {
    reset()
    toast.info("Filter reset")
  }, [reset])

  const canExecuteSimple = !!targetDatasetId && !!targetLayerName && (!!expression || !!spatialPredicate)
  const canExecuteChain = !!targetDatasetId && !!targetLayerName && chainFilters.length > 0
  const canExecute = filterMode === "simple" ? canExecuteSimple : canExecuteChain

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1">
        <button
          className={cn(
            "flex-1 rounded-md border px-2 py-1 text-xs transition-colors",
            filterMode === "simple" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
          )}
          onClick={() => setFilterMode("simple")}
        >
          Simple
        </button>
        <button
          className={cn(
            "flex-1 rounded-md border px-2 py-1 text-xs transition-colors",
            filterMode === "chain" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
          )}
          onClick={() => setFilterMode("chain")}
        >
          <LinkIcon className="mr-1 inline size-3" />
          Chain
        </button>
      </div>

      {/* Layer selectors */}
      <LayerSelect
        label="Source layer (reference)"
        datasetId={sourceDatasetId}
        layerName={sourceLayerName}
        onChange={(dsId, ln) => setSource(dsId, ln)}
      />
      <LayerSelect
        label="Target layer (to filter)"
        datasetId={targetDatasetId}
        layerName={targetLayerName}
        onChange={(dsId, ln) => setTarget(dsId, ln)}
      />

      {/* === SIMPLE MODE === */}
      {filterMode === "simple" && (
        <>
          {/* Attribute expression */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="filter-expression" className="text-xs font-medium text-muted-foreground">Attribute expression</label>
              {expression && (
                <button className="text-label text-primary hover:underline" onClick={handleValidate}>
                  Validate
                </button>
              )}
            </div>
            <Input
              id="filter-expression"
              placeholder="e.g. population > 1000"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              className={cn("font-mono text-xs", validationErrors.length > 0 && "border-destructive")}
            />
            {validationErrors.length > 0 && (
              <p className="text-label text-destructive">{validationErrors.join("; ")}</p>
            )}
          </div>

          {/* Spatial predicates grid */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Spatial predicate</label>
            <div className="grid grid-cols-3 gap-1">
              {PREDICATES.map((p) => (
                <button
                  key={p.id}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                    spatialPredicate === p.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted",
                  )}
                  onClick={() => togglePredicate(p.id)}
                  title={p.label}
                >
                  <span className="text-sm">{p.icon}</span>
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Buffer controls */}
          {spatialPredicate && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="buffer-toggle"
                  checked={bufferEnabled}
                  onChange={(e) => setBufferEnabled(e.target.checked)}
                  className="size-3.5"
                />
                <label htmlFor="buffer-toggle" className="text-xs font-medium text-muted-foreground">
                  Buffer (meters)
                </label>
              </div>
              {bufferEnabled && (
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={bufferDistance}
                  onChange={(e) => setBufferDistance(Number(e.target.value))}
                  className="font-mono text-xs"
                />
              )}
            </div>
          )}
        </>
      )}

      {/* === CHAIN MODE === */}
      {filterMode === "chain" && (
        <>
          {/* Combination strategy */}
          <div className="space-y-1">
            <label htmlFor="filter-combination-strategy" className="text-xs font-medium text-muted-foreground">Combination strategy</label>
            <select
              id="filter-combination-strategy"
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={combinationStrategy}
              onChange={(e) => setCombinationStrategy(e.target.value as CombinationStrategyId)}
            >
              {STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Filter chain items */}
          <div className="space-y-2">
            {chainFilters.map((f, idx) => (
              <div key={f.id} className="flex gap-1 rounded-md border p-2">
                <div className="flex-1 space-y-1">
                  <div className="flex gap-1">
                    <select
                      className="rounded border bg-background px-1 py-0.5 text-label"
                      value={f.type}
                      onChange={(e) => updateChainFilter(f.id, { type: e.target.value as FilterTypeId })}
                    >
                      {FILTER_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    <select
                      className="rounded border bg-background px-1 py-0.5 text-label"
                      value={f.operator}
                      onChange={(e) => updateChainFilter(f.id, { operator: e.target.value as "AND" | "OR" })}
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={f.priority}
                      onChange={(e) => updateChainFilter(f.id, { priority: Number(e.target.value) })}
                      className="w-14 px-1 py-0.5 text-label"
                      title="Priority (1-100)"
                    />
                  </div>
                  <Input
                    placeholder="Expression..."
                    value={f.expression}
                    onChange={(e) => updateChainFilter(f.id, { expression: e.target.value })}
                    className="font-mono text-label"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => reorderChainFilter(f.id, "up")} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronUpIcon className="size-3" />
                  </button>
                  <button onClick={() => removeChainFilter(f.id)} className="text-destructive hover:text-destructive/80">
                    <XIcon className="size-3" />
                  </button>
                  <button onClick={() => reorderChainFilter(f.id, "down")} disabled={idx === chainFilters.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronDownIcon className="size-3" />
                  </button>
                </div>
              </div>
            ))}

            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={() => addChainFilter({
                type: "field_condition",
                expression: "",
                layerName: targetLayerName || "",
                priority: 50,
                operator: "AND",
              })}
            >
              <PlusIcon className="mr-1 size-3" />
              Add filter
            </Button>
          </div>
        </>
      )}

      {/* Preview result */}
      {previewCount !== null && previewTotal !== null && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs">
            <Badge variant="secondary">{previewCount} / {previewTotal}</Badge>
            <span className="text-muted-foreground">features match</span>
          </div>
          <ExecutionStats />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {filterMode === "simple" && (
          <Button
            size="sm"
            variant="outline"
            onClick={handlePreview}
            disabled={!canExecute || loading}
            className="flex-1"
          >
            {loading ? <Loader2Icon className="size-3.5 animate-spin" /> : <EyeIcon className="size-3.5" />}
            Preview
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleApply}
          disabled={!canExecute || loading}
          className="flex-1"
        >
          {loading ? <Loader2Icon className="size-3.5 animate-spin" /> : <PlayIcon className="size-3.5" />}
          Apply
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReset}
          title="Reset filter"
        >
          <RotateCcwIcon className="size-3.5" />
        </Button>
      </div>

      {/* Result count + stats */}
      {filteredCount !== null && (
        <div className="space-y-1">
          <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700 dark:text-green-400">
            {filteredCount} features returned
          </div>
          <ExecutionStats />
        </div>
      )}
    </div>
  )
}
