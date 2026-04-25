/** Editor-related types for the Rule Editor modal. */

export type { Rule } from "@/types/project"
export type { CapabilitySchema } from "@/types/dataset"

/** JSON Schema property definition (simplified subset we handle). */
export interface JsonSchemaProperty {
  type?: string
  description?: string
  default?: unknown
  enum?: unknown[]
  minimum?: number
  maximum?: number
}

/** JSON Schema object we receive from capabilities. */
export interface JsonSchema {
  type?: string
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

// ---------------------------------------------------------------------------
// Predicate Builder types (issue #39)
// ---------------------------------------------------------------------------

export type AttrOp = "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "like"
export type GeomOp =
  | "intersects"
  | "within"
  | "contains"
  | "crosses"
  | "overlaps"
  | "touches"
  | "distance_lt"
  | "distance_gt"

export interface AttrPredicate {
  type: "attr"
  field: string
  op: AttrOp
  value: unknown
}

export type AggregateFunction = "count" | "sum" | "avg" | "min" | "max"

export interface GeomPredicate {
  type: "geom"
  op: GeomOp
  ref_table: string
  ref_geom_col: string
  /** Column from the remote table to aggregate or retrieve */
  ref_column?: string
  /** Aggregation function to apply on ref_column of matched remote features */
  aggregate_fn?: AggregateFunction
  /** Operator to compare aggregate result (used with aggregate_value) */
  aggregate_op?: "gt" | "lt" | "gte" | "lte" | "eq" | "neq"
  /** Threshold value to compare aggregate result against */
  aggregate_value?: number
  distance?: number
  buffer_m?: number
  ref_filter?: string
}

export interface CompoundPredicate {
  type: "compound"
  logic: "AND" | "OR" | "NOT"
  predicates: AnyPredicate[]
}

export type AnyPredicate =
  | AttrPredicate
  | GeomPredicate
  | CompoundPredicate

// ---------------------------------------------------------------------------
// Trigger Builder types (issue #38)
// ---------------------------------------------------------------------------

// --- Trigger types (full taxonomy) ---

export type TriggerType =
  // Data triggers
  | "dml"
  | "threshold"
  | "composite"
  // Temporal triggers
  | "schedule"
  // Business rule triggers
  | "validation"
  | "business_rule"
  // Constraint triggers
  | "topology"
  | "spatial_constraint"
  // Integration triggers
  | "api"
  | "esb_event"
  | "webhook_in"

export type TriggerCategory = "data" | "temporal" | "business_rule" | "constraint" | "integration"

export type TriggerSeverity = "info" | "warning" | "error" | "critical"

export type DmlEvent = "INSERT" | "UPDATE" | "DELETE"

export type ThresholdOperator = "gt" | "lt" | "gte" | "lte" | "eq" | "neq"

export type TopologyCheck =
  | "no_overlap"
  | "no_gap"
  | "must_not_cross"
  | "must_be_connected"
  | "must_be_inside"
  | "must_not_overlap_with"

export type ValidationRule =
  | "not_null"
  | "unique"
  | "range"
  | "format"
  | "enum"
  | "geometry_valid"
  | "crs_match"

// --- Forge-style declarative trigger operations ---

export type TriggerPhase = "before" | "after"

export type SpatialOperation =
  // BEFORE: local calculations (set field on current row)
  | "st_within"              // Find parent zone via ST_Within
  | "st_contains"            // Find contained features
  | "st_intersects"          // Find intersecting features
  | "st_nearest"             // Find nearest feature (ST_DWithin)
  | "st_length"              // Calculate geometry length
  | "st_area"                // Calculate geometry area
  | "st_dwithin_startpoint"  // Find nearest node to start point
  | "st_dwithin_endpoint"    // Find nearest node to end point
  | "centroid"               // Calculate centroid
  // AFTER: propagation to distant table (update aggregate)
  | "count_st_contains"      // Count features contained in distant
  | "sum_st_contains"        // Sum field of contained features
  | "count_st_within"        // Count features within distant
  | "sum_st_within"          // Sum field of features within
  | "count_st_intersects"    // Count intersecting features
  | "sum_st_intersects"      // Sum field of intersecting features
  | "string_agg_st_intersects" // String aggregation of intersecting
  | "custom_expression"      // Arbitrary SQL expression

export interface TriggerOperation {
  /** Source table schema.table */
  schema: string
  table: string
  /** Field to compute / update */
  field: string
  /** BEFORE = inline before DML, AFTER = after DML commit */
  phase: TriggerPhase
  /** Spatial operation to perform */
  operation: SpatialOperation
  /** DML event(s) that trigger this operation */
  event: string // "INSERT" | "UPDATE" | "INSERT,UPDATE"
  /** Distant table (for AFTER operations: table to update) */
  distant_schema?: string
  distant_table?: string
  distant_field?: string
  distant_filter?: string
  /** Source filter (WHERE clause on source rows) */
  filter?: string
  /** Execution order (for multi-operation chains) */
  order?: number
  /** Coalesce: skip if field is already non-null */
  coalesce?: boolean
  /** Custom SQL expression (for custom_expression type) */
  custom_expression?: string
  /** Whether this operation is enabled */
  enabled: boolean
}

export interface TriggerAction {
  type:
    | "notify"
    | "set_field"
    | "run_job"
    | "webhook"
    | "log_event"
    | "send_email"
    | "approve"
    | "reject"
    | "flag_feature"
    | "block_commit"
    | "run_sql"
    | "run_graph"
    | "update_aggregate"
    | "enqueue"
  config: Record<string, unknown>
}
