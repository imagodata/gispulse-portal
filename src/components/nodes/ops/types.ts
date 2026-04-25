/**
 * Trigger operation node types and constants.
 * Maps directly to the ESB trigger_operations table schema.
 */

import type { SpatialOperation, TriggerPhase } from "@/types/editor"

// ---------------------------------------------------------------------------
// Node categories (extend NodeCategory for palette)
// ---------------------------------------------------------------------------

export type OpsNodeType =
  | "tableSource"
  | "spatialOp"
  | "aggregate"
  | "target"
  | "customExpression"
  | "validation"
  | "businessRule"

// ---------------------------------------------------------------------------
// Operations grouped by category for the palette
// ---------------------------------------------------------------------------

export interface SpatialOpDef {
  operation: SpatialOperation
  label: string
  description: string
  phase: TriggerPhase
  /** Whether this op needs a distant table reference */
  needsDistant: boolean
  /** Whether this op produces a scalar value (vs FK reference) */
  producesScalar: boolean
  /** For polymorphic ops: supports UNION of multiple source tables */
  supportsMultiSource?: boolean
}

export const SPATIAL_OPS: SpatialOpDef[] = [
  // BEFORE — local calculations on NEW row
  { operation: "st_within",             label: "ST_Within",             description: "Find parent zone (FK spatiale)", phase: "before", needsDistant: true, producesScalar: false },
  { operation: "st_contains",           label: "ST_Contains",           description: "Find contained features",       phase: "before", needsDistant: true, producesScalar: false },
  { operation: "st_intersects",         label: "ST_Intersects",         description: "Find intersecting features",    phase: "before", needsDistant: true, producesScalar: false },
  { operation: "st_nearest",            label: "ST_Nearest",            description: "Find nearest feature",          phase: "before", needsDistant: true, producesScalar: false },
  { operation: "st_length",             label: "ST_Length",             description: "Calculate geometry length",      phase: "before", needsDistant: false, producesScalar: true },
  { operation: "st_area",               label: "ST_Area",               description: "Calculate geometry area",        phase: "before", needsDistant: false, producesScalar: true },
  { operation: "centroid",              label: "Centroid",              description: "Calculate centroid point",       phase: "before", needsDistant: false, producesScalar: true },
  { operation: "st_dwithin_startpoint", label: "ST_DWithin Start",      description: "Nearest to line start point",   phase: "before", needsDistant: true, producesScalar: false, supportsMultiSource: true },
  { operation: "st_dwithin_endpoint",   label: "ST_DWithin End",        description: "Nearest to line end point",     phase: "before", needsDistant: true, producesScalar: false, supportsMultiSource: true },
]

export const AGGREGATE_OPS: SpatialOpDef[] = [
  // AFTER — propagation to distant table
  { operation: "count_st_contains",       label: "COUNT ST_Contains",       description: "Count features contained in zone",     phase: "after", needsDistant: true, producesScalar: true },
  { operation: "sum_st_contains",         label: "SUM ST_Contains",         description: "Sum field of contained features",      phase: "after", needsDistant: true, producesScalar: true },
  { operation: "count_st_within",         label: "COUNT ST_Within",         description: "Count features within zone",           phase: "after", needsDistant: true, producesScalar: true },
  { operation: "sum_st_within",           label: "SUM ST_Within",           description: "Sum field of features within",         phase: "after", needsDistant: true, producesScalar: true },
  { operation: "count_st_intersects",     label: "COUNT ST_Intersects",     description: "Count intersecting features",          phase: "after", needsDistant: true, producesScalar: true },
  { operation: "sum_st_intersects",       label: "SUM ST_Intersects",       description: "Sum field of intersecting features",   phase: "after", needsDistant: true, producesScalar: true },
  { operation: "string_agg_st_intersects",label: "STRING_AGG Intersects",   description: "Concatenate intersecting feature names",phase: "after", needsDistant: true, producesScalar: true },
]

// ---------------------------------------------------------------------------
// Validation rule types
// ---------------------------------------------------------------------------

export type ValidationRuleType =
  | "geometry_valid" | "srid_check" | "bbox_bounds"
  | "not_null" | "unique" | "enum" | "range" | "regex"
  | "foreign_key" | "min_length" | "max_length" | "min_area" | "max_area"

export interface ValidationRuleDef {
  type: ValidationRuleType
  label: string
  description: string
  /** Config fields needed */
  configFields: string[]
}

export const VALIDATION_RULES: ValidationRuleDef[] = [
  { type: "geometry_valid", label: "Geometry Valid",  description: "ST_IsValid(geom)",          configFields: [] },
  { type: "srid_check",    label: "SRID Check",      description: "Verify CRS matches",        configFields: ["expected_srid"] },
  { type: "bbox_bounds",   label: "Bbox Bounds",     description: "Geometry within bbox",       configFields: ["min_x", "min_y", "max_x", "max_y"] },
  { type: "not_null",      label: "Not Null",        description: "Field must not be null",     configFields: ["field"] },
  { type: "unique",        label: "Unique",          description: "No duplicates on field",     configFields: ["field"] },
  { type: "enum",          label: "Enum",            description: "Value in allowed list",      configFields: ["field", "values"] },
  { type: "range",         label: "Range",           description: "Numeric in [min, max]",      configFields: ["field", "min", "max"] },
  { type: "regex",         label: "Regex",           description: "String matches pattern",     configFields: ["field", "pattern"] },
  { type: "foreign_key",   label: "Foreign Key",     description: "Value exists in other table", configFields: ["field", "ref_table", "ref_field"] },
  { type: "min_length",    label: "Min Length",       description: "Geometry length >= min",     configFields: ["min"] },
  { type: "max_length",    label: "Max Length",       description: "Geometry length <= max",     configFields: ["max"] },
  { type: "min_area",      label: "Min Area",         description: "Polygon area >= min",        configFields: ["min"] },
  { type: "max_area",      label: "Max Area",         description: "Polygon area <= max",        configFields: ["max"] },
]

// ---------------------------------------------------------------------------
// Node data interfaces (stored in ReactFlow node.data)
// ---------------------------------------------------------------------------

/** Base fields shared by all node data. */
export interface BaseNodeData {
  label: string
  status?: import("@/stores/editorStore").NodeExecStatus
  featureCount?: number
}

export interface TableSourceData extends BaseNodeData {
  nodeKind: "tableSource"
  schema: string
  table: string
  event: string // "INSERT" | "UPDATE" | "DELETE" | "INSERT,UPDATE"
  geometryColumn?: string
}

/** Shared base for ops nodes that target a distant table. */
export interface DistantTableRef {
  distantSchema?: string
  distantTable?: string
  distantField?: string
  distantFilter?: string
}

export interface SpatialOpData extends BaseNodeData, DistantTableRef {
  nodeKind: "spatialOp"
  operation: SpatialOperation
  phase: TriggerPhase
  field: string // target field to set
  filter?: string
  distance?: number // for ST_DWithin
  coalesce: boolean
  order?: number
  /** For polymorphic ops: multiple source tables (UNION) */
  unionSources?: Array<{ schema: string; table: string }>
}

export interface AggregateData extends BaseNodeData, DistantTableRef {
  nodeKind: "aggregate"
  operation: SpatialOperation
  phase: "after"
  /** Field on source table to aggregate */
  sourceField?: string
  /** Distant table to UPDATE */
  distantSchema: string
  distantTable: string
  distantField: string // field to update on distant table
  filter?: string
  order?: number
}

export interface TargetData extends BaseNodeData {
  nodeKind: "target"
  distantSchema: string
  distantTable: string
  distantField: string
  distantFilter?: string
}

export interface CustomExpressionData extends BaseNodeData {
  nodeKind: "customExpression"
  phase: TriggerPhase
  field: string
  expression: string
  order?: number
  coalesce: boolean
}

export interface ValidationData extends BaseNodeData {
  nodeKind: "validation"
  rules: Array<{
    type: ValidationRuleType
    config: Record<string, unknown>
    onFail: "block" | "warn" | "tag"
  }>
  order?: number
}

export interface BusinessRuleData extends BaseNodeData {
  nodeKind: "businessRule"
  phase: TriggerPhase
  field: string
  expression: string
  dependencies: string[] // fields that must be calculated before this
  order?: number
  coalesce: boolean
}

export type OpsNodeData =
  | TableSourceData
  | SpatialOpData
  | AggregateData
  | TargetData
  | CustomExpressionData
  | ValidationData
  | BusinessRuleData
