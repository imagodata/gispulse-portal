import {
  Database, Clock, BookOpen, Lock, Link2,
  HardDrive, TrendingUp, GitMerge, Timer, CheckSquare,
  Scale, Map, Ruler, Globe, Radio, Webhook,
  Info, AlertTriangle, AlertCircle, ShieldAlert,
} from "lucide-react"
import type {
  TriggerType,
  TriggerCategory,
  TriggerSeverity,
  DmlEvent,
  TriggerAction,
  ThresholdOperator,
  TopologyCheck,
  ValidationRule,
  SpatialOperation,
  TriggerOperation,
} from "@/types/editor"

// ---------------------------------------------------------------------------
// Trigger taxonomy
// ---------------------------------------------------------------------------

export interface TriggerTypeDef {
  value: TriggerType
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  category: TriggerCategory
}

export const CATEGORY_ICONS: Record<TriggerCategory, React.ComponentType<{ className?: string }>> = {
  data: Database,
  temporal: Clock,
  business_rule: BookOpen,
  constraint: Lock,
  integration: Link2,
}

export const TRIGGER_CATEGORIES: { value: TriggerCategory; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: "data", label: "Data", icon: Database, color: "text-blue-500" },
  { value: "temporal", label: "Temporal", icon: Clock, color: "text-amber-500" },
  { value: "business_rule", label: "Business Rules", icon: BookOpen, color: "text-purple-500" },
  { value: "constraint", label: "Constraints", icon: Lock, color: "text-red-500" },
  { value: "integration", label: "Integration", icon: Link2, color: "text-green-500" },
]

export const TRIGGER_TYPES: TriggerTypeDef[] = [
  { value: "dml", label: "DML", icon: HardDrive, description: "INSERT/UPDATE/DELETE on a table", category: "data" },
  { value: "threshold", label: "Threshold", icon: TrendingUp, description: "Metric crosses a threshold", category: "data" },
  { value: "composite", label: "Composite", icon: GitMerge, description: "Combine multiple triggers", category: "data" },
  { value: "schedule", label: "Schedule", icon: Timer, description: "Cron-based time trigger", category: "temporal" },
  { value: "validation", label: "Validation", icon: CheckSquare, description: "Data quality checks", category: "business_rule" },
  { value: "business_rule", label: "Business Rule", icon: Scale, description: "Domain-specific rules", category: "business_rule" },
  { value: "topology", label: "Topology", icon: Map, description: "Topological integrity checks", category: "constraint" },
  { value: "spatial_constraint", label: "Spatial", icon: Ruler, description: "Distance, zone, buffer rules", category: "constraint" },
  { value: "api", label: "API", icon: Globe, description: "External HTTP trigger", category: "integration" },
  { value: "esb_event", label: "ESB Event", icon: Radio, description: "Internal event bus", category: "integration" },
  { value: "webhook_in", label: "Webhook In", icon: Webhook, description: "Incoming webhook", category: "integration" },
]

export const SEVERITY_LEVELS: { value: TriggerSeverity; label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }[] = [
  { value: "info", label: "Info", icon: Info, color: "text-blue-500", bg: "bg-blue-500" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500" },
  { value: "error", label: "Error", icon: AlertCircle, color: "text-red-500", bg: "bg-red-500" },
  { value: "critical", label: "Critical", icon: ShieldAlert, color: "text-red-700", bg: "bg-red-700" },
]

export const DML_EVENTS: DmlEvent[] = ["INSERT", "UPDATE", "DELETE"]

export const THRESHOLD_OPS: { value: ThresholdOperator; label: string }[] = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
]

export const TOPOLOGY_CHECKS: { value: TopologyCheck; label: string }[] = [
  { value: "no_overlap", label: "No Overlap" },
  { value: "no_gap", label: "No Gap" },
  { value: "must_not_cross", label: "Must Not Cross" },
  { value: "must_be_connected", label: "Must Be Connected" },
  { value: "must_be_inside", label: "Must Be Inside" },
  { value: "must_not_overlap_with", label: "Must Not Overlap With" },
]

export const VALIDATION_RULES: { value: ValidationRule; label: string }[] = [
  { value: "not_null", label: "Not Null" },
  { value: "unique", label: "Unique" },
  { value: "range", label: "Value Range" },
  { value: "format", label: "Format / Regex" },
  { value: "enum", label: "Allowed Values" },
  { value: "geometry_valid", label: "Valid Geometry" },
  { value: "crs_match", label: "CRS Match" },
]

export const ACTION_TYPES: { value: TriggerAction["type"]; label: string; category: string; disabled?: boolean }[] = [
  { value: "notify", label: "Notify", category: "notification" },
  { value: "send_email", label: "Send Email (coming soon)", category: "notification", disabled: true },
  { value: "log_event", label: "Log Event", category: "notification" },
  { value: "set_field", label: "Set Field", category: "mutation" },
  { value: "flag_feature", label: "Flag Feature (coming soon)", category: "mutation", disabled: true },
  { value: "update_aggregate", label: "Update Aggregate", category: "mutation" },
  { value: "run_sql", label: "Run SQL (coming soon)", category: "mutation", disabled: true },
  { value: "run_job", label: "Run Job", category: "execution" },
  { value: "run_graph", label: "Run Graph", category: "execution" },
  { value: "enqueue", label: "Enqueue", category: "execution" },
  { value: "approve", label: "Approve (coming soon)", category: "workflow", disabled: true },
  { value: "reject", label: "Reject (coming soon)", category: "workflow", disabled: true },
  { value: "block_commit", label: "Block Commit (coming soon)", category: "workflow", disabled: true },
  { value: "webhook", label: "Webhook", category: "external" },
]

export const SPATIAL_OPS_BEFORE: { value: SpatialOperation; label: string; description: string }[] = [
  { value: "st_within", label: "ST_Within", description: "Find parent zone" },
  { value: "st_contains", label: "ST_Contains", description: "Find contained features" },
  { value: "st_intersects", label: "ST_Intersects", description: "Find intersecting features" },
  { value: "st_nearest", label: "ST_Nearest", description: "Find nearest feature" },
  { value: "st_length", label: "ST_Length", description: "Calculate geometry length" },
  { value: "st_area", label: "ST_Area", description: "Calculate geometry area" },
  { value: "st_dwithin_startpoint", label: "DWithin Start", description: "Nearest node to start point" },
  { value: "st_dwithin_endpoint", label: "DWithin End", description: "Nearest node to end point" },
  { value: "centroid", label: "Centroid", description: "Calculate centroid" },
  { value: "custom_expression", label: "Custom SQL", description: "Arbitrary SQL expression" },
]

export const SPATIAL_OPS_AFTER: { value: SpatialOperation; label: string; description: string }[] = [
  { value: "count_st_contains", label: "COUNT Contains", description: "Count contained features in distant table" },
  { value: "sum_st_contains", label: "SUM Contains", description: "Sum field of contained features" },
  { value: "count_st_within", label: "COUNT Within", description: "Count features within distant" },
  { value: "sum_st_within", label: "SUM Within", description: "Sum field of features within" },
  { value: "count_st_intersects", label: "COUNT Intersects", description: "Count intersecting features" },
  { value: "sum_st_intersects", label: "SUM Intersects", description: "Sum field of intersecting features" },
  { value: "string_agg_st_intersects", label: "String Agg", description: "Concatenate values of intersecting" },
  { value: "custom_expression", label: "Custom SQL", description: "Arbitrary SQL expression" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function emptyOperation(): TriggerOperation {
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

export function categoryForType(tt: TriggerType): TriggerCategory {
  return TRIGGER_TYPES.find((t) => t.value === tt)?.category ?? "data"
}
