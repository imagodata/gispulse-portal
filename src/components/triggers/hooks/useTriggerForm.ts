/**
 * Hook that encapsulates all form state for the TriggerBuilderModal.
 * Handles: form fields, populate on edit, reset on close, save logic.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useEditorStore } from "@/stores/editorStore"
import { useProjectStore } from "@/stores/projectStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { openEvalStream } from "@/api/client"
import type {
  TriggerType,
  TriggerCategory,
  TriggerSeverity,
  DmlEvent,
  TriggerAction,
  CompoundPredicate,
  ThresholdOperator,
  TopologyCheck,
  ValidationRule,
  TriggerOperation,
} from "@/types/editor"
import type { FiredTriggerResult } from "@/types/project"

function emptyPredicateTree(): CompoundPredicate {
  return { type: "compound", logic: "AND", predicates: [] }
}

function emptyOperation(): TriggerOperation {
  return {
    schema: "",
    table: "",
    field: "",
    phase: "before",
    operation: "st_within",
    event: "INSERT,UPDATE",
    enabled: true,
  }
}

function categoryForType(tt: TriggerType): TriggerCategory {
  const map: Record<string, TriggerCategory> = {
    dml: "data", threshold: "data", composite: "data",
    schedule: "temporal",
    validation: "business_rule", business_rule: "business_rule",
    topology: "constraint", spatial_constraint: "constraint",
    api: "integration", esb_event: "integration", webhook_in: "integration",
  }
  return map[tt] ?? "data"
}

export type UseTriggerFormReturn = ReturnType<typeof useTriggerForm>

export function useTriggerForm() {
  const { triggerBuilderOpen, triggerBuilderId, closeTriggerBuilder } = useEditorStore()
  const triggers = useProjectStore((s) => s.triggers)
  const rules = useProjectStore((s) => s.rules)
  const createTrigger = useProjectStore((s) => s.createTrigger)
  const updateTrigger = useProjectStore((s) => s.updateTrigger)
  const datasets = useDatasetStore((s) => s.datasets)

  const isEditing = triggerBuilderId !== null
  const existingTrigger = isEditing ? triggers.find((t) => t.id === triggerBuilderId) : null

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [activeCategory, setActiveCategory] = useState<TriggerCategory>("data")
  const [triggerType, setTriggerType] = useState<TriggerType>("dml")
  const [severity, setSeverity] = useState<TriggerSeverity>("info")
  const [dmlTable, setDmlTable] = useState("")
  const [dmlEvents, setDmlEvents] = useState<DmlEvent[]>(["INSERT"])
  const [cronExpr, setCronExpr] = useState("0 * * * *")
  const [esbChannel, setEsbChannel] = useState("")
  const [thresholdMetric, setThresholdMetric] = useState("feature_count")
  const [thresholdOp, setThresholdOp] = useState<ThresholdOperator>("gt")
  const [thresholdValue, setThresholdValue] = useState("100")
  const [thresholdTable, setThresholdTable] = useState("")
  const [topoCheck, setTopoCheck] = useState<TopologyCheck>("no_overlap")
  const [topoTable, setTopoTable] = useState("")
  const [topoRefTable, setTopoRefTable] = useState("")
  const [topoTolerance, setTopoTolerance] = useState("0.001")
  const [validationRules, setValidationRules] = useState<{ rule: ValidationRule; field: string; config: Record<string, unknown> }[]>([])
  const [validationTable, setValidationTable] = useState("")
  const [spatialType, setSpatialType] = useState<"min_distance" | "max_distance" | "must_be_within" | "exclusion_zone">("min_distance")
  const [spatialTable, setSpatialTable] = useState("")
  const [spatialRefTable, setSpatialRefTable] = useState("")
  const [spatialDistance, setSpatialDistance] = useState("10")
  const [businessRuleExpr, setBusinessRuleExpr] = useState("")
  const [businessRuleTable, setBusinessRuleTable] = useState("")
  const [compositeMode, setCompositeMode] = useState<"all" | "any" | "sequence">("all")
  const [compositeTriggerIds, setCompositeTriggerIds] = useState<string[]>([])
  const [operations, setOperations] = useState<TriggerOperation[]>([])
  const [webhookPath, setWebhookPath] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [ruleId, setRuleId] = useState("")
  const [predicates, setPredicates] = useState<CompoundPredicate>(emptyPredicateTree())
  const [actions, setActions] = useState<TriggerAction[]>([])
  const [autoEval, setAutoEval] = useState(false)
  const [saving, setSaving] = useState(false)
  const [evalEvents, setEvalEvents] = useState<FiredTriggerResult[]>([])
  const esRef = useRef<EventSource | null>(null)

  // SSE live feedback
  useEffect(() => {
    if (!autoEval || !isEditing || !triggerBuilderId) {
      esRef.current?.close()
      esRef.current = null
      return
    }
    if (esRef.current) return
    const es = openEvalStream(triggerBuilderId, (result) => {
      setEvalEvents((prev) => [result, ...prev].slice(0, 50))
    })
    esRef.current = es
    return () => { es.close(); esRef.current = null }
  }, [autoEval, isEditing, triggerBuilderId])

  // Derived lists
  const allLayers = useMemo(() => {
    const layers: string[] = []
    for (const ds of datasets) {
      for (const l of ds.layers ?? []) layers.push(l.name)
    }
    return layers
  }, [datasets])

  const allFields = useMemo(() => {
    const fields: string[] = []
    for (const ds of datasets) {
      for (const l of ds.layers ?? []) {
        for (const f of l.fields ?? []) {
          if (!fields.includes(f.name)) fields.push(f.name)
        }
      }
    }
    return fields
  }, [datasets])

  // Populate on open
  useEffect(() => {
    if (!triggerBuilderOpen) return
    if (existingTrigger) {
      setName(existingTrigger.name)
      setDescription(existingTrigger.description ?? "")
      const tt = (existingTrigger.trigger_type as TriggerType) || "dml"
      setTriggerType(tt)
      setActiveCategory(categoryForType(tt))
      setSeverity((existingTrigger.severity as TriggerSeverity) ?? "info")
      setRuleId(existingTrigger.rule_id ?? "")
      const cond = existingTrigger.conditions ?? {}
      setDmlTable((cond.table as string) ?? "")
      setDmlEvents((cond.events as DmlEvent[]) ?? ["INSERT"])
      setCronExpr((cond.cron as string) ?? "0 * * * *")
      setEsbChannel((cond.channel as string) ?? "")
      setThresholdMetric((cond.metric as string) ?? "feature_count")
      setThresholdOp((cond.operator as ThresholdOperator) ?? "gt")
      setThresholdValue(String(cond.threshold_value ?? "100"))
      setThresholdTable((cond.table as string) ?? "")
      setTopoCheck((cond.topo_check as TopologyCheck) ?? "no_overlap")
      setTopoTable((cond.table as string) ?? "")
      setTopoRefTable((cond.ref_table as string) ?? "")
      setTopoTolerance(String(cond.tolerance ?? "0.001"))
      setValidationRules((cond.validation_rules as typeof validationRules) ?? [])
      setValidationTable((cond.table as string) ?? "")
      setSpatialType((cond.spatial_type as typeof spatialType) ?? "min_distance")
      setSpatialTable((cond.table as string) ?? "")
      setSpatialRefTable((cond.ref_table as string) ?? "")
      setSpatialDistance(String(cond.distance ?? "10"))
      setBusinessRuleExpr((cond.expression as string) ?? "")
      setBusinessRuleTable((cond.table as string) ?? "")
      setCompositeMode((cond.composite_mode as typeof compositeMode) ?? "all")
      setCompositeTriggerIds((cond.trigger_ids as string[]) ?? [])
      setWebhookPath((cond.path as string) ?? "")
      setWebhookSecret((cond.secret as string) ?? "")
      setOperations((cond.operations as TriggerOperation[]) ?? [])
      setPredicates((cond.predicates as CompoundPredicate) ?? emptyPredicateTree())
      setActions((cond.actions as TriggerAction[]) ?? [])
      setAutoEval(existingTrigger.auto_eval ?? false)
    } else {
      // Reset all
      setName(""); setDescription(""); setActiveCategory("data"); setTriggerType("dml")
      setSeverity("info"); setDmlTable(""); setDmlEvents(["INSERT"]); setCronExpr("0 * * * *")
      setEsbChannel(""); setThresholdMetric("feature_count"); setThresholdOp("gt")
      setThresholdValue("100"); setThresholdTable(""); setTopoCheck("no_overlap")
      setTopoTable(""); setTopoRefTable(""); setTopoTolerance("0.001")
      setValidationRules([]); setValidationTable(""); setSpatialType("min_distance")
      setSpatialTable(""); setSpatialRefTable(""); setSpatialDistance("10")
      setBusinessRuleExpr(""); setBusinessRuleTable(""); setCompositeMode("all")
      setCompositeTriggerIds([]); setWebhookPath(""); setWebhookSecret("")
      setOperations([]); setRuleId(""); setPredicates(emptyPredicateTree())
      setActions([]); setAutoEval(false)
    }
    setEvalEvents([])
  }, [triggerBuilderOpen, existingTrigger])

  const toggleDmlEvent = useCallback((ev: DmlEvent) => {
    setDmlEvents((prev) => {
      if (prev.includes(ev)) {
        const next = prev.filter((e) => e !== ev)
        return next.length > 0 ? next : prev
      }
      return [...prev, ev]
    })
  }, [])

  const buildEvent = useCallback((): string => {
    switch (triggerType) {
      case "dml": return dmlEvents.join(",")
      case "schedule": return cronExpr
      case "api": return "api_call"
      case "esb_event": return esbChannel || "default"
      case "threshold": return "threshold_crossed"
      case "composite": return "composite"
      case "validation": return "constraint_violated"
      case "business_rule": return "constraint_violated"
      case "topology": return "constraint_violated"
      case "spatial_constraint": return "constraint_violated"
      case "webhook_in": return "webhook"
    }
  }, [triggerType, dmlEvents, cronExpr, esbChannel])

  const buildConditions = useCallback((): Record<string, unknown> => {
    const cond: Record<string, unknown> = {}
    switch (triggerType) {
      case "dml":
        cond.table = dmlTable; cond.events = dmlEvents
        if (operations.length > 0) cond.operations = operations
        break
      case "schedule": cond.cron = cronExpr; break
      case "esb_event": cond.channel = esbChannel; break
      case "threshold":
        cond.table = thresholdTable; cond.metric = thresholdMetric
        cond.operator = thresholdOp; cond.threshold_value = Number(thresholdValue)
        break
      case "topology":
        cond.table = topoTable; cond.ref_table = topoRefTable
        cond.topo_check = topoCheck; cond.tolerance = Number(topoTolerance)
        break
      case "validation":
        cond.table = validationTable; cond.validation_rules = validationRules; break
      case "spatial_constraint":
        cond.table = spatialTable; cond.ref_table = spatialRefTable
        cond.spatial_type = spatialType; cond.distance = Number(spatialDistance)
        break
      case "business_rule":
        cond.table = businessRuleTable; cond.expression = businessRuleExpr; break
      case "composite":
        cond.composite_mode = compositeMode; cond.trigger_ids = compositeTriggerIds; break
      case "webhook_in":
        cond.path = webhookPath; cond.secret = webhookSecret; break
    }
    if (predicates.predicates.length > 0) cond.predicates = predicates
    if (actions.length > 0) cond.actions = actions
    return cond
  }, [triggerType, dmlTable, dmlEvents, operations, cronExpr, esbChannel, thresholdTable, thresholdMetric, thresholdOp, thresholdValue, topoTable, topoRefTable, topoCheck, topoTolerance, validationTable, validationRules, spatialTable, spatialRefTable, spatialType, spatialDistance, businessRuleTable, businessRuleExpr, compositeMode, compositeTriggerIds, webhookPath, webhookSecret, predicates, actions])

  const canSave = name.trim() !== ""

  const handleSave = useCallback(async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        event: buildEvent(),
        trigger_type: triggerType,
        category: activeCategory,
        severity,
        rule_id: ruleId || null,
        conditions: buildConditions(),
        enabled: existingTrigger?.enabled ?? true,
        auto_eval: autoEval,
      }
      if (isEditing && triggerBuilderId) {
        await updateTrigger(triggerBuilderId, payload)
      } else {
        await createTrigger(payload)
      }
      closeTriggerBuilder()
    } catch (err) {
      console.error("Failed to save trigger:", err)
    } finally {
      setSaving(false)
    }
  }, [canSave, name, description, buildEvent, triggerType, activeCategory, severity, ruleId, buildConditions, existingTrigger, autoEval, isEditing, triggerBuilderId, updateTrigger, createTrigger, closeTriggerBuilder])

  return {
    // Meta
    isEditing, existingTrigger, triggerBuilderOpen, triggerBuilderId, closeTriggerBuilder,
    triggers, rules, datasets,
    // Form fields
    name, setName, description, setDescription,
    activeCategory, setActiveCategory, triggerType, setTriggerType, severity, setSeverity,
    // DML
    dmlTable, setDmlTable, dmlEvents, setDmlEvents, toggleDmlEvent,
    // Schedule
    cronExpr, setCronExpr,
    // ESB
    esbChannel, setEsbChannel,
    // Threshold
    thresholdMetric, setThresholdMetric, thresholdOp, setThresholdOp,
    thresholdValue, setThresholdValue, thresholdTable, setThresholdTable,
    // Topology
    topoCheck, setTopoCheck, topoTable, setTopoTable,
    topoRefTable, setTopoRefTable, topoTolerance, setTopoTolerance,
    // Validation
    validationRules, setValidationRules, validationTable, setValidationTable,
    // Spatial constraint
    spatialType, setSpatialType, spatialTable, setSpatialTable,
    spatialRefTable, setSpatialRefTable, spatialDistance, setSpatialDistance,
    // Business rule
    businessRuleExpr, setBusinessRuleExpr, businessRuleTable, setBusinessRuleTable,
    // Composite
    compositeMode, setCompositeMode, compositeTriggerIds, setCompositeTriggerIds,
    // Operations
    operations, setOperations,
    // Webhook
    webhookPath, setWebhookPath, webhookSecret, setWebhookSecret,
    // Shared
    ruleId, setRuleId, predicates, setPredicates, actions, setActions,
    autoEval, setAutoEval, saving, canSave, handleSave,
    evalEvents, setEvalEvents,
    // Derived
    allLayers, allFields,
    emptyOperation,
  }
}
