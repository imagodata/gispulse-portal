import React, { useState, useCallback, useEffect, useRef } from "react"
import { navigateToView } from "@/router"
import { X } from "lucide-react"
import { toast } from "sonner"
import { IconButton } from "@/components/ui/icon-button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useUIStore, type ContextSelection } from "@/stores/uiStore"
import { useMapViewStore, useActiveLayerStyle, layerKey } from "@/stores/mapViewStore"
import { useMapStore } from "@/stores/mapStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { useProjectStore } from "@/stores/projectStore"
import { useEditorStore } from "@/stores/editorStore"
import { useResultsStore } from "@/stores/resultsStore"
import { toggleTriggerApi, createJob, getJob } from "@/api/client"
import { LayerColorPicker } from "./LayerColorPicker"
import type { LayerMeta } from "@/types/dataset"
import type { Rule, Trigger } from "@/types/project"
import { NodePropertyPanel } from "./nodes/NodePropertyPanel"
// R-4 #136: Inline trigger builder replaces TriggerInspector for the Workflows view
import { TriggerBuilderInline } from "./triggers/TriggerBuilderInline"
// Hybrid Schema: EdgeInspector for relation edges
import { EdgeInspector } from "./EdgeInspector"

// ---------- Stat / Field display ----------

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium tabular-nums">{value.toLocaleString()}</span>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <span className="text-label-lg text-muted-foreground shrink-0">{label}</span>
      <span className="text-label-lg font-medium text-right break-all">{value}</span>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-label font-semibold uppercase tracking-wider text-muted-foreground mb-1 mt-3">
      {children}
    </h4>
  )
}

// ---------- Project Overview ----------

function ProjectOverview() {
  const datasets = useDatasetStore((s) => s.datasets)
  const rules = useProjectStore((s) => s.rules)
  const triggers = useProjectStore((s) => s.triggers)

  const totalLayers = datasets.reduce((acc, ds) => acc + (ds.layers ?? []).length, 0)
  const totalFeatures = datasets.reduce(
    (acc, ds) => acc + (ds.layers ?? []).reduce((a, l) => a + l.feature_count, 0),
    0,
  )

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Project Overview</h3>
      <div className="space-y-0.5">
        <Stat label="Datasets" value={datasets.length} />
        <Stat label="Layers" value={totalLayers} />
        <Stat label="Features" value={totalFeatures} />
        <Stat label="Rules" value={rules.length} />
        <Stat label="Triggers" value={triggers.length} />
      </div>
      <Separator className="my-3" />
      <SectionTitle>Pulse Suggestions</SectionTitle>
      <div className="space-y-1.5">
        {datasets.length === 0 ? (
          <p className="text-label-lg text-muted-foreground">
            Import a dataset to get started. Drop a GPKG, GeoJSON, or Shapefile in the left panel.
          </p>
        ) : rules.length === 0 ? (
          <p className="text-label-lg text-muted-foreground">
            Add a rule to start processing your spatial data. Use the Rules section in the activity bar.
          </p>
        ) : (
          <p className="text-label-lg text-muted-foreground">
            Everything looks good. Select a layer or rule to inspect details.
          </p>
        )}
      </div>
    </div>
  )
}

// ---------- Layer Inspector ----------

function LayerInspector({ datasetId, layerName }: { datasetId: string; layerName: string }) {
  const datasets = useDatasetStore((s) => s.datasets)
  const navigateView = useCallback((view: string) => {
    navigateToView(view)
  }, [])
  const zoomToExtent = useMapStore((s) => s.zoomToExtent)
  const setLayerColor = useMapViewStore((s) => s.setLayerColor)
  const setLayerOpacity = useMapViewStore((s) => s.setLayerOpacity)
  const setLayerVisible = useMapViewStore((s) => s.setLayerVisible)

  // Hooks must run unconditionally — keep `useActiveLayerStyle` above
  // the `!layer` early return (react-hooks/rules-of-hooks).
  const key = layerKey(datasetId, layerName)
  const vis = useActiveLayerStyle(key)

  const dataset = datasets.find((d) => d.id === datasetId)
  const layer: LayerMeta | undefined = dataset?.layers.find((l) => l.name === layerName)

  if (!layer) {
    return <p className="text-xs text-muted-foreground">Layer not found</p>
  }

  const [minX, minY, maxX, maxY] = layer.bbox

  return (
    <div>
      <h3 className="text-sm font-semibold mb-0.5">{layer.name}</h3>
      <p className="text-label text-muted-foreground mb-2">
        from {dataset?.name ?? "unknown dataset"}
      </p>

      <SectionTitle>Properties</SectionTitle>
      <FieldRow label="Geometry" value={layer.geometry_type ?? "none"} />
      <FieldRow label="CRS" value={layer.crs} />
      <FieldRow label="Features" value={layer.feature_count.toLocaleString()} />
      <FieldRow
        label="Bbox"
        value={
          <span className="text-label font-mono">
            {minX.toFixed(4)}, {minY.toFixed(4)}
            <br />
            {maxX.toFixed(4)}, {maxY.toFixed(4)}
          </span>
        }
      />

      <SectionTitle>Fields ({layer.fields.length})</SectionTitle>
      <div className="space-y-0.5 max-h-40 overflow-y-auto">
        {layer.fields.map((f) => (
          <div key={f.name} className="flex items-center justify-between py-0.5">
            <span className="text-label-lg truncate">{f.name}</span>
            <Badge variant="secondary" className="text-label-sm ml-1 shrink-0">
              {f.type}
            </Badge>
          </div>
        ))}
        {layer.fields.length === 0 && (
          <p className="text-label-lg text-muted-foreground">No fields</p>
        )}
      </div>

      <SectionTitle>Symbology</SectionTitle>
      <div className="space-y-2">
        {/* Color */}
        <div className="flex items-center justify-between">
          <span className="text-label-lg text-muted-foreground">Color</span>
          <LayerColorPicker
            color={vis?.color ?? "#3b82f6"}
            opacity={vis?.opacity ?? 0.7}
            onColorChange={(c) => setLayerColor(key, c)}
            onOpacityChange={(o) => setLayerOpacity(key, o)}
          />
        </div>
        {/* Opacity */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-label-lg text-muted-foreground">Opacity</span>
            <span className="text-label font-mono text-muted-foreground">{Math.round((vis?.opacity ?? 0.7) * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((vis?.opacity ?? 0.7) * 100)}
            onChange={(e) => setLayerOpacity(key, Number(e.target.value) / 100)}
            className="w-full h-1.5 accent-primary"
          />
        </div>
        {/* Visibility toggle */}
        <div className="flex items-center justify-between">
          <span className="text-label-lg text-muted-foreground">Visible</span>
          <button
            onClick={() => setLayerVisible(key, !(vis?.visible ?? true))}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              (vis?.visible ?? true) ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {(vis?.visible ?? true) ? "Visible" : "Hidden"}
          </button>
        </div>
      </div>

      <SectionTitle>Actions</SectionTitle>
      <div className="flex flex-col gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs justify-start"
          onClick={() => {
            navigateView("map")
            if (layer.bbox) zoomToExtent(layer.bbox)
          }}
        >
          Zoom to layer
        </Button>
      </div>
    </div>
  )
}

// ---------- Node Inspector (delegated to NodePropertyPanel) ----------

// ---------- Rule Inspector ----------

function RuleInspector({ ruleId }: { ruleId: string }) {
  const rules = useProjectStore((s) => s.rules)
  const toggleRule = useProjectStore((s) => s.toggleRule)
  const openRuleEditor = useEditorStore((s) => s.openRuleEditor)
  const datasets = useDatasetStore((s) => s.datasets)
  const setBottomTab = useUIStore((s) => s.setBottomTab)

  const rule: Rule | undefined = rules.find((r) => r.id === ruleId)
  const [targetDatasetId, setTargetDatasetId] = useState("")
  const [running, setRunning] = useState(false)
  // Track pending timer to cancel on unmount (#204)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimeout(pollTimerRef.current)
    }
  }, [])

  if (!rule) return <p className="text-xs text-muted-foreground">Rule not found</p>

  const configEntries = Object.entries(rule.config)

  // All layers across all datasets
  const allLayers = datasets.flatMap((ds) =>
    (ds.layers ?? []).map((l) => ({ datasetId: ds.id, datasetName: ds.name, layerName: l.name }))
  )

  const handleRunRule = async () => {
    if (!targetDatasetId || running) return
    setRunning(true)

    const target = allLayers.find((l) => `${l.datasetId}::${l.layerName}` === targetDatasetId)
    const resultId = `rule-${Date.now()}`

    // Add to results store
    const { addResult, updateResult } = useResultsStore.getState()
    addResult({
      id: resultId,
      type: "rule",
      name: `${rule.name} on ${target?.layerName ?? "unknown"}`,
      status: "running",
      datasetId: target?.datasetId,
      layerName: target?.layerName,
      ruleName: rule.name,
      capability: rule.capability,
      createdAt: new Date().toISOString(),
    })

    // Switch to Results tab
    setBottomTab("results")

    try {
      const job = await createJob({
        name: `Rule: ${rule.name}`,
        dataset_id: target?.datasetId ?? null,
        parameters: { rule_ids: [rule.id], layer_name: target?.layerName },
      })

      // Poll for completion — cleared on unmount to prevent memory leak (#204)
      const poll = async () => {
        if (!mountedRef.current) return
        const result = await getJob(job.id)
        if (!mountedRef.current) return
        if (result.status === "completed") {
          updateResult(resultId, {
            status: "completed",
            durationMs: result.duration_seconds ? result.duration_seconds * 1000 : undefined,
            resultPath: result.result_path ?? undefined,
          })
          toast.success(`Rule "${rule.name}" completed`)
          setRunning(false)
        } else if (result.status === "failed") {
          updateResult(resultId, {
            status: "failed",
            errorMessage: result.error_message ?? "Unknown error",
          })
          toast.error(`Rule "${rule.name}" failed: ${result.error_message ?? "Unknown"}`)
          setRunning(false)
        } else {
          // Still running, schedule next poll
          pollTimerRef.current = setTimeout(poll, 1000)
        }
      }
      pollTimerRef.current = setTimeout(poll, 500)
    } catch (err) {
      updateResult(resultId, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      toast.error(`Failed to start rule: ${err instanceof Error ? err.message : String(err)}`)
      setRunning(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <h3 className="text-sm font-semibold">{rule.name}</h3>
        <Badge variant={rule.enabled ? "default" : "secondary"} className="text-label-sm">
          {rule.enabled ? "enabled" : "disabled"}
        </Badge>
      </div>
      {rule.description && (
        <p className="text-label text-muted-foreground mb-2">{rule.description}</p>
      )}

      <SectionTitle>Properties</SectionTitle>
      <FieldRow label="Capability" value={rule.capability} />
      <FieldRow label="Scope" value={rule.scope || "--"} />

      {configEntries.length > 0 && (
        <>
          <SectionTitle>Config</SectionTitle>
          {configEntries.map(([key, val]) => (
            <FieldRow key={key} label={key} value={String(val)} />
          ))}
        </>
      )}

      {/* Run on layer */}
      <SectionTitle>Run</SectionTitle>
      <div className="space-y-1.5">
        {/* a11y: label associé au select (#213) */}
        <label htmlFor="rule-target-layer" className="sr-only">
          Select target layer for rule execution
        </label>
        <select
          id="rule-target-layer"
          value={targetDatasetId}
          onChange={(e) => setTargetDatasetId(e.target.value)}
          aria-label="Select target layer for rule execution"
          className="w-full h-7 rounded border bg-background px-2 text-xs"
        >
          <option value="">Select target layer...</option>
          {allLayers.map((l) => (
            <option key={`${l.datasetId}::${l.layerName}`} value={`${l.datasetId}::${l.layerName}`}>
              {l.layerName} ({l.datasetName})
            </option>
          ))}
        </select>
        <Button
          size="sm"
          className="h-7 text-xs w-full"
          disabled={!targetDatasetId || running}
          onClick={handleRunRule}
        >
          {running ? "Running..." : "Run on layer"}
        </Button>
      </div>

      <SectionTitle>Actions</SectionTitle>
      <div className="flex flex-col gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs justify-start"
          onClick={() => openRuleEditor(rule.id)}
        >
          Edit rule
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs justify-start"
          onClick={() => toggleRule(rule.id, !rule.enabled)}
        >
          {rule.enabled ? "Disable" : "Enable"} rule
        </Button>
      </div>
    </div>
  )
}

// ---------- Trigger Inspector ----------

export function TriggerInspector({ triggerId }: { triggerId: string }) {
  const [tab, setTab] = useState<"overview" | "conditions" | "operations">("overview")
  const triggers = useProjectStore((s) => s.triggers)
  const fetchTriggers = useProjectStore((s) => s.fetchTriggers)
  const openTriggerBuilder = useEditorStore((s) => s.openTriggerBuilder)

  const trigger: Trigger | undefined = triggers.find((t) => t.id === triggerId)
  if (!trigger) return <p className="text-xs text-muted-foreground">Trigger not found</p>

  const cond = trigger.conditions ?? {}
  const operations = (cond.operations as unknown[]) ?? []
  const predicates = cond.predicates as { predicates?: unknown[] } | undefined
  const actions = (cond.actions as unknown[]) ?? []
  const conditionCount = predicates?.predicates?.length ?? 0

  const handleToggle = async () => {
    try {
      await toggleTriggerApi(trigger.id)
      await fetchTriggers()
    } catch (err) {
      toast.error("Failed to toggle trigger")
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold truncate flex-1">{trigger.name}</h3>
        <Badge variant={trigger.enabled ? "default" : "secondary"} className="text-label-sm shrink-0">
          {trigger.enabled ? "on" : "off"}
        </Badge>
      </div>

      {/* Quick tabs */}
      <div className="flex gap-0.5 rounded-md border p-0.5 mb-3">
        {(["overview", "conditions", "operations"] as const).map((t) => {
          const count = t === "conditions" ? conditionCount : t === "operations" ? operations.length : null
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded px-2 py-1 text-label font-medium transition-colors capitalize ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {t}{count ? ` (${count})` : ""}
            </button>
          )
        })}
      </div>

      {/* Tab: Overview */}
      {tab === "overview" && (
        <>
          <FieldRow label="Type" value={trigger.trigger_type} />
          <FieldRow label="Category" value={(cond.category as string) ?? trigger.trigger_type} />
          <FieldRow label="Severity" value={(trigger as unknown as Record<string, unknown>).severity as string ?? "info"} />
          <FieldRow label="Event" value={trigger.event} />
          <FieldRow label="Rule ID" value={trigger.rule_id ?? "none"} />
          <FieldRow label="Auto-eval" value={(trigger as unknown as Record<string, unknown>).auto_eval ? "ON" : "OFF"} />

          {/* Counts summary */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {operations.length > 0 && (
              <Badge variant="secondary" className="text-label-sm">{operations.length} spatial ops</Badge>
            )}
            {conditionCount > 0 && (
              <Badge variant="secondary" className="text-label-sm">{conditionCount} conditions</Badge>
            )}
            {actions.length > 0 && (
              <Badge variant="secondary" className="text-label-sm">{actions.length} actions</Badge>
            )}
          </div>

          {/* Table reference */}
          {cond.table && (
            <>
              <SectionTitle>Table</SectionTitle>
              <p className="text-label-lg font-mono">{String(cond.table)}</p>
            </>
          )}
        </>
      )}

      {/* Tab: Conditions */}
      {tab === "conditions" && (
        <>
          {conditionCount === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No conditions configured</p>
          ) : (
            <div className="space-y-1">
              {(predicates?.predicates as Array<Record<string, unknown>> ?? []).map((p, i) => (
                <div key={i} className="rounded border px-2 py-1.5 text-label-lg">
                  <span className="font-semibold text-muted-foreground uppercase text-label-sm">
                    {String(p.type ?? "?")}
                  </span>
                  {p.type === "attr" && (
                    <span className="ml-1.5">{String(p.field)} {String(p.op)} {String(p.value)}</span>
                  )}
                  {p.type === "geom" && (
                    <span className="ml-1.5">
                      {String(p.op)} on {String(p.ref_table ?? "?")}
                      {p.aggregate_fn ? ` (${String(p.aggregate_fn)} ${String(p.aggregate_op)} ${String(p.aggregate_value)})` : null}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: Operations */}
      {tab === "operations" && (
        <>
          {operations.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No spatial operations</p>
          ) : (
            <div className="space-y-1">
              {(operations as Array<Record<string, unknown>>).map((op, i) => (
                <div key={i} className={`rounded border px-2 py-1.5 text-label-lg border-l-2 ${
                  op.phase === "before" ? "border-l-[var(--gp-node-trigger)]" : "border-l-blue-500"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-label-sm font-bold text-muted-foreground uppercase">{String(op.phase)}</span>
                    <span className="font-mono">{String(op.operation)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {String(op.table ?? "?")} . {String(op.field ?? "?")}
                    {op.distant_table ? <span> → {String(op.distant_table)}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <SectionTitle>Actions</SectionTitle>
      <div className="flex flex-col gap-1">
        <Button variant="outline" size="sm" className="h-7 text-xs justify-start" onClick={() => openTriggerBuilder(trigger.id)}>
          Edit trigger (expand)
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs justify-start" onClick={handleToggle}>
          {trigger.enabled ? "Disable" : "Enable"} trigger
        </Button>
      </div>
    </div>
  )
}

// ---------- Content Dispatcher ----------

function InspectorContent({ selection }: { selection: ContextSelection }) {
  switch (selection.type) {
    case "none":
      return <ProjectOverview />
    case "layer":
      return <LayerInspector datasetId={selection.datasetId} layerName={selection.layerName} />
    case "node":
      return <NodePropertyPanel nodeId={selection.nodeId} nodeType={selection.nodeType} nodeData={selection.nodeData} />
    case "rule":
      return <RuleInspector ruleId={selection.ruleId} />
    case "trigger":
      // R-4 #136: use inline builder; full modal accessible via "Full editor" button
      return <TriggerBuilderInline triggerId={selection.triggerId} />
    case "relation":
      return <EdgeInspector relationId={selection.relationId} />
  }
}

// ---------- Main InspectorPanel ----------

export function InspectorPanel() {
  const { inspectorOpen, contextSelection, setContextSelection } = useUIStore()

  if (!inspectorOpen) return null

  return (
    <div className="flex h-full flex-col bg-background border-l">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2 h-[37px]">
        <span className="text-label-lg font-semibold uppercase tracking-wider text-muted-foreground">
          {contextSelection.type === "none" ? "Inspector" : contextSelection.type}
        </span>
        <div className="flex items-center gap-0.5">
          {contextSelection.type !== "none" && (
            <IconButton
              label="Clear selection"
              onClick={() => setContextSelection({ type: "none" })}
            >
              <X size={12} />
            </IconButton>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          <InspectorContent selection={contextSelection} />
        </div>
      </ScrollArea>
    </div>
  )
}
