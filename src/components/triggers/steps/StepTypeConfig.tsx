import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  HardDrive, TrendingUp, GitMerge, Timer, CheckSquare,
  Scale, Map, Ruler, Globe, Radio, Webhook, Plus, Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type {
  ThresholdOperator, TopologyCheck, ValidationRule,
} from "@/types/editor"
import {
  TRIGGER_CATEGORIES, TRIGGER_TYPES, DML_EVENTS, THRESHOLD_OPS,
  TOPOLOGY_CHECKS, VALIDATION_RULES,
} from "../constants"
import { ConfigSection, ToggleChip, LayerSelect } from "../shared"
import { CronBuilder } from "../CronBuilder"
import type { UseTriggerFormReturn } from "../hooks/useTriggerForm"

interface StepTypeConfigProps {
  form: UseTriggerFormReturn
}

export function StepTypeConfig({ form }: StepTypeConfigProps) {
  const {
    activeCategory, setActiveCategory, triggerType, setTriggerType,
    dmlTable, setDmlTable, dmlEvents, toggleDmlEvent,
    cronExpr, setCronExpr, esbChannel, setEsbChannel,
    thresholdMetric, setThresholdMetric, thresholdOp, setThresholdOp,
    thresholdValue, setThresholdValue, thresholdTable, setThresholdTable,
    topoCheck, setTopoCheck, topoTable, setTopoTable,
    topoRefTable, setTopoRefTable, topoTolerance, setTopoTolerance,
    validationRules, setValidationRules, validationTable, setValidationTable,
    spatialType, setSpatialType, spatialTable, setSpatialTable,
    spatialRefTable, setSpatialRefTable, spatialDistance, setSpatialDistance,
    businessRuleExpr, setBusinessRuleExpr, businessRuleTable, setBusinessRuleTable,
    compositeMode, setCompositeMode, compositeTriggerIds, setCompositeTriggerIds,
    webhookPath, setWebhookPath, webhookSecret, setWebhookSecret,
    triggers, triggerBuilderId, allLayers,
  } = form

  const typesForCategory = TRIGGER_TYPES.filter((t) => t.category === activeCategory)

  return (
    <div className="space-y-5">
      {/* Category pills */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</label>
        <div className="flex gap-1.5 flex-wrap">
          {TRIGGER_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.value)
                  const firstType = TRIGGER_TYPES.find((t) => t.category === cat.value)
                  if (firstType) setTriggerType(firstType.value)
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all flex items-center gap-2 ${
                  activeCategory === cat.value
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent"
                }`}
              >
                <CatIcon className={`h-3.5 w-3.5 ${activeCategory === cat.value ? "" : cat.color}`} />
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Trigger type cards */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trigger type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {typesForCategory.map((tt) => {
            const TypeIcon = tt.icon
            return (
              <button
                key={tt.value}
                type="button"
                onClick={() => setTriggerType(tt.value)}
                className={`group rounded-lg border p-3 text-left transition-all ${
                  triggerType === tt.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                    : "border-border hover:border-primary/40 hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <TypeIcon className={`h-4 w-4 shrink-0 ${triggerType === tt.value ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-xs font-semibold">{tt.label}</span>
                </div>
                <p className="text-label text-muted-foreground leading-snug">{tt.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Type-specific config */}
      <div className="border-t pt-5">
        {triggerType === "dml" && (
          <ConfigSection title="DML Configuration" icon={HardDrive}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="dml-table" className="text-xs font-medium">Table</label>
                <LayerSelect id="dml-table" value={dmlTable} onChange={setDmlTable} layers={allLayers} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Events</label>
                <div className="flex gap-2">
                  {DML_EVENTS.map((ev) => (
                    <ToggleChip key={ev} label={ev} active={dmlEvents.includes(ev)} onClick={() => toggleDmlEvent(ev)} />
                  ))}
                </div>
              </div>
            </div>
          </ConfigSection>
        )}

        {triggerType === "threshold" && (
          <ConfigSection title="Threshold Configuration" icon={TrendingUp}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="threshold-table" className="text-xs font-medium">Table</label>
                <LayerSelect id="threshold-table" value={thresholdTable} onChange={setThresholdTable} layers={allLayers} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="threshold-metric" className="text-xs font-medium">Metric</label>
                <select id="threshold-metric" value={thresholdMetric} onChange={(e) => setThresholdMetric(e.target.value)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="feature_count">Feature count</option>
                  <option value="total_area">Total area</option>
                  <option value="total_length">Total length</option>
                  <option value="avg_area">Average area</option>
                  <option value="max_value">Max field value</option>
                  <option value="min_value">Min field value</option>
                  <option value="sum_value">Sum field value</option>
                </select>
              </div>
              <div className="flex gap-3">
                <div className="space-y-1.5 w-28">
                  <label htmlFor="threshold-op" className="text-xs font-medium">Operator</label>
                  <select id="threshold-op" value={thresholdOp} onChange={(e) => setThresholdOp(e.target.value as ThresholdOperator)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                    {THRESHOLD_OPS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 flex-1">
                  <label htmlFor="threshold-value" className="text-xs font-medium">Value</label>
                  <Input id="threshold-value" type="number" value={thresholdValue} onChange={(e) => setThresholdValue(e.target.value)} className="text-sm" />
                </div>
              </div>
            </div>
          </ConfigSection>
        )}

        {triggerType === "composite" && (
          <ConfigSection title="Composite Configuration" icon={GitMerge}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Logic</label>
                <div className="flex gap-2">
                  {(["all", "any", "sequence"] as const).map((m) => (
                    <ToggleChip key={m} label={m.toUpperCase()} active={compositeMode === m} onClick={() => setCompositeMode(m)} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Child triggers</label>
                {triggers.filter((t) => t.id !== triggerBuilderId).length > 0 ? (
                  <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border p-2">
                    {triggers.filter((t) => t.id !== triggerBuilderId).map((t) => (
                      <label key={t.id} className="flex items-center gap-2.5 text-xs p-1.5 rounded-md hover:bg-accent cursor-pointer">
                        <input
                          type="checkbox"
                          checked={compositeTriggerIds.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) setCompositeTriggerIds([...compositeTriggerIds, t.id])
                            else setCompositeTriggerIds(compositeTriggerIds.filter((id) => id !== t.id))
                          }}
                          className="rounded"
                        />
                        <span className="flex-1">{t.name}</span>
                        <Badge variant="secondary" className="text-label-sm">{t.trigger_type}</Badge>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground p-3 text-center border rounded-md bg-muted/30">
                    Create other triggers first to combine them.
                  </p>
                )}
              </div>
            </div>
          </ConfigSection>
        )}

        {triggerType === "schedule" && (
          <ConfigSection title="Schedule Configuration" icon={Timer}>
            <CronBuilder value={cronExpr} onChange={setCronExpr} />
          </ConfigSection>
        )}

        {triggerType === "validation" && (
          <ConfigSection title="Validation Rules" icon={CheckSquare}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="validation-table" className="text-xs font-medium">Table</label>
                <LayerSelect id="validation-table" value={validationTable} onChange={setValidationTable} layers={allLayers} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Rules</label>
                <div className="space-y-1.5">
                  {validationRules.map((vr, idx) => (
                    <div key={idx} className="flex gap-1.5 items-center">
                      <select
                        value={vr.rule}
                        onChange={(e) => {
                          const next = [...validationRules]
                          next[idx] = { ...vr, rule: e.target.value as ValidationRule }
                          setValidationRules(next)
                        }}
                        className="h-8 rounded-md border bg-background px-2 text-xs flex-1"
                      >
                        {VALIDATION_RULES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <Input
                        value={vr.field}
                        onChange={(e) => {
                          const next = [...validationRules]
                          next[idx] = { ...vr, field: e.target.value }
                          setValidationRules(next)
                        }}
                        placeholder="field"
                        className="text-xs h-8 flex-1"
                      />
                      <button onClick={() => setValidationRules(validationRules.filter((_, i) => i !== idx))} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs w-full" onClick={() => setValidationRules([...validationRules, { rule: "not_null", field: "", config: {} }])}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add rule
                </Button>
              </div>
            </div>
          </ConfigSection>
        )}

        {triggerType === "business_rule" && (
          <ConfigSection title="Business Rule" icon={Scale}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="business-rule-table" className="text-xs font-medium">Table</label>
                <LayerSelect id="business-rule-table" value={businessRuleTable} onChange={setBusinessRuleTable} layers={allLayers} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="business-rule-expr" className="text-xs font-medium">Expression (SQL WHERE)</label>
                <textarea id="business-rule-expr" value={businessRuleExpr} onChange={(e) => setBusinessRuleExpr(e.target.value)} placeholder="e.g. status = 'approved' AND area_m2 > 100" className="w-full h-24 rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y" />
                <p className="text-label-lg text-muted-foreground">
                  SQL expression evaluated against each feature. Trigger fires when expression is FALSE (violation).
                </p>
              </div>
            </div>
          </ConfigSection>
        )}

        {triggerType === "topology" && (
          <ConfigSection title="Topology Check" icon={Map}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="topo-check-type" className="text-xs font-medium">Check type</label>
                <select id="topo-check-type" value={topoCheck} onChange={(e) => setTopoCheck(e.target.value as TopologyCheck)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                  {TOPOLOGY_CHECKS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="topo-source-table" className="text-xs font-medium">Source table</label>
                <LayerSelect id="topo-source-table" value={topoTable} onChange={setTopoTable} layers={allLayers} />
              </div>
              {["must_be_inside", "must_not_overlap_with"].includes(topoCheck) && (
                <div className="space-y-1.5">
                  <label htmlFor="topo-ref-table" className="text-xs font-medium">Reference table</label>
                  <LayerSelect id="topo-ref-table" value={topoRefTable} onChange={setTopoRefTable} layers={allLayers} />
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="topo-tolerance" className="text-xs font-medium">Tolerance</label>
                <Input id="topo-tolerance" type="number" step="0.001" value={topoTolerance} onChange={(e) => setTopoTolerance(e.target.value)} className="text-sm" />
              </div>
            </div>
          </ConfigSection>
        )}

        {triggerType === "spatial_constraint" && (
          <ConfigSection title="Spatial Constraint" icon={Ruler}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Constraint type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["min_distance", "max_distance", "must_be_within", "exclusion_zone"] as const).map((st) => (
                    <ToggleChip key={st} label={st.replace(/_/g, " ")} active={spatialType === st} onClick={() => setSpatialType(st)} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="spatial-source-table" className="text-xs font-medium">Source table</label>
                <LayerSelect id="spatial-source-table" value={spatialTable} onChange={setSpatialTable} layers={allLayers} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="spatial-ref-table" className="text-xs font-medium">Reference table</label>
                <LayerSelect id="spatial-ref-table" value={spatialRefTable} onChange={setSpatialRefTable} layers={allLayers} />
              </div>
              {["min_distance", "max_distance"].includes(spatialType) && (
                <div className="space-y-1.5">
                  <label htmlFor="spatial-distance" className="text-xs font-medium">Distance (meters)</label>
                  <Input id="spatial-distance" type="number" value={spatialDistance} onChange={(e) => setSpatialDistance(e.target.value)} className="text-sm" />
                </div>
              )}
            </div>
          </ConfigSection>
        )}

        {triggerType === "api" && (
          <ConfigSection title="API Trigger" icon={Globe}>
            <p className="text-sm text-muted-foreground">
              This trigger is fired externally via{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">POST /triggers/:id/fire</code>.
              No additional configuration needed.
            </p>
          </ConfigSection>
        )}

        {triggerType === "esb_event" && (
          <ConfigSection title="ESB Event" icon={Radio}>
            <div className="space-y-1.5">
              <label htmlFor="esb-channel" className="text-xs font-medium">Channel</label>
              <Input id="esb-channel" value={esbChannel} onChange={(e) => setEsbChannel(e.target.value)} placeholder="e.g. dataset.updated" className="text-sm" />
              <p className="text-label-lg text-muted-foreground">
                The event channel this trigger subscribes to on the ESB.
              </p>
            </div>
          </ConfigSection>
        )}

        {triggerType === "webhook_in" && (
          <ConfigSection title="Incoming Webhook" icon={Webhook}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="webhook-path" className="text-xs font-medium">Path</label>
                <Input id="webhook-path" value={webhookPath} onChange={(e) => setWebhookPath(e.target.value)} placeholder="/hooks/my-trigger" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="webhook-secret" className="text-xs font-medium">Secret (optional)</label>
                <Input id="webhook-secret" type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="HMAC secret" className="text-sm" />
              </div>
            </div>
          </ConfigSection>
        )}
      </div>
    </div>
  )
}
