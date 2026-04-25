/**
 * Rich, editable property panel displayed in the Inspector when a node is selected.
 * Two-way sync: editing here updates the node on the canvas via useReactFlow().
 *
 * Sprint R-4 updates:
 *   #133 — "Run this node only" button (POST /scenarios/{id}/run-node)
 *   #135 — "Save as Rule" context action (POST /rules/from-node)
 */

import { useCallback, useState } from "react"
import { Play, BookmarkPlus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useDatasetStore } from "@/stores/datasetStore"
import { useEditorStore } from "@/stores/editorStore"
import { useProjectStore } from "@/stores/projectStore"
import { NODE_STYLES, type NodeCategory } from "./nodeStyles"
import { SQLEditor } from "../sql/SQLEditor"
import { runScenarioNode, createRuleFromNode } from "@/api/client"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-label font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 mt-3 first:mt-0">
      {children}
    </h4>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <label className="text-label text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function nodeCategory(nodeType?: string): NodeCategory {
  switch (nodeType) {
    case "datasetSource": return "source"
    case "capability": return "transform"
    case "output": return "output"
    case "trigger": return "trigger"
    case "branch": return "control"
    case "codeBlock": return "code"
    default: return "transform"
  }
}

// ---------------------------------------------------------------------------
// CAPABILITY_PARAMS — full parameter set (not just primary)
// ---------------------------------------------------------------------------

const CAPABILITY_PARAMS: Record<string, { key: string; label: string; type: "number" | "select" | "text"; options?: string[]; hint?: string }[]> = {
  buffer: [
    { key: "distance", label: "Distance", type: "number", hint: "Buffer distance" },
    { key: "units", label: "Units", type: "select", options: ["meters", "kilometers", "degrees", "feet"] },
    { key: "cap_style", label: "Cap style", type: "select", options: ["round", "flat", "square"] },
    { key: "join_style", label: "Join style", type: "select", options: ["round", "mitre", "bevel"] },
    { key: "resolution", label: "Resolution", type: "number", hint: "Segments per quarter circle" },
  ],
  intersect: [
    { key: "predicate", label: "Predicate", type: "select", options: ["intersects", "within", "contains", "touches", "crosses"] },
    { key: "keep_geom", label: "Keep geometry from", type: "select", options: ["left", "right", "intersection"] },
  ],
  spatial_join: [
    { key: "predicate", label: "Predicate", type: "select", options: ["intersects", "within", "contains", "nearest"] },
    { key: "how", label: "Join type", type: "select", options: ["inner", "left", "right"] },
    { key: "max_distance", label: "Max distance", type: "number", hint: "For nearest" },
    { key: "suffix", label: "Column suffix", type: "text", hint: "e.g. _right" },
  ],
  filter: [
    { key: "expression", label: "WHERE expression", type: "text", hint: "SQL WHERE clause" },
  ],
  dissolve: [
    { key: "by", label: "Group by", type: "text", hint: "Comma-separated fields" },
    { key: "aggfunc", label: "Aggregate", type: "select", options: ["first", "sum", "mean", "count", "min", "max"] },
  ],
  reproject: [
    { key: "target_crs", label: "Target CRS", type: "text", hint: "e.g. EPSG:4326" },
  ],
  classify: [
    { key: "field", label: "Field", type: "text" },
    { key: "method", label: "Method", type: "select", options: ["equal_interval", "quantile", "jenks", "std_dev"] },
    { key: "n_classes", label: "Number of classes", type: "number" },
    { key: "output_field", label: "Output field", type: "text", hint: "Name for classified column" },
  ],
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface NodePropertyPanelProps {
  nodeId: string
  nodeType?: string
  nodeData?: Record<string, unknown>
}

export function NodePropertyPanel({ nodeId, nodeType, nodeData }: NodePropertyPanelProps) {
  const updateNodeData = useEditorStore((s) => s.updateNodeData)
  const datasets = useDatasetStore((s) => s.datasets)
  const execState = useEditorStore((s) => s.nodeExecStates[nodeId])
  const setNodeExecState = useEditorStore((s) => s.setNodeExecState)
  const activeScenarioId = useEditorStore((s) => s.activeScenarioId)
  const fetchRules = useProjectStore((s) => s.fetchRules)
  const cat = nodeCategory(nodeType)
  const style = NODE_STYLES[cat]

  const [runningNode, setRunningNode] = useState(false)
  const [savingRule, setSavingRule] = useState(false)

  const data = nodeData ?? {}
  const label = (data.label as string) ?? "Node"
  const config = (data.config as Record<string, unknown>) ?? {}

  const updateData = useCallback((key: string, value: unknown) => {
    updateNodeData(nodeId, key, value)
  }, [nodeId, updateNodeData])

  const updateConfig = useCallback((key: string, value: unknown) => {
    updateNodeData(nodeId, "__config", { [key]: value })
  }, [nodeId, updateNodeData])

  // R-4 #133: Run this node only
  const handleRunNode = useCallback(async () => {
    if (!activeScenarioId) {
      toast.error("Save the scenario first before running a node.")
      return
    }
    setRunningNode(true)
    setNodeExecState(nodeId, { status: "running" })
    try {
      const result = await runScenarioNode(activeScenarioId, nodeId, {})
      setNodeExecState(nodeId, {
        status: result.status === "success" ? "success" : "failed",
        duration_ms: result.duration_ms,
        error: result.error ?? undefined,
      })
      if (result.status === "success") {
        toast.success(`Node ran successfully (${result.output_count ?? 0} features, ${result.duration_ms}ms)`)
      } else {
        toast.error(`Node failed: ${result.error ?? "Unknown error"}`)
      }
    } catch (err) {
      setNodeExecState(nodeId, { status: "failed", error: String(err) })
      toast.error(`Run failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRunningNode(false)
    }
  }, [activeScenarioId, nodeId, setNodeExecState])

  // R-4 #135: Save node as Rule
  const handleSaveAsRule = useCallback(async () => {
    const capability = (data.capability as string) ?? nodeType ?? ""
    if (!capability || capability === "datasetSource" || capability === "output") {
      toast.error("Only capability nodes can be saved as rules.")
      return
    }
    setSavingRule(true)
    try {
      await createRuleFromNode({
        capability,
        label,
        params: { ...config },
        description: `Rule saved from node "${label}"`,
      })
      await fetchRules()
      toast.success(`Rule "${label}" saved. It now appears in My Rules.`)
    } catch (err) {
      toast.error(`Save as Rule failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingRule(false)
    }
  }, [data, nodeType, label, config, fetchRules])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-2.5 w-2.5 rounded-full ${style.border.replace("border-", "bg-")}`} />
        <h3 className="text-sm font-semibold truncate flex-1">{label}</h3>
        <Badge variant="secondary" className="text-label-sm capitalize">{style.label}</Badge>
      </div>
      <p className="text-label text-muted-foreground mb-2 font-mono">ID: {nodeId}</p>

      {/* Execution status */}
      {execState && (
        <div className={`rounded-md px-2 py-1.5 text-label-lg mb-2 ${
          execState.status === "success" ? "bg-green-500/10 text-green-700 dark:text-green-400" :
          execState.status === "failed" ? "bg-red-500/10 text-red-700 dark:text-red-400" :
          execState.status === "running" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" :
          "bg-muted text-muted-foreground"
        }`}>
          <span className="font-semibold capitalize">{execState.status}</span>
          {execState.duration_ms != null && <span className="ml-2">{execState.duration_ms}ms</span>}
          {execState.error && <p className="mt-0.5 text-label">{execState.error}</p>}
        </div>
      )}

      {/* R-4 #133/#135: Quick actions — Run this node + Save as Rule */}
      <div className="flex gap-1.5 my-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs flex-1 gap-1"
          onClick={handleRunNode}
          disabled={runningNode || !activeScenarioId}
          title={!activeScenarioId ? "Save scenario first" : "Run only this node"}
        >
          {runningNode ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Play size={11} />
          )}
          Run node
        </Button>
        {(nodeType === "capability") && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleSaveAsRule}
            disabled={savingRule}
            title="Save this node configuration as a reusable rule"
          >
            {savingRule ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <BookmarkPlus size={11} />
            )}
            Save as Rule
          </Button>
        )}
      </div>

      <Separator />

      {/* ---- Label (all nodes) ---- */}
      <SectionTitle>General</SectionTitle>
      <Field label="Label">
        <Input
          value={label}
          onChange={(e) => updateData("label", e.target.value)}
          className="text-xs h-7"
        />
      </Field>

      {/* ==== Dataset Source ==== */}
      {nodeType === "datasetSource" && (
        <>
          <SectionTitle>Source</SectionTitle>
          <Field label="Dataset">
            <select
              value={(data.datasetId as string) ?? ""}
              onChange={(e) => {
                const ds = datasets.find((d) => d.id === e.target.value)
                const firstLayer = ds?.layers?.[0]?.name ?? ""
                updateData("datasetId", e.target.value)
                updateData("layerName", firstLayer)
                if (firstLayer) updateData("label", firstLayer)
              }}
              className="w-full h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">Select dataset...</option>
              {datasets.map((ds) => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
            </select>
          </Field>
          {data.datasetId && (
            <Field label="Layer">
              {(() => {
                const ds = datasets.find((d) => d.id === data.datasetId)
                const layers = ds?.layers ?? []
                return (
                  <select
                    value={(data.layerName as string) ?? ""}
                    onChange={(e) => { updateData("layerName", e.target.value); updateData("label", e.target.value) }}
                    className="w-full h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    {layers.map((l) => <option key={l.name} value={l.name}>{l.name} ({l.feature_count})</option>)}
                  </select>
                )
              })()}
            </Field>
          )}
        </>
      )}

      {/* ==== Trigger ==== */}
      {nodeType === "trigger" && (
        <>
          <SectionTitle>Trigger Config</SectionTitle>
          <Field label="Type">
            <select
              value={(data.triggerType as string) ?? "On DML"}
              onChange={(e) => updateData("triggerType", e.target.value)}
              className="w-full h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="On DML">On DML</option>
              <option value="On Schedule">On Schedule</option>
              <option value="On Threshold">On Threshold</option>
            </select>
          </Field>
          <Field label="Table">
            <Input value={(data.tableName as string) ?? ""} onChange={(e) => updateData("tableName", e.target.value)} placeholder="table name" className="text-xs h-7" />
          </Field>
          {(data.triggerType ?? "On DML") === "On DML" && (
            <Field label="Event">
              <select
                value={(data.eventType as string) ?? "INSERT"}
                onChange={(e) => updateData("eventType", e.target.value)}
                className="w-full h-8 rounded-md border bg-background px-2 text-xs"
              >
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="INSERT,UPDATE">INSERT + UPDATE</option>
              </select>
            </Field>
          )}
          {data.triggerType === "On Schedule" && (
            <Field label="Cron expression">
              <Input value={(data.cron as string) ?? ""} onChange={(e) => updateData("cron", e.target.value)} placeholder="*/5 * * * *" className="text-xs h-7 font-mono" />
            </Field>
          )}
          {data.triggerType === "On Threshold" && (
            <Field label="Threshold">
              <Input value={(data.threshold as string) ?? ""} onChange={(e) => updateData("threshold", e.target.value)} placeholder="count > 100" className="text-xs h-7 font-mono" />
            </Field>
          )}
        </>
      )}

      {/* ==== Capability ==== */}
      {nodeType === "capability" && (
        <>
          <SectionTitle>Capability</SectionTitle>
          <Field label="Capability">
            <select
              value={(data.capability as string) ?? ""}
              onChange={(e) => { updateData("capability", e.target.value); updateData("label", e.target.value) }}
              className="w-full h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">Select...</option>
              {["buffer", "intersect", "spatial_join", "filter", "dissolve", "reproject", "classify", "clip", "union", "difference", "centroid", "simplify"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          {/* Full parameter set */}
          {(() => {
            const cap = (data.capability as string) ?? ""
            const params = CAPABILITY_PARAMS[cap] ?? []
            if (params.length === 0) return null
            return (
              <>
                <SectionTitle>Parameters</SectionTitle>
                <div className="space-y-2">
                  {params.map((p) => (
                    <Field key={p.key} label={p.label}>
                      {p.type === "number" && (
                        <Input type="number" value={(config[p.key] as number) ?? ""} onChange={(e) => updateConfig(p.key, e.target.value ? Number(e.target.value) : "")} placeholder={p.hint} className="text-xs h-7" />
                      )}
                      {p.type === "select" && (
                        <select value={(config[p.key] as string) ?? ""} onChange={(e) => updateConfig(p.key, e.target.value)} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
                          <option value="">--</option>
                          {p.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                      {p.type === "text" && (
                        <Input value={(config[p.key] as string) ?? ""} onChange={(e) => updateConfig(p.key, e.target.value)} placeholder={p.hint} className="text-xs h-7" />
                      )}
                    </Field>
                  ))}
                </div>
              </>
            )
          })()}

          {/* SQL expression */}
          <SectionTitle>Advanced SQL</SectionTitle>
          <Field label="Custom SQL expression">
            <SQLEditor
              value={(data.sqlExpression as string) ?? ""}
              onChange={(v) => updateData("sqlExpression", v)}
              minRows={4}
              compact
            />
          </Field>
        </>
      )}

      {/* ==== Code Block ==== */}
      {nodeType === "codeBlock" && (
        <>
          <SectionTitle>Code</SectionTitle>
          <Field label="Language">
            <select
              value={(data.language as string) ?? "Python"}
              onChange={(e) => updateData("language", e.target.value)}
              className="w-full h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="Python">Python</option>
              <option value="SQL">SQL</option>
              <option value="Expression">Expression</option>
            </select>
          </Field>
          <Field label="Code">
            {(data.language ?? "Python") === "SQL" ? (
              <SQLEditor
                value={(data.code as string) ?? ""}
                onChange={(v) => updateData("code", v)}
                minRows={8}
                compact
              />
            ) : (
              <textarea
                value={(data.code as string) ?? ""}
                onChange={(e) => updateData("code", e.target.value)}
                placeholder={
                  (data.language ?? "Python") === "Python"
                    ? "# Python code\nresult = process(input_df)"
                    : "$area > 1000 AND $type = 'residential'"
                }
                rows={8}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono resize-y"
              />
            )}
          </Field>

          <SectionTitle>Runtime</SectionTitle>
          <div className="flex gap-3 text-label text-muted-foreground">
            <span>Sandbox: on</span>
            <span>Timeout: 30s</span>
          </div>
        </>
      )}

      {/* ==== Branch ==== */}
      {nodeType === "branch" && (
        <>
          <SectionTitle>Condition</SectionTitle>
          <Field label="Expression">
            <Input
              value={(data.condition as string) ?? ""}
              onChange={(e) => updateData("condition", e.target.value)}
              placeholder="e.g. area > 1000 AND type = 'road'"
              className="text-xs h-8 font-mono"
            />
          </Field>
          <p className="text-label text-muted-foreground mt-1">
            Features matching the condition go to the <span className="text-emerald-600 font-semibold">true</span> output, others to <span className="text-red-500 font-semibold">false</span>.
          </p>
        </>
      )}

      {/* ==== Output ==== */}
      {nodeType === "output" && (
        <>
          <SectionTitle>Export</SectionTitle>
          <Field label="Output format">
            <select
              value={(data.format as string) ?? "gpkg"}
              onChange={(e) => updateData("format", e.target.value)}
              className="w-full h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="gpkg">GeoPackage</option>
              <option value="geojson">GeoJSON</option>
              <option value="shapefile">Shapefile</option>
              <option value="csv">CSV</option>
              <option value="postgis">PostGIS table</option>
            </select>
          </Field>
          <Field label="Output path / table">
            <Input
              value={(data.outputPath as string) ?? ""}
              onChange={(e) => updateData("outputPath", e.target.value)}
              placeholder="output.gpkg or schema.table"
              className="text-xs h-7"
            />
          </Field>
        </>
      )}

      {/* ==== TableSource (ops) ==== */}
      {nodeType === "tableSource" && (
        <>
          <SectionTitle>Table Source</SectionTitle>
          <Field label="Schema">
            <Input value={(data.schema as string) ?? ""} onChange={(e) => updateData("schema", e.target.value)} placeholder="public" className="text-xs h-7 font-mono" />
          </Field>
          <Field label="Table">
            <Input value={(data.table as string) ?? ""} onChange={(e) => updateData("table", e.target.value)} placeholder="table_name" className="text-xs h-7 font-mono" />
          </Field>
          <Field label="Event type">
            <select value={(data.eventType as string) ?? "INSERT"} onChange={(e) => updateData("eventType", e.target.value)} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="INSERT,UPDATE">INSERT + UPDATE</option>
              <option value="*">All events</option>
            </select>
          </Field>
          <Field label="Filter expression">
            <Input value={(data.filter as string) ?? ""} onChange={(e) => updateData("filter", e.target.value)} placeholder="column = 'value'" className="text-xs h-7 font-mono" />
          </Field>
        </>
      )}

      {/* ==== SpatialOp (ops) ==== */}
      {nodeType === "spatialOp" && (
        <>
          <SectionTitle>Spatial Operation</SectionTitle>
          <Field label="Operation">
            <select value={(data.operation as string) ?? "intersects"} onChange={(e) => updateData("operation", e.target.value)} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
              <option value="intersects">Intersects</option>
              <option value="within">Within</option>
              <option value="contains">Contains</option>
              <option value="buffer">Buffer</option>
              <option value="nearest">Nearest</option>
              <option value="distance">Distance</option>
            </select>
          </Field>
          <Field label="Distant table">
            <Input value={(data.distantTable as string) ?? ""} onChange={(e) => updateData("distantTable", e.target.value)} placeholder="schema.table" className="text-xs h-7 font-mono" />
          </Field>
          {((data.operation as string) === "buffer" || (data.operation as string) === "distance") && (
            <Field label="Distance (m)">
              <Input type="number" value={(data.distance as number) ?? ""} onChange={(e) => updateData("distance", e.target.value ? Number(e.target.value) : "")} placeholder="100" className="text-xs h-7" />
            </Field>
          )}
        </>
      )}

      {/* ==== Aggregate (ops) ==== */}
      {nodeType === "aggregate" && (() => {
        const op = (data.operation as string) ?? "count_st_contains"
        const aggFn = op.startsWith("string_agg") ? "string_agg" : op.startsWith("sum") ? "sum" : "count"
        const predicate = op.replace(/^(string_agg|sum|count)_/, "")
        const setAggOp = (fn: string, pred: string) => {
          const newOp = `${fn}_${pred}`
          updateData("operation", newOp)
          const fnLabel = fn === "string_agg" ? "STRING_AGG" : fn.toUpperCase()
          const predLabel = pred === "st_contains" ? "ST_Contains" : pred === "st_within" ? "ST_Within" : "ST_Intersects"
          updateData("label", `${fnLabel} ${predLabel}`)
        }
        return (
          <>
            <SectionTitle>Aggregate</SectionTitle>
            <Field label="Function">
              <select value={aggFn} onChange={(e) => setAggOp(e.target.value, predicate)} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
                <option value="count">COUNT</option>
                <option value="sum">SUM</option>
                <option value="string_agg">STRING_AGG</option>
              </select>
            </Field>
            <Field label="Spatial predicate">
              <select value={predicate} onChange={(e) => setAggOp(aggFn, e.target.value)} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
                <option value="st_contains">ST_Contains</option>
                <option value="st_within">ST_Within</option>
                <option value="st_intersects">ST_Intersects</option>
              </select>
            </Field>
            {(aggFn === "sum" || aggFn === "string_agg") && (
              <Field label="Source field">
                <Input value={(data.sourceField as string) ?? ""} onChange={(e) => updateData("sourceField", e.target.value)} placeholder={aggFn === "sum" ? "e.g. length_m" : "e.g. name"} className="text-xs h-7 font-mono" />
              </Field>
            )}
            <SectionTitle>Target</SectionTitle>
            <Field label="Distant schema">
              <Input value={(data.distantSchema as string) ?? ""} onChange={(e) => updateData("distantSchema", e.target.value)} placeholder="public" className="text-xs h-7 font-mono" />
            </Field>
            <Field label="Distant table">
              <Input value={(data.distantTable as string) ?? ""} onChange={(e) => updateData("distantTable", e.target.value)} placeholder="table_name" className="text-xs h-7 font-mono" />
            </Field>
            <Field label="Distant field">
              <Input value={(data.distantField as string) ?? ""} onChange={(e) => updateData("distantField", e.target.value)} placeholder="column_name" className="text-xs h-7 font-mono" />
            </Field>
            <SectionTitle>Filters</SectionTitle>
            <Field label="Source filter">
              <Input value={(data.filter as string) ?? ""} onChange={(e) => updateData("filter", e.target.value)} placeholder="WHERE clause on source" className="text-xs h-7 font-mono" />
            </Field>
            <Field label="Target filter">
              <Input value={(data.distantFilter as string) ?? ""} onChange={(e) => updateData("distantFilter", e.target.value)} placeholder="WHERE clause on target" className="text-xs h-7 font-mono" />
            </Field>
            <Field label="Order">
              <Input type="number" value={(data.order as number) ?? ""} onChange={(e) => updateData("order", e.target.value ? Number(e.target.value) : undefined)} placeholder="execution order" className="text-xs h-7" />
            </Field>
          </>
        )
      })()}

      {/* ==== Target (ops) ==== */}
      {nodeType === "target" && (
        <>
          <SectionTitle>Target</SectionTitle>
          <Field label="Schema">
            <Input value={(data.distantSchema as string) ?? ""} onChange={(e) => updateData("distantSchema", e.target.value)} placeholder="public" className="text-xs h-7 font-mono" />
          </Field>
          <Field label="Table">
            <Input value={(data.distantTable as string) ?? ""} onChange={(e) => updateData("distantTable", e.target.value)} placeholder="table_name" className="text-xs h-7 font-mono" />
          </Field>
          <Field label="Target field">
            <Input value={(data.distantField as string) ?? ""} onChange={(e) => updateData("distantField", e.target.value)} placeholder="column_name" className="text-xs h-7 font-mono" />
          </Field>
          <Field label="Filter">
            <Input value={(data.distantFilter as string) ?? ""} onChange={(e) => updateData("distantFilter", e.target.value)} placeholder="WHERE clause" className="text-xs h-7 font-mono" />
          </Field>
        </>
      )}

      {/* ==== Validation (ops) ==== */}
      {nodeType === "validation" && (() => {
        const rules = (Array.isArray(data.rules) ? data.rules : []) as Array<{ type: string; config: Record<string, unknown>; onFail: string }>
        const updateRules = (newRules: typeof rules) => updateData("rules", newRules)
        const updateRule = (idx: number, patch: Partial<typeof rules[number]>) => {
          const next = rules.map((r, i) => i === idx ? { ...r, ...patch } : r)
          updateRules(next)
        }
        const updateRuleConfig = (idx: number, key: string, value: unknown) => {
          const next = rules.map((r, i) => i === idx ? { ...r, config: { ...r.config, [key]: value } } : r)
          updateRules(next)
        }
        const addRule = () => updateRules([...rules, { type: "not_null", config: {}, onFail: "warn" }])
        const removeRule = (idx: number) => updateRules(rules.filter((_, i) => i !== idx))

        return (
          <>
            <SectionTitle>Validation Rules ({rules.length})</SectionTitle>
            {rules.map((rule, idx) => (
              <div key={idx} className="border rounded-md p-2 mb-2 space-y-1.5 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-label font-semibold text-muted-foreground">Rule {idx + 1}</span>
                  <button type="button" onClick={() => removeRule(idx)} className="text-destructive text-label hover:underline">Remove</button>
                </div>
                <Field label="Type">
                  <select value={rule.type ?? "not_null"} onChange={(e) => updateRule(idx, { type: e.target.value, config: {} })} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
                    <option value="not_null">Not Null</option>
                    <option value="unique">Unique</option>
                    <option value="range">Range</option>
                    <option value="regex">Regex</option>
                    <option value="foreign_key">Foreign Key</option>
                    <option value="custom_sql">Custom SQL</option>
                    <option value="geometry_valid">Geometry Valid</option>
                    <option value="srid_check">SRID Check</option>
                    <option value="bbox_bounds">Bbox Bounds</option>
                  </select>
                </Field>
                {(rule.type === "not_null" || rule.type === "unique" || rule.type === "range" || rule.type === "regex" || rule.type === "foreign_key") && (
                  <Field label="Field">
                    <Input value={(rule.config.field as string) ?? ""} onChange={(e) => updateRuleConfig(idx, "field", e.target.value)} placeholder="column_name" className="text-xs h-7 font-mono" />
                  </Field>
                )}
                {rule.type === "range" && (
                  <>
                    <Field label="Min value">
                      <Input type="number" value={(rule.config.min as number) ?? ""} onChange={(e) => updateRuleConfig(idx, "min", e.target.value ? Number(e.target.value) : "")} className="text-xs h-7" />
                    </Field>
                    <Field label="Max value">
                      <Input type="number" value={(rule.config.max as number) ?? ""} onChange={(e) => updateRuleConfig(idx, "max", e.target.value ? Number(e.target.value) : "")} className="text-xs h-7" />
                    </Field>
                  </>
                )}
                {rule.type === "regex" && (
                  <Field label="Pattern">
                    <Input value={(rule.config.pattern as string) ?? ""} onChange={(e) => updateRuleConfig(idx, "pattern", e.target.value)} placeholder="^[A-Z]{2}\d+$" className="text-xs h-7 font-mono" />
                  </Field>
                )}
                {rule.type === "foreign_key" && (
                  <>
                    <Field label="Reference table">
                      <Input value={(rule.config.ref_table as string) ?? ""} onChange={(e) => updateRuleConfig(idx, "ref_table", e.target.value)} placeholder="schema.table" className="text-xs h-7 font-mono" />
                    </Field>
                    <Field label="Reference field">
                      <Input value={(rule.config.ref_field as string) ?? ""} onChange={(e) => updateRuleConfig(idx, "ref_field", e.target.value)} placeholder="column" className="text-xs h-7 font-mono" />
                    </Field>
                  </>
                )}
                {rule.type === "srid_check" && (
                  <Field label="Expected SRID">
                    <Input type="number" value={(rule.config.expected_srid as number) ?? ""} onChange={(e) => updateRuleConfig(idx, "expected_srid", e.target.value ? Number(e.target.value) : "")} placeholder="4326" className="text-xs h-7" />
                  </Field>
                )}
                {rule.type === "custom_sql" && (
                  <Field label="SQL expression">
                    <SQLEditor value={(rule.config.expression as string) ?? ""} onChange={(v) => updateRuleConfig(idx, "expression", v)} minRows={3} compact />
                  </Field>
                )}
                <Field label="On fail">
                  <select value={rule.onFail ?? "warn"} onChange={(e) => updateRule(idx, { onFail: e.target.value })} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
                    <option value="warn">Warn only</option>
                    <option value="block">Block record</option>
                    <option value="tag">Tag record</option>
                  </select>
                </Field>
              </div>
            ))}
            <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={addRule}>
              + Add validation rule
            </Button>
          </>
        )
      })()}

      {/* ==== BusinessRule (ops) ==== */}
      {nodeType === "businessRule" && (
        <>
          <SectionTitle>Business Rule</SectionTitle>
          <Field label="Condition">
            <Input value={(data.condition as string) ?? ""} onChange={(e) => updateData("condition", e.target.value)} placeholder="area > 1000 AND type = 'residential'" className="text-xs h-7 font-mono" />
          </Field>
          <Field label="Phase">
            <select value={(data.phase as string) ?? "before"} onChange={(e) => updateData("phase", e.target.value)} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
              <option value="before">Before insert/update</option>
              <option value="after">After insert/update</option>
              <option value="validate">Validate only</option>
            </select>
          </Field>
          <Field label="Dependencies">
            <Input value={(Array.isArray(data.dependencies) ? (data.dependencies as string[]).join(", ") : (data.dependencies as string) ?? "")} onChange={(e) => updateData("dependencies", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="rule_id_1, rule_id_2" className="text-xs h-7 font-mono" />
          </Field>
        </>
      )}

      {/* ==== Composite (ops) ==== */}
      {nodeType === "composite" && (() => {
        const ops = (Array.isArray(data.ops) ? data.ops : []) as string[]
        return (
          <>
            <SectionTitle>Composite</SectionTitle>
            <Field label="Sub-operations">
              <textarea
                value={ops.join("\n")}
                onChange={(e) => updateData("ops", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                placeholder={"op1\nop2\nop3"}
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono resize-y"
              />
            </Field>
            <Field label="Execution mode">
              <select value={(data.execMode as string) ?? "sequential"} onChange={(e) => updateData("execMode", e.target.value)} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
                <option value="sequential">Sequential</option>
                <option value="parallel">Parallel</option>
              </select>
            </Field>
          </>
        )
      })()}

      {/* ==== CustomExpression (ops) ==== */}
      {nodeType === "customExpression" && (
        <>
          <SectionTitle>Custom SQL Expression</SectionTitle>
          <Field label="SQL">
            <SQLEditor
              value={(data.sql as string) ?? ""}
              onChange={(v) => updateData("sql", v)}
              minRows={6}
              compact
            />
          </Field>
          <Field label="Output alias">
            <Input value={(data.outputAlias as string) ?? ""} onChange={(e) => updateData("outputAlias", e.target.value)} placeholder="result_column" className="text-xs h-7 font-mono" />
          </Field>
        </>
      )}
    </div>
  )
}
