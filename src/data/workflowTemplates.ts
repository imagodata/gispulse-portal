/**
 * Trigger workflow templates — pre-configured node graphs for common patterns.
 *
 * Each template produces a set of ReactFlow nodes + edges that can be loaded
 * into the Workflows canvas. The user then maps placeholder table/field names
 * to their actual schema.
 *
 * Issue #172
 */

import type { Node, Edge } from "@xyflow/react"

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  domain: "ftth" | "urbanisme" | "environnement" | "transport" | "hydrologie" | "generic"
  /** Pre-built nodes (positions relative, will be offset on load) */
  nodes: Node[]
  /** Pre-built edges */
  edges: Edge[]
  /** Placeholder fields the user must map to real tables */
  placeholders: Array<{
    key: string
    label: string
    description: string
    type: "schema.table" | "field" | "number"
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _id = 0
const nid = () => `tpl-${++_id}`
const eid = (s: string, t: string) => `edge-${s}-${t}`

function mkNode(
  id: string,
  type: string,
  x: number,
  y: number,
  data: Record<string, unknown>,
): Node {
  return { id, type, position: { x, y }, data }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ── FTTH: Cable routing ─────────────────────────────────────────────
  {
    id: "ftth-cable-routing",
    name: "Cable Routing (FTTH)",
    description:
      "INSERT cable → ST_DWithin start/end points → ST_Length → ST_Within zone → cost calc → zone counters",
    domain: "ftth",
    nodes: (() => {
      const src = nid()
      const startPt = nid()
      const endPt = nid()
      const len = nid()
      const within = nid()
      const cost = nid()
      const countAgg = nid()
      const sumAgg = nid()
      const target = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "cables", schema: "infra", table: "cables", event: "INSERT,UPDATE",
        }),
        mkNode(startPt, "spatialOp", 250, 0, {
          nodeKind: "spatialOp", label: "ST_DWithin Start", operation: "st_dwithin_startpoint",
          phase: "before", field: "start_point_id", coalesce: true, distance: 50,
          unionSources: [{ schema: "infra", table: "structures" }, { schema: "ref", table: "demand_points" }],
        }),
        mkNode(endPt, "spatialOp", 250, 100, {
          nodeKind: "spatialOp", label: "ST_DWithin End", operation: "st_dwithin_endpoint",
          phase: "before", field: "end_point_id", coalesce: true, distance: 50,
          unionSources: [{ schema: "infra", table: "structures" }, { schema: "ref", table: "demand_points" }],
        }),
        mkNode(len, "spatialOp", 250, 200, {
          nodeKind: "spatialOp", label: "ST_Length", operation: "st_length",
          phase: "before", field: "length_m", coalesce: false,
        }),
        mkNode(within, "spatialOp", 500, 100, {
          nodeKind: "spatialOp", label: "ST_Within Zone", operation: "st_within",
          phase: "before", field: "zone_pop_id", coalesce: true,
          distantSchema: "ref", distantTable: "zone_pop", distantField: "geom",
        }),
        mkNode(cost, "customExpression", 500, 220, {
          nodeKind: "customExpression", label: "Calc Cost", phase: "before", field: "cost_estimate",
          expression: "($1->>'length_m')::NUMERIC * 12.5", coalesce: false,
        }),
        mkNode(countAgg, "aggregate", 750, 50, {
          nodeKind: "aggregate", label: "COUNT cables", operation: "count_st_contains",
          phase: "after", distantSchema: "ref", distantTable: "zone_pop", distantField: "total_cables",
        }),
        mkNode(sumAgg, "aggregate", 750, 150, {
          nodeKind: "aggregate", label: "SUM length", operation: "sum_st_contains",
          phase: "after", sourceField: "length_m",
          distantSchema: "ref", distantTable: "zone_pop", distantField: "total_cable_length",
        }),
        mkNode(target, "forgeTarget", 1000, 100, {
          nodeKind: "target", label: "zone_pop", distantSchema: "ref", distantTable: "zone_pop", distantField: "total_cables",
        }),
      ]
    })(),
    edges: (() => {
      // Edges are built from the node IDs above — use deterministic IDs
      const ids = Array.from({ length: 9 }, (_, i) => `tpl-${_id - 8 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[0], ids[3]), source: ids[0], target: ids[3] },
        { id: eid(ids[1], ids[4]), source: ids[1], target: ids[4] },
        { id: eid(ids[3], ids[5]), source: ids[3], target: ids[5] },
        { id: eid(ids[4], ids[6]), source: ids[4], target: ids[6] },
        { id: eid(ids[4], ids[7]), source: ids[4], target: ids[7] },
        { id: eid(ids[6], ids[8]), source: ids[6], target: ids[8] },
        { id: eid(ids[7], ids[8]), source: ids[7], target: ids[8] },
      ]
    })(),
    placeholders: [
      { key: "infra.cables", label: "Cable table", description: "Table with cable geometries", type: "schema.table" },
      { key: "ref.zone_pop", label: "Zone table", description: "Parent zone for aggregation", type: "schema.table" },
      { key: "infra.structures", label: "Structures table", description: "Point features for start/end", type: "schema.table" },
      { key: "ref.demand_points", label: "Demand points table", description: "Point features for start/end", type: "schema.table" },
      { key: "unit_cost", label: "Unit cost (€/m)", description: "Cost per meter of cable", type: "number" },
    ],
  },

  // ── FTTH: Structure placement ────────────────────────────────────────
  {
    id: "ftth-structure-placement",
    name: "Structure Placement (FTTH)",
    description: "INSERT structure → ST_Within zone → COUNT + SUM in zone",
    domain: "ftth",
    nodes: (() => {
      const src = nid()
      const within = nid()
      const countAgg = nid()
      const sumAgg = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "structures", schema: "infra", table: "structures", event: "INSERT,UPDATE",
        }),
        mkNode(within, "spatialOp", 250, 80, {
          nodeKind: "spatialOp", label: "ST_Within Zone", operation: "st_within",
          phase: "before", field: "zone_pop_id", coalesce: true,
          distantSchema: "ref", distantTable: "zone_pop", distantField: "geom",
        }),
        mkNode(countAgg, "aggregate", 500, 30, {
          nodeKind: "aggregate", label: "COUNT structures", operation: "count_st_contains",
          phase: "after", distantSchema: "ref", distantTable: "zone_pop", distantField: "total_structures",
        }),
        mkNode(sumAgg, "aggregate", 500, 130, {
          nodeKind: "aggregate", label: "SUM capacity", operation: "sum_st_contains",
          phase: "after", sourceField: "capacity",
          distantSchema: "ref", distantTable: "zone_pop", distantField: "total_capacity",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "infra.structures", label: "Structure table", description: "Point features", type: "schema.table" },
      { key: "ref.zone_pop", label: "Zone table", description: "Zone for aggregation", type: "schema.table" },
    ],
  },

  // ── Urbanisme: Parcelle classification ──────────────────────────────
  {
    id: "urbanisme-classification",
    name: "Parcelle Classification",
    description: "INSERT parcelle → ST_Area → density calc → classification",
    domain: "urbanisme",
    nodes: (() => {
      const src = nid()
      const area = nid()
      const density = nid()
      const classif = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "parcelles", schema: "public", table: "parcelles", event: "INSERT,UPDATE",
        }),
        mkNode(area, "spatialOp", 250, 80, {
          nodeKind: "spatialOp", label: "ST_Area", operation: "st_area",
          phase: "before", field: "area_m2", coalesce: false,
        }),
        mkNode(density, "customExpression", 500, 40, {
          nodeKind: "customExpression", label: "Density", phase: "before", field: "density",
          expression: "($1->>'population')::NUMERIC / NULLIF(($1->>'area_m2')::NUMERIC, 0)", coalesce: false,
        }),
        mkNode(classif, "customExpression", 500, 160, {
          nodeKind: "customExpression", label: "Classification", phase: "before", field: "classification",
          expression: "CASE WHEN ($1->>'density')::NUMERIC > 1000 THEN 'urbain' WHEN ($1->>'density')::NUMERIC > 200 THEN 'periurbain' ELSE 'rural' END",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "public.parcelles", label: "Parcelle table", description: "Polygon features with population", type: "schema.table" },
    ],
  },

  // ── Environnement: Buffer zones ─────────────────────────────────────
  {
    id: "env-risk-score",
    name: "Risk Score Composite",
    description: "INSERT zone → weighted risk score from multiple factors",
    domain: "environnement",
    nodes: (() => {
      const src = nid()
      const risk = nid()
      const valid = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "zones", schema: "public", table: "zones_risque", event: "INSERT,UPDATE",
        }),
        mkNode(valid, "validation", 250, 30, {
          nodeKind: "validation", label: "Validate", rules: [
            { type: "geometry_valid", config: {}, onFail: "block" },
            { type: "not_null", config: { field: "flood_risk" }, onFail: "warn" },
          ],
        }),
        mkNode(risk, "customExpression", 250, 140, {
          nodeKind: "customExpression", label: "Risk Score", phase: "before", field: "risk_score",
          expression: "($1->>'flood_risk')::NUMERIC * 0.4 + ($1->>'erosion_risk')::NUMERIC * 0.3 + ($1->>'fire_risk')::NUMERIC * 0.3",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 3 }, (_, i) => `tpl-${_id - 2 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
      ]
    })(),
    placeholders: [
      { key: "public.zones_risque", label: "Risk zones table", description: "Polygons with risk factors", type: "schema.table" },
    ],
  },

  // ── Generic: Simple FK spatiale + counter ───────────────────────────
  {
    id: "generic-fk-counter",
    name: "Spatial FK + Counter",
    description: "Generic: INSERT child → ST_Within parent → COUNT children in parent",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const within = nid()
      const countAgg = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "child_table", schema: "public", table: "child_table", event: "INSERT,UPDATE",
        }),
        mkNode(within, "spatialOp", 250, 80, {
          nodeKind: "spatialOp", label: "ST_Within Parent", operation: "st_within",
          phase: "before", field: "parent_id", coalesce: true,
          distantSchema: "public", distantTable: "parent_table", distantField: "geom",
        }),
        mkNode(countAgg, "aggregate", 500, 80, {
          nodeKind: "aggregate", label: "COUNT children", operation: "count_st_contains",
          phase: "after", distantSchema: "public", distantTable: "parent_table", distantField: "child_count",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 3 }, (_, i) => `tpl-${_id - 2 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
      ]
    })(),
    placeholders: [
      { key: "public.child_table", label: "Child table", description: "Features to count", type: "schema.table" },
      { key: "public.parent_table", label: "Parent table", description: "Zone receiving the count", type: "schema.table" },
    ],
  },

  // ── Generic: Nearest Feature Lookup ────────────────────────────────
  {
    id: "generic-nearest-lookup",
    name: "Nearest Feature Lookup",
    description: "INSERT → ST_Nearest → copy field from closest feature",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const nearest = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "source_table", schema: "public", table: "source_table", event: "INSERT,UPDATE",
        }),
        mkNode(nearest, "spatialOp", 280, 80, {
          nodeKind: "spatialOp", label: "ST_Nearest", operation: "st_nearest",
          phase: "before", field: "nearest_id", coalesce: true,
          distantSchema: "public", distantTable: "reference_table", distantField: "geom",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 2 }, (_, i) => `tpl-${_id - 1 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
      ]
    })(),
    placeholders: [
      { key: "public.source_table", label: "Source table", description: "Features to enrich", type: "schema.table" },
      { key: "public.reference_table", label: "Reference table", description: "Lookup nearest from here", type: "schema.table" },
    ],
  },

  // ── Generic: Multi-Zone Aggregation ────────────────────────────────
  {
    id: "generic-multi-agg",
    name: "Multi-Zone Aggregation",
    description: "INSERT child → ST_Within → COUNT + SUM + STRING_AGG on parent zone",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const within = nid()
      const countAgg = nid()
      const sumAgg = nid()
      const strAgg = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "features", schema: "public", table: "features", event: "INSERT,UPDATE",
        }),
        mkNode(within, "spatialOp", 250, 100, {
          nodeKind: "spatialOp", label: "ST_Within Zone", operation: "st_within",
          phase: "before", field: "zone_id", coalesce: true,
          distantSchema: "public", distantTable: "zones", distantField: "geom",
        }),
        mkNode(countAgg, "aggregate", 530, 20, {
          nodeKind: "aggregate", label: "COUNT", operation: "count_st_contains",
          phase: "after", distantSchema: "public", distantTable: "zones", distantField: "feature_count",
        }),
        mkNode(sumAgg, "aggregate", 530, 110, {
          nodeKind: "aggregate", label: "SUM value", operation: "sum_st_contains",
          phase: "after", sourceField: "value",
          distantSchema: "public", distantTable: "zones", distantField: "total_value",
        }),
        mkNode(strAgg, "aggregate", 530, 200, {
          nodeKind: "aggregate", label: "STRING_AGG names", operation: "string_agg_st_intersects",
          phase: "after", sourceField: "name",
          distantSchema: "public", distantTable: "zones", distantField: "feature_names",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[1], ids[4]), source: ids[1], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "public.features", label: "Feature table", description: "Child features", type: "schema.table" },
      { key: "public.zones", label: "Zone table", description: "Parent zones for aggregation", type: "schema.table" },
      { key: "value", label: "Sum field", description: "Numeric field to sum", type: "field" },
      { key: "name", label: "Concat field", description: "Text field for STRING_AGG", type: "field" },
    ],
  },

  // ── Generic: Data Quality Pipeline ─────────────────────────────────
  {
    id: "generic-data-quality",
    name: "Data Quality Pipeline",
    description: "INSERT → validate geometry + fields → classify → tag quality",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const valid = nid()
      const classify = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "data", schema: "public", table: "data", event: "INSERT,UPDATE",
        }),
        mkNode(valid, "validation", 250, 30, {
          nodeKind: "validation", label: "Quality Checks", rules: [
            { type: "geometry_valid", config: {}, onFail: "tag" },
            { type: "not_null", config: { field: "name" }, onFail: "warn" },
            { type: "srid_check", config: { expected_srid: 4326 }, onFail: "block" },
          ],
        }),
        mkNode(classify, "customExpression", 250, 160, {
          nodeKind: "customExpression", label: "Quality Tag", phase: "before", field: "quality_grade",
          expression: "CASE WHEN ST_IsValid(NEW.geom) AND NEW.name IS NOT NULL THEN 'A' WHEN ST_IsValid(NEW.geom) THEN 'B' ELSE 'C' END",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 3 }, (_, i) => `tpl-${_id - 2 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
      ]
    })(),
    placeholders: [
      { key: "public.data", label: "Data table", description: "Table to validate", type: "schema.table" },
    ],
  },

  // ── FTTH: Splice Closure ───────────────────────────────────────────
  {
    id: "ftth-splice-closure",
    name: "Splice Closure (FTTH)",
    description: "INSERT BPE → ST_Nearest cable → ST_Within zone → zone counters",
    domain: "ftth",
    nodes: (() => {
      const src = nid()
      const nearest = nid()
      const within = nid()
      const countAgg = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "bpe", schema: "infra", table: "bpe", event: "INSERT,UPDATE",
        }),
        mkNode(nearest, "spatialOp", 250, 30, {
          nodeKind: "spatialOp", label: "ST_Nearest cable", operation: "st_nearest",
          phase: "before", field: "cable_id", coalesce: true,
          distantSchema: "infra", distantTable: "cables", distantField: "geom",
        }),
        mkNode(within, "spatialOp", 250, 140, {
          nodeKind: "spatialOp", label: "ST_Within Zone", operation: "st_within",
          phase: "before", field: "zone_pop_id", coalesce: true,
          distantSchema: "ref", distantTable: "zone_pop", distantField: "geom",
        }),
        mkNode(countAgg, "aggregate", 530, 140, {
          nodeKind: "aggregate", label: "COUNT BPE", operation: "count_st_contains",
          phase: "after", distantSchema: "ref", distantTable: "zone_pop", distantField: "total_bpe",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "infra.bpe", label: "BPE table", description: "Splice closure points", type: "schema.table" },
      { key: "infra.cables", label: "Cable table", description: "Cable lines for nearest", type: "schema.table" },
      { key: "ref.zone_pop", label: "Zone table", description: "Zone for aggregation", type: "schema.table" },
    ],
  },

  // ── FTTH: Demand Point Coverage ────────────────────────────────────
  {
    id: "ftth-demand-coverage",
    name: "Demand Coverage (FTTH)",
    description: "INSERT demand point → ST_Nearest structure → distance check → coverage status",
    domain: "ftth",
    nodes: (() => {
      const src = nid()
      const nearest = nid()
      const dist = nid()
      const status = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "demand_points", schema: "ref", table: "demand_points", event: "INSERT,UPDATE",
        }),
        mkNode(nearest, "spatialOp", 270, 80, {
          nodeKind: "spatialOp", label: "ST_Nearest structure", operation: "st_nearest",
          phase: "before", field: "nearest_structure_id", coalesce: true,
          distantSchema: "infra", distantTable: "structures", distantField: "geom",
        }),
        mkNode(dist, "customExpression", 560, 30, {
          nodeKind: "customExpression", label: "Distance", phase: "before", field: "distance_to_structure",
          expression: "ST_Distance(NEW.geom, (SELECT geom FROM infra.structures WHERE id = ($1->>'nearest_structure_id')::INT))",
          coalesce: false,
        }),
        mkNode(status, "customExpression", 560, 160, {
          nodeKind: "customExpression", label: "Coverage", phase: "before", field: "coverage_status",
          expression: "CASE WHEN ($1->>'distance_to_structure')::NUMERIC <= 100 THEN 'covered' WHEN ($1->>'distance_to_structure')::NUMERIC <= 300 THEN 'near' ELSE 'uncovered' END",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "ref.demand_points", label: "Demand points", description: "Points needing coverage", type: "schema.table" },
      { key: "infra.structures", label: "Structures", description: "Infrastructure points", type: "schema.table" },
      { key: "coverage_threshold", label: "Coverage radius (m)", description: "Max distance for 'covered'", type: "number" },
    ],
  },

  // ── Urbanisme: PLU Zone Assignment ─────────────────────────────────
  {
    id: "urbanisme-plu-zone",
    name: "PLU Zone Assignment",
    description: "INSERT parcelle → ST_Within PLU zone → inherit zone rules + COS",
    domain: "urbanisme",
    nodes: (() => {
      const src = nid()
      const within = nid()
      const cos = nid()
      const countAgg = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "parcelles", schema: "public", table: "parcelles", event: "INSERT,UPDATE",
        }),
        mkNode(within, "spatialOp", 270, 80, {
          nodeKind: "spatialOp", label: "ST_Within PLU", operation: "st_within",
          phase: "before", field: "zone_plu_id", coalesce: true,
          distantSchema: "ref", distantTable: "zones_plu", distantField: "geom",
        }),
        mkNode(cos, "customExpression", 560, 30, {
          nodeKind: "customExpression", label: "COS Max", phase: "before", field: "cos_max",
          expression: "(SELECT cos_max FROM ref.zones_plu WHERE id = ($1->>'zone_plu_id')::INT)",
          coalesce: false,
        }),
        mkNode(countAgg, "aggregate", 560, 140, {
          nodeKind: "aggregate", label: "COUNT parcelles", operation: "count_st_contains",
          phase: "after", distantSchema: "ref", distantTable: "zones_plu", distantField: "nb_parcelles",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "public.parcelles", label: "Parcelle table", description: "Cadastral parcels", type: "schema.table" },
      { key: "ref.zones_plu", label: "PLU zones", description: "Urban planning zones", type: "schema.table" },
    ],
  },

  // ── Urbanisme: Building Permit Check ───────────────────────────────
  {
    id: "urbanisme-permit-check",
    name: "Building Permit Check",
    description: "INSERT batiment → ST_Area → ST_Intersects PLU → validate COS + height",
    domain: "urbanisme",
    nodes: (() => {
      const src = nid()
      const area = nid()
      const inter = nid()
      const valid = nid()
      const expr = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "batiments", schema: "public", table: "batiments", event: "INSERT",
        }),
        mkNode(area, "spatialOp", 260, 40, {
          nodeKind: "spatialOp", label: "ST_Area", operation: "st_area",
          phase: "before", field: "emprise_m2", coalesce: false,
        }),
        mkNode(inter, "spatialOp", 260, 160, {
          nodeKind: "spatialOp", label: "ST_Intersects PLU", operation: "st_intersects",
          phase: "before", field: "zone_plu_id", coalesce: true,
          distantSchema: "ref", distantTable: "zones_plu", distantField: "geom",
        }),
        mkNode(valid, "validation", 540, 30, {
          nodeKind: "validation", label: "Permit Rules", rules: [
            { type: "geometry_valid", config: {}, onFail: "block" },
            { type: "max_area", config: { max: 5000 }, onFail: "warn" },
          ],
        }),
        mkNode(expr, "customExpression", 540, 160, {
          nodeKind: "customExpression", label: "Permit Status", phase: "before", field: "permit_status",
          expression: "CASE WHEN ($1->>'emprise_m2')::NUMERIC > (SELECT emprise_max FROM ref.zones_plu WHERE id = ($1->>'zone_plu_id')::INT) THEN 'rejected' ELSE 'eligible' END",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[2], ids[4]), source: ids[2], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "public.batiments", label: "Building table", description: "Building footprints", type: "schema.table" },
      { key: "ref.zones_plu", label: "PLU zones", description: "Urban planning zones with COS rules", type: "schema.table" },
    ],
  },

  // ── Environnement: Protected Zone Check ────────────────────────────
  {
    id: "env-protected-zone",
    name: "Protected Zone Check",
    description: "INSERT feature → ST_Intersects protected areas → flag + buffer compliance",
    domain: "environnement",
    nodes: (() => {
      const src = nid()
      const inter = nid()
      const flag = nid()
      const countAgg = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "projects", schema: "public", table: "projects", event: "INSERT,UPDATE",
        }),
        mkNode(inter, "spatialOp", 270, 80, {
          nodeKind: "spatialOp", label: "ST_Intersects Protected", operation: "st_intersects",
          phase: "before", field: "protected_zone_id", coalesce: true,
          distantSchema: "ref", distantTable: "zones_protegees", distantField: "geom",
        }),
        mkNode(flag, "customExpression", 560, 30, {
          nodeKind: "customExpression", label: "Impact Flag", phase: "before", field: "impact_level",
          expression: "CASE WHEN ($1->>'protected_zone_id') IS NOT NULL THEN 'high' ELSE 'none' END",
          coalesce: false,
        }),
        mkNode(countAgg, "aggregate", 560, 140, {
          nodeKind: "aggregate", label: "COUNT projects", operation: "count_st_intersects",
          phase: "after", distantSchema: "ref", distantTable: "zones_protegees", distantField: "nb_projects",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "public.projects", label: "Projects table", description: "Features to check", type: "schema.table" },
      { key: "ref.zones_protegees", label: "Protected zones", description: "Natura 2000 / ZNIEFF / etc.", type: "schema.table" },
    ],
  },

  // ── Environnement: Water Buffer Compliance ─────────────────────────
  {
    id: "env-water-buffer",
    name: "Water Buffer Compliance",
    description: "INSERT construction → distance to water course → compliance check",
    domain: "environnement",
    nodes: (() => {
      const src = nid()
      const nearest = nid()
      const dist = nid()
      const compliance = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "constructions", schema: "public", table: "constructions", event: "INSERT",
        }),
        mkNode(nearest, "spatialOp", 270, 80, {
          nodeKind: "spatialOp", label: "ST_Nearest cours d'eau", operation: "st_nearest",
          phase: "before", field: "nearest_water_id", coalesce: true,
          distantSchema: "ref", distantTable: "cours_eau", distantField: "geom",
        }),
        mkNode(dist, "customExpression", 560, 30, {
          nodeKind: "customExpression", label: "Distance eau", phase: "before", field: "distance_eau_m",
          expression: "ST_Distance(NEW.geom, (SELECT geom FROM ref.cours_eau WHERE id = ($1->>'nearest_water_id')::INT))",
          coalesce: false,
        }),
        mkNode(compliance, "customExpression", 560, 160, {
          nodeKind: "customExpression", label: "Compliance", phase: "before", field: "buffer_compliant",
          expression: "CASE WHEN ($1->>'distance_eau_m')::NUMERIC >= 10 THEN true ELSE false END",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "public.constructions", label: "Construction table", description: "Building footprints to check", type: "schema.table" },
      { key: "ref.cours_eau", label: "Water courses", description: "Rivers/streams reference", type: "schema.table" },
      { key: "buffer_distance", label: "Min distance (m)", description: "Regulatory buffer in meters", type: "number" },
    ],
  },

  // ── Transport: Road Segment Analysis ───────────────────────────────
  {
    id: "transport-road-analysis",
    name: "Road Segment Analysis",
    description: "INSERT road → ST_Length → ST_Within zone → zone stats (length + count)",
    domain: "transport",
    nodes: (() => {
      const src = nid()
      const len = nid()
      const within = nid()
      const countAgg = nid()
      const sumAgg = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "roads", schema: "transport", table: "roads", event: "INSERT,UPDATE",
        }),
        mkNode(len, "spatialOp", 260, 40, {
          nodeKind: "spatialOp", label: "ST_Length", operation: "st_length",
          phase: "before", field: "length_m", coalesce: false,
        }),
        mkNode(within, "spatialOp", 260, 160, {
          nodeKind: "spatialOp", label: "ST_Within Commune", operation: "st_within",
          phase: "before", field: "commune_id", coalesce: true,
          distantSchema: "ref", distantTable: "communes", distantField: "geom",
        }),
        mkNode(countAgg, "aggregate", 540, 100, {
          nodeKind: "aggregate", label: "COUNT roads", operation: "count_st_contains",
          phase: "after", distantSchema: "ref", distantTable: "communes", distantField: "nb_roads",
        }),
        mkNode(sumAgg, "aggregate", 540, 200, {
          nodeKind: "aggregate", label: "SUM length", operation: "sum_st_contains",
          phase: "after", sourceField: "length_m",
          distantSchema: "ref", distantTable: "communes", distantField: "total_road_length",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
        { id: eid(ids[2], ids[4]), source: ids[2], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "transport.roads", label: "Road table", description: "Road segment geometries", type: "schema.table" },
      { key: "ref.communes", label: "Commune table", description: "Administrative zones", type: "schema.table" },
    ],
  },

  // ── Transport: Intersection Density ────────────────────────────────
  {
    id: "transport-intersection-density",
    name: "Intersection Density",
    description: "INSERT intersection → ST_Within zone → count + density calc → safety score",
    domain: "transport",
    nodes: (() => {
      const src = nid()
      const within = nid()
      const countAgg = nid()
      const density = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "intersections", schema: "transport", table: "intersections", event: "INSERT,UPDATE",
        }),
        mkNode(within, "spatialOp", 270, 80, {
          nodeKind: "spatialOp", label: "ST_Within Zone", operation: "st_within",
          phase: "before", field: "zone_id", coalesce: true,
          distantSchema: "ref", distantTable: "zones_trafic", distantField: "geom",
        }),
        mkNode(countAgg, "aggregate", 540, 30, {
          nodeKind: "aggregate", label: "COUNT intersections", operation: "count_st_contains",
          phase: "after", distantSchema: "ref", distantTable: "zones_trafic", distantField: "nb_intersections",
        }),
        mkNode(density, "customExpression", 540, 150, {
          nodeKind: "customExpression", label: "Density calc", phase: "after", field: "intersection_density",
          expression: "nb_intersections::NUMERIC / NULLIF(ST_Area(geom::geography) / 1000000, 0)",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "transport.intersections", label: "Intersection table", description: "Road intersection points", type: "schema.table" },
      { key: "ref.zones_trafic", label: "Traffic zones", description: "Analysis zones", type: "schema.table" },
    ],
  },

  // ── Hydrologie: Catchment Area ─────────────────────────────────────
  {
    id: "hydro-catchment",
    name: "Catchment Aggregation",
    description: "INSERT station → ST_Within bassin → aggregate flow + pollutant data",
    domain: "hydrologie",
    nodes: (() => {
      const src = nid()
      const within = nid()
      const countAgg = nid()
      const sumAgg = nid()
      const avg = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "stations", schema: "hydro", table: "stations_mesure", event: "INSERT,UPDATE",
        }),
        mkNode(within, "spatialOp", 270, 100, {
          nodeKind: "spatialOp", label: "ST_Within Bassin", operation: "st_within",
          phase: "before", field: "bassin_id", coalesce: true,
          distantSchema: "ref", distantTable: "bassins_versants", distantField: "geom",
        }),
        mkNode(countAgg, "aggregate", 550, 30, {
          nodeKind: "aggregate", label: "COUNT stations", operation: "count_st_contains",
          phase: "after", distantSchema: "ref", distantTable: "bassins_versants", distantField: "nb_stations",
        }),
        mkNode(sumAgg, "aggregate", 550, 120, {
          nodeKind: "aggregate", label: "SUM debit", operation: "sum_st_contains",
          phase: "after", sourceField: "debit_m3s",
          distantSchema: "ref", distantTable: "bassins_versants", distantField: "debit_total",
        }),
        mkNode(avg, "customExpression", 550, 210, {
          nodeKind: "customExpression", label: "Avg Quality", phase: "after", field: "qualite_moyenne",
          expression: "debit_total / NULLIF(nb_stations, 0)",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[1], ids[4]), source: ids[1], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "hydro.stations_mesure", label: "Stations", description: "Measurement stations", type: "schema.table" },
      { key: "ref.bassins_versants", label: "Catchments", description: "Watershed polygons", type: "schema.table" },
      { key: "debit_m3s", label: "Flow field", description: "Flow rate field (m3/s)", type: "field" },
    ],
  },

  // ── Hydrologie: Flood Risk Proximity ───────────────────────────────
  {
    id: "hydro-flood-proximity",
    name: "Flood Risk Proximity",
    description: "INSERT building → distance to flood zone → risk classification",
    domain: "hydrologie",
    nodes: (() => {
      const src = nid()
      const inter = nid()
      const nearest = nid()
      const risk = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "buildings", schema: "public", table: "batiments", event: "INSERT,UPDATE",
        }),
        mkNode(inter, "spatialOp", 270, 30, {
          nodeKind: "spatialOp", label: "ST_Intersects flood", operation: "st_intersects",
          phase: "before", field: "in_flood_zone", coalesce: true,
          distantSchema: "ref", distantTable: "zones_inondables", distantField: "geom",
        }),
        mkNode(nearest, "spatialOp", 270, 150, {
          nodeKind: "spatialOp", label: "ST_Nearest waterbody", operation: "st_nearest",
          phase: "before", field: "nearest_water_id", coalesce: true,
          distantSchema: "ref", distantTable: "cours_eau", distantField: "geom",
        }),
        mkNode(risk, "customExpression", 560, 80, {
          nodeKind: "customExpression", label: "Flood Risk", phase: "before", field: "flood_risk_level",
          expression: "CASE WHEN ($1->>'in_flood_zone') IS NOT NULL THEN 'high' WHEN ST_Distance(NEW.geom, (SELECT geom FROM ref.cours_eau WHERE id = ($1->>'nearest_water_id')::INT)) < 200 THEN 'medium' ELSE 'low' END",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "public.batiments", label: "Building table", description: "Buildings to assess", type: "schema.table" },
      { key: "ref.zones_inondables", label: "Flood zones", description: "Official flood risk zones", type: "schema.table" },
      { key: "ref.cours_eau", label: "Water courses", description: "Rivers/streams", type: "schema.table" },
    ],
  },

  // ── Generic: Full Zone Statistics ──────────────────────────────────
  {
    id: "generic-zone-stats",
    name: "Full Zone Statistics",
    description: "INSERT child → ST_Within zone → COUNT + SUM + AVG + MIN + MAX on parent",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const within = nid()
      const countAgg = nid()
      const sumAgg = nid()
      const avgAgg = nid()
      const minAgg = nid()
      const maxAgg = nid()
      return [
        mkNode(src, "tableSource", 0, 120, {
          nodeKind: "tableSource", label: "features", schema: "public", table: "features", event: "INSERT,UPDATE,DELETE",
        }),
        mkNode(within, "spatialOp", 250, 120, {
          nodeKind: "spatialOp", label: "ST_Within Zone", operation: "st_within",
          phase: "before", field: "zone_id", coalesce: true,
          distantSchema: "public", distantTable: "zones", distantField: "geom",
        }),
        mkNode(countAgg, "aggregate", 530, 0, {
          nodeKind: "aggregate", label: "COUNT", operation: "count_st_contains",
          phase: "after", distantSchema: "public", distantTable: "zones", distantField: "feature_count",
        }),
        mkNode(sumAgg, "aggregate", 530, 70, {
          nodeKind: "aggregate", label: "SUM value", operation: "sum_st_contains",
          phase: "after", sourceField: "value",
          distantSchema: "public", distantTable: "zones", distantField: "total_value",
        }),
        mkNode(avgAgg, "aggregate", 530, 140, {
          nodeKind: "aggregate", label: "AVG value", operation: "avg_st_contains",
          phase: "after", sourceField: "value",
          distantSchema: "public", distantTable: "zones", distantField: "avg_value",
        }),
        mkNode(minAgg, "aggregate", 530, 210, {
          nodeKind: "aggregate", label: "MIN value", operation: "min_st_contains",
          phase: "after", sourceField: "value",
          distantSchema: "public", distantTable: "zones", distantField: "min_value",
        }),
        mkNode(maxAgg, "aggregate", 530, 280, {
          nodeKind: "aggregate", label: "MAX value", operation: "max_st_contains",
          phase: "after", sourceField: "value",
          distantSchema: "public", distantTable: "zones", distantField: "max_value",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 7 }, (_, i) => `tpl-${_id - 6 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[1], ids[4]), source: ids[1], target: ids[4] },
        { id: eid(ids[1], ids[5]), source: ids[1], target: ids[5] },
        { id: eid(ids[1], ids[6]), source: ids[1], target: ids[6] },
      ]
    })(),
    placeholders: [
      { key: "public.features", label: "Feature table", description: "Child features with a numeric field", type: "schema.table" },
      { key: "public.zones", label: "Zone table", description: "Parent zones receiving stats", type: "schema.table" },
      { key: "value", label: "Numeric field", description: "Field to aggregate (SUM/AVG/MIN/MAX)", type: "field" },
    ],
  },

  // ── Generic: Attribute Filter + Aggregate ──────────────────────────
  {
    id: "generic-attr-filter-agg",
    name: "Attribute Filter + Aggregate",
    description: "INSERT → attribute predicate filter → ST_Within → conditional COUNT + SUM",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const filter = nid()
      const within = nid()
      const countAgg = nid()
      const sumAgg = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "features", schema: "public", table: "features", event: "INSERT,UPDATE",
        }),
        mkNode(filter, "customExpression", 250, 40, {
          nodeKind: "customExpression", label: "Attr Filter", phase: "before", field: "passes_filter",
          expression: "CASE WHEN ($1->>'status')::TEXT = 'active' AND ($1->>'priority')::INT >= 3 THEN true ELSE false END",
          coalesce: false,
        }),
        mkNode(within, "spatialOp", 250, 160, {
          nodeKind: "spatialOp", label: "ST_Within Zone", operation: "st_within",
          phase: "before", field: "zone_id", coalesce: true,
          distantSchema: "public", distantTable: "zones", distantField: "geom",
        }),
        mkNode(countAgg, "aggregate", 530, 60, {
          nodeKind: "aggregate", label: "COUNT filtered", operation: "count_st_contains",
          phase: "after", filterExpression: "passes_filter = true",
          distantSchema: "public", distantTable: "zones", distantField: "active_count",
        }),
        mkNode(sumAgg, "aggregate", 530, 160, {
          nodeKind: "aggregate", label: "SUM filtered", operation: "sum_st_contains",
          phase: "after", sourceField: "amount", filterExpression: "passes_filter = true",
          distantSchema: "public", distantTable: "zones", distantField: "active_total",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
        { id: eid(ids[2], ids[4]), source: ids[2], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "public.features", label: "Feature table", description: "Features with status + priority fields", type: "schema.table" },
      { key: "public.zones", label: "Zone table", description: "Parent zones for filtered aggregation", type: "schema.table" },
      { key: "status", label: "Filter field", description: "Attribute field for predicate filter", type: "field" },
      { key: "amount", label: "Sum field", description: "Numeric field to sum (filtered)", type: "field" },
    ],
  },

  // ── Generic: Buffer + Intersects Check ─────────────────────────────
  {
    id: "generic-buffer-intersects",
    name: "Buffer + Intersects Check",
    description: "INSERT → ST_Buffer → ST_Intersects reference → flag + count impacted",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const buffer = nid()
      const inter = nid()
      const flag = nid()
      const countAgg = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "source", schema: "public", table: "source_table", event: "INSERT,UPDATE",
        }),
        mkNode(buffer, "spatialOp", 260, 100, {
          nodeKind: "spatialOp", label: "ST_Buffer", operation: "st_buffer",
          phase: "before", field: "buffer_geom", coalesce: false,
          distance: 100,
        }),
        mkNode(inter, "spatialOp", 530, 50, {
          nodeKind: "spatialOp", label: "ST_Intersects Ref", operation: "st_intersects",
          phase: "before", field: "ref_hit_id", coalesce: true,
          useBufferedGeom: true,
          distantSchema: "public", distantTable: "reference_table", distantField: "geom",
        }),
        mkNode(flag, "customExpression", 530, 180, {
          nodeKind: "customExpression", label: "Impact Flag", phase: "before", field: "has_impact",
          expression: "CASE WHEN ($1->>'ref_hit_id') IS NOT NULL THEN true ELSE false END",
          coalesce: false,
        }),
        mkNode(countAgg, "aggregate", 800, 100, {
          nodeKind: "aggregate", label: "COUNT impacted", operation: "count_st_intersects",
          phase: "after", distantSchema: "public", distantTable: "reference_table", distantField: "impacted_count",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[2], ids[4]), source: ids[2], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "public.source_table", label: "Source table", description: "Features to buffer", type: "schema.table" },
      { key: "public.reference_table", label: "Reference table", description: "Features to check intersection against", type: "schema.table" },
      { key: "buffer_distance", label: "Buffer distance (m)", description: "Buffer radius in meters", type: "number" },
    ],
  },

  // ── Generic: Conditional Branching ─────────────────────────────────
  {
    id: "generic-conditional-branch",
    name: "Conditional Branching",
    description: "INSERT → classify by attribute → branch A (high) or B (low) → different aggregation targets",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const classify = nid()
      const within = nid()
      const branchA = nid()
      const branchB = nid()
      const targetA = nid()
      const targetB = nid()
      return [
        mkNode(src, "tableSource", 0, 120, {
          nodeKind: "tableSource", label: "events", schema: "public", table: "events", event: "INSERT",
        }),
        mkNode(classify, "customExpression", 250, 60, {
          nodeKind: "customExpression", label: "Classify", phase: "before", field: "category",
          expression: "CASE WHEN ($1->>'severity')::INT >= 7 THEN 'critical' WHEN ($1->>'severity')::INT >= 4 THEN 'warning' ELSE 'info' END",
          coalesce: false,
        }),
        mkNode(within, "spatialOp", 250, 180, {
          nodeKind: "spatialOp", label: "ST_Within Zone", operation: "st_within",
          phase: "before", field: "zone_id", coalesce: true,
          distantSchema: "public", distantTable: "zones", distantField: "geom",
        }),
        mkNode(branchA, "aggregate", 530, 0, {
          nodeKind: "aggregate", label: "COUNT critical", operation: "count_st_contains",
          phase: "after", filterExpression: "category = 'critical'",
          distantSchema: "public", distantTable: "zones", distantField: "critical_count",
        }),
        mkNode(branchB, "aggregate", 530, 80, {
          nodeKind: "aggregate", label: "COUNT warning", operation: "count_st_contains",
          phase: "after", filterExpression: "category = 'warning'",
          distantSchema: "public", distantTable: "zones", distantField: "warning_count",
        }),
        mkNode(targetA, "customExpression", 530, 180, {
          nodeKind: "customExpression", label: "Alert Score", phase: "after", field: "alert_score",
          expression: "critical_count * 10 + warning_count * 3",
          coalesce: false,
        }),
        mkNode(targetB, "forgeTarget", 800, 120, {
          nodeKind: "target", label: "zones", distantSchema: "public", distantTable: "zones", distantField: "alert_score",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 7 }, (_, i) => `tpl-${_id - 6 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
        { id: eid(ids[2], ids[4]), source: ids[2], target: ids[4] },
        { id: eid(ids[3], ids[5]), source: ids[3], target: ids[5] },
        { id: eid(ids[4], ids[5]), source: ids[4], target: ids[5] },
        { id: eid(ids[5], ids[6]), source: ids[5], target: ids[6] },
      ]
    })(),
    placeholders: [
      { key: "public.events", label: "Events table", description: "Features with a severity field", type: "schema.table" },
      { key: "public.zones", label: "Zone table", description: "Zones receiving category counts + alert score", type: "schema.table" },
      { key: "severity", label: "Severity field", description: "Numeric field for classification (0-10)", type: "field" },
    ],
  },

  // ── Generic: DELETE Cascade Decrement ──────────────────────────────
  {
    id: "generic-delete-cascade",
    name: "DELETE Cascade Decrement",
    description: "DELETE child → recalculate COUNT + SUM on parent zone",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const countAgg = nid()
      const sumAgg = nid()
      const target = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "features", schema: "public", table: "features", event: "DELETE",
        }),
        mkNode(countAgg, "aggregate", 280, 30, {
          nodeKind: "aggregate", label: "RECOUNT", operation: "count_st_contains",
          phase: "after", distantSchema: "public", distantTable: "zones", distantField: "feature_count",
        }),
        mkNode(sumAgg, "aggregate", 280, 140, {
          nodeKind: "aggregate", label: "RESUM value", operation: "sum_st_contains",
          phase: "after", sourceField: "value",
          distantSchema: "public", distantTable: "zones", distantField: "total_value",
        }),
        mkNode(target, "forgeTarget", 560, 80, {
          nodeKind: "target", label: "zones", distantSchema: "public", distantTable: "zones", distantField: "feature_count",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "public.features", label: "Feature table", description: "Table where deletes trigger recalculation", type: "schema.table" },
      { key: "public.zones", label: "Zone table", description: "Parent zones to recalculate", type: "schema.table" },
      { key: "value", label: "Sum field", description: "Numeric field to re-aggregate", type: "field" },
    ],
  },

  // ── Generic: Centroid + Distance Calc ──────────────────────────────
  {
    id: "generic-centroid-distance",
    name: "Centroid + Distance Calc",
    description: "INSERT polygon → ST_Centroid → ST_Distance to reference → classify proximity",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const centroid = nid()
      const dist = nid()
      const classify = nid()
      return [
        mkNode(src, "tableSource", 0, 80, {
          nodeKind: "tableSource", label: "polygons", schema: "public", table: "polygons", event: "INSERT,UPDATE",
        }),
        mkNode(centroid, "spatialOp", 270, 80, {
          nodeKind: "spatialOp", label: "ST_Centroid", operation: "st_centroid",
          phase: "before", field: "centroid_geom", coalesce: false,
        }),
        mkNode(dist, "customExpression", 540, 30, {
          nodeKind: "customExpression", label: "Distance to Ref", phase: "before", field: "distance_m",
          expression: "ST_Distance(ST_Centroid(NEW.geom)::geography, (SELECT geom::geography FROM public.reference_point WHERE id = 1))",
          coalesce: false,
        }),
        mkNode(classify, "customExpression", 540, 160, {
          nodeKind: "customExpression", label: "Proximity Class", phase: "before", field: "proximity",
          expression: "CASE WHEN ($1->>'distance_m')::NUMERIC < 500 THEN 'close' WHEN ($1->>'distance_m')::NUMERIC < 2000 THEN 'medium' ELSE 'far' END",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 4 }, (_, i) => `tpl-${_id - 3 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
      ]
    })(),
    placeholders: [
      { key: "public.polygons", label: "Polygon table", description: "Polygon features to analyse", type: "schema.table" },
      { key: "public.reference_point", label: "Reference point", description: "Point feature for distance calc", type: "schema.table" },
    ],
  },

  // ── Generic: Spatial Join Enrichment ───────────────────────────────
  {
    id: "generic-spatial-join",
    name: "Spatial Join Enrichment",
    description: "INSERT → ST_Intersects ref → copy attributes from ref → validation",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const inter = nid()
      const copyA = nid()
      const copyB = nid()
      const valid = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "features", schema: "public", table: "features", event: "INSERT,UPDATE",
        }),
        mkNode(inter, "spatialOp", 270, 100, {
          nodeKind: "spatialOp", label: "ST_Intersects Ref", operation: "st_intersects",
          phase: "before", field: "ref_id", coalesce: true,
          distantSchema: "public", distantTable: "reference_layer", distantField: "geom",
        }),
        mkNode(copyA, "customExpression", 550, 40, {
          nodeKind: "customExpression", label: "Copy Type", phase: "before", field: "ref_type",
          expression: "(SELECT type FROM public.reference_layer WHERE id = ($1->>'ref_id')::INT)",
          coalesce: true,
        }),
        mkNode(copyB, "customExpression", 550, 130, {
          nodeKind: "customExpression", label: "Copy Code", phase: "before", field: "ref_code",
          expression: "(SELECT code FROM public.reference_layer WHERE id = ($1->>'ref_id')::INT)",
          coalesce: true,
        }),
        mkNode(valid, "validation", 550, 220, {
          nodeKind: "validation", label: "Validate Join", rules: [
            { type: "not_null", config: { field: "ref_id" }, onFail: "warn" },
          ],
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[1], ids[4]), source: ids[1], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "public.features", label: "Feature table", description: "Features to enrich via spatial join", type: "schema.table" },
      { key: "public.reference_layer", label: "Reference layer", description: "Layer providing attributes to copy", type: "schema.table" },
      { key: "type", label: "Attribute A", description: "First attribute to copy from reference", type: "field" },
      { key: "code", label: "Attribute B", description: "Second attribute to copy from reference", type: "field" },
    ],
  },

  // ── Generic: Multi-Predicate Validation Pipeline ──────────────────
  {
    id: "generic-multi-predicate",
    name: "Multi-Predicate Validation",
    description: "INSERT → attribute checks (range, not null, regex) → geometry checks → quality score",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const validAttr = nid()
      const validGeom = nid()
      const score = nid()
      const classify = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "data", schema: "public", table: "data", event: "INSERT,UPDATE",
        }),
        mkNode(validAttr, "validation", 270, 30, {
          nodeKind: "validation", label: "Attribute Checks", rules: [
            { type: "not_null", config: { field: "name" }, onFail: "tag" },
            { type: "not_null", config: { field: "type" }, onFail: "tag" },
            { type: "range", config: { field: "value", min: 0, max: 99999 }, onFail: "tag" },
            { type: "regex", config: { field: "code", pattern: "^[A-Z]{2}-\\d{4}$" }, onFail: "tag" },
          ],
        }),
        mkNode(validGeom, "validation", 270, 180, {
          nodeKind: "validation", label: "Geometry Checks", rules: [
            { type: "geometry_valid", config: {}, onFail: "tag" },
            { type: "srid_check", config: { expected_srid: 4326 }, onFail: "block" },
            { type: "min_area", config: { min_m2: 1 }, onFail: "tag" },
          ],
        }),
        mkNode(score, "customExpression", 560, 60, {
          nodeKind: "customExpression", label: "Quality Score", phase: "before", field: "quality_score",
          expression: "10 - COALESCE(array_length(($1->>'_validation_tags')::TEXT[], 1), 0)",
          coalesce: false,
        }),
        mkNode(classify, "customExpression", 560, 180, {
          nodeKind: "customExpression", label: "Grade", phase: "before", field: "quality_grade",
          expression: "CASE WHEN ($1->>'quality_score')::INT >= 9 THEN 'A' WHEN ($1->>'quality_score')::INT >= 7 THEN 'B' WHEN ($1->>'quality_score')::INT >= 5 THEN 'C' ELSE 'D' END",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[2], ids[4]), source: ids[2], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "public.data", label: "Data table", description: "Table to validate with multiple predicates", type: "schema.table" },
    ],
  },

  // ── Generic: Multi-Table Intersect Aggregation ─────────────────────
  {
    id: "generic-multi-intersect",
    name: "Multi-Table Intersect Aggregation",
    description: "INSERT zone → ST_Intersects table A + table B → COUNT each + ratio calc",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const countA = nid()
      const countB = nid()
      const ratio = nid()
      const target = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "zones", schema: "public", table: "zones", event: "INSERT,UPDATE",
        }),
        mkNode(countA, "aggregate", 280, 30, {
          nodeKind: "aggregate", label: "COUNT type_a", operation: "count_st_intersects",
          phase: "after",
          distantSchema: "public", distantTable: "type_a", distantField: "count_a",
        }),
        mkNode(countB, "aggregate", 280, 180, {
          nodeKind: "aggregate", label: "COUNT type_b", operation: "count_st_intersects",
          phase: "after",
          distantSchema: "public", distantTable: "type_b", distantField: "count_b",
        }),
        mkNode(ratio, "customExpression", 560, 100, {
          nodeKind: "customExpression", label: "Ratio A/B", phase: "after", field: "ratio_a_b",
          expression: "count_a::NUMERIC / NULLIF(count_b, 0)",
          coalesce: false,
        }),
        mkNode(target, "forgeTarget", 830, 100, {
          nodeKind: "target", label: "zones", distantSchema: "public", distantTable: "zones", distantField: "ratio_a_b",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
        { id: eid(ids[3], ids[4]), source: ids[3], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "public.zones", label: "Zone table", description: "Parent zones", type: "schema.table" },
      { key: "public.type_a", label: "Table A", description: "First feature set to count", type: "schema.table" },
      { key: "public.type_b", label: "Table B", description: "Second feature set to count", type: "schema.table" },
    ],
  },

  // ── Generic: Area + Perimeter + Compactness ────────────────────────
  {
    id: "generic-geometry-metrics",
    name: "Geometry Metrics",
    description: "INSERT polygon → ST_Area + ST_Perimeter → compactness index + classification",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const area = nid()
      const perim = nid()
      const compact = nid()
      const classify = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "parcels", schema: "public", table: "parcels", event: "INSERT,UPDATE",
        }),
        mkNode(area, "spatialOp", 270, 40, {
          nodeKind: "spatialOp", label: "ST_Area", operation: "st_area",
          phase: "before", field: "area_m2", coalesce: false,
        }),
        mkNode(perim, "spatialOp", 270, 160, {
          nodeKind: "spatialOp", label: "ST_Perimeter", operation: "st_perimeter",
          phase: "before", field: "perimeter_m", coalesce: false,
        }),
        mkNode(compact, "customExpression", 550, 40, {
          nodeKind: "customExpression", label: "Compactness", phase: "before", field: "compactness",
          expression: "4 * PI() * ($1->>'area_m2')::NUMERIC / NULLIF(POWER(($1->>'perimeter_m')::NUMERIC, 2), 0)",
          coalesce: false,
        }),
        mkNode(classify, "customExpression", 550, 160, {
          nodeKind: "customExpression", label: "Shape Class", phase: "before", field: "shape_class",
          expression: "CASE WHEN ($1->>'compactness')::NUMERIC > 0.8 THEN 'compact' WHEN ($1->>'compactness')::NUMERIC > 0.5 THEN 'regular' ELSE 'irregular' END",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[0], ids[2]), source: ids[0], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
        { id: eid(ids[3], ids[4]), source: ids[3], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "public.parcels", label: "Polygon table", description: "Polygons to measure", type: "schema.table" },
    ],
  },

  // ── Generic: Overlap Detection + Area Ratio ────────────────────────
  {
    id: "generic-overlap-detection",
    name: "Overlap Detection + Area Ratio",
    description: "INSERT → ST_Overlaps reference → ST_Intersection area → overlap percentage",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const overlaps = nid()
      const interArea = nid()
      const pct = nid()
      const flag = nid()
      return [
        mkNode(src, "tableSource", 0, 100, {
          nodeKind: "tableSource", label: "features", schema: "public", table: "features", event: "INSERT,UPDATE",
        }),
        mkNode(overlaps, "spatialOp", 270, 100, {
          nodeKind: "spatialOp", label: "ST_Overlaps", operation: "st_overlaps",
          phase: "before", field: "overlap_id", coalesce: true,
          distantSchema: "public", distantTable: "reference_table", distantField: "geom",
        }),
        mkNode(interArea, "customExpression", 550, 40, {
          nodeKind: "customExpression", label: "Intersection Area", phase: "before", field: "overlap_area_m2",
          expression: "ST_Area(ST_Intersection(NEW.geom::geography, (SELECT geom::geography FROM public.reference_table WHERE id = ($1->>'overlap_id')::INT)))",
          coalesce: false,
        }),
        mkNode(pct, "customExpression", 550, 140, {
          nodeKind: "customExpression", label: "Overlap %", phase: "before", field: "overlap_pct",
          expression: "ROUND(($1->>'overlap_area_m2')::NUMERIC / NULLIF(ST_Area(NEW.geom::geography), 0) * 100, 2)",
          coalesce: false,
        }),
        mkNode(flag, "customExpression", 550, 240, {
          nodeKind: "customExpression", label: "Conflict Flag", phase: "before", field: "has_conflict",
          expression: "CASE WHEN ($1->>'overlap_pct')::NUMERIC > 50 THEN true ELSE false END",
          coalesce: false,
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 5 }, (_, i) => `tpl-${_id - 4 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[2], ids[3]), source: ids[2], target: ids[3] },
        { id: eid(ids[3], ids[4]), source: ids[3], target: ids[4] },
      ]
    })(),
    placeholders: [
      { key: "public.features", label: "Feature table", description: "Features to check for overlaps", type: "schema.table" },
      { key: "public.reference_table", label: "Reference table", description: "Layer to detect overlaps against", type: "schema.table" },
    ],
  },

  // ── Generic: Intersects Check + Aggregate ──────────────────────────
  {
    id: "generic-intersects-agg",
    name: "Intersects Check + Aggregate",
    description: "INSERT → ST_Intersects multi-ref → COUNT + SUM + AVG per zone + STRING_AGG names",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const inter = nid()
      const fkCopy = nid()
      const countAgg = nid()
      const sumAgg = nid()
      const avgAgg = nid()
      const strAgg = nid()
      const target = nid()
      return [
        mkNode(src, "tableSource", 0, 130, {
          nodeKind: "tableSource", label: "features", schema: "public", table: "features", event: "INSERT,UPDATE,DELETE",
        }),
        mkNode(inter, "spatialOp", 260, 130, {
          nodeKind: "spatialOp", label: "ST_Intersects Zone", operation: "st_intersects",
          phase: "before", field: "zone_id", coalesce: true,
          distantSchema: "public", distantTable: "zones", distantField: "geom",
        }),
        mkNode(fkCopy, "customExpression", 260, 270, {
          nodeKind: "customExpression", label: "Copy Zone Name", phase: "before", field: "zone_name",
          expression: "(SELECT name FROM public.zones WHERE id = ($1->>'zone_id')::INT)",
          coalesce: true,
        }),
        mkNode(countAgg, "aggregate", 550, 0, {
          nodeKind: "aggregate", label: "COUNT features", operation: "count_st_intersects",
          phase: "after", distantSchema: "public", distantTable: "zones", distantField: "feature_count",
        }),
        mkNode(sumAgg, "aggregate", 550, 80, {
          nodeKind: "aggregate", label: "SUM value", operation: "sum_st_intersects",
          phase: "after", sourceField: "value",
          distantSchema: "public", distantTable: "zones", distantField: "total_value",
        }),
        mkNode(avgAgg, "aggregate", 550, 160, {
          nodeKind: "aggregate", label: "AVG value", operation: "avg_st_intersects",
          phase: "after", sourceField: "value",
          distantSchema: "public", distantTable: "zones", distantField: "avg_value",
        }),
        mkNode(strAgg, "aggregate", 550, 240, {
          nodeKind: "aggregate", label: "STRING_AGG names", operation: "string_agg_st_intersects",
          phase: "after", sourceField: "name",
          distantSchema: "public", distantTable: "zones", distantField: "feature_names",
        }),
        mkNode(target, "forgeTarget", 840, 130, {
          nodeKind: "target", label: "zones", distantSchema: "public", distantTable: "zones", distantField: "feature_count",
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 8 }, (_, i) => `tpl-${_id - 7 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[1], ids[4]), source: ids[1], target: ids[4] },
        { id: eid(ids[1], ids[5]), source: ids[1], target: ids[5] },
        { id: eid(ids[1], ids[6]), source: ids[1], target: ids[6] },
        { id: eid(ids[3], ids[7]), source: ids[3], target: ids[7] },
        { id: eid(ids[4], ids[7]), source: ids[4], target: ids[7] },
        { id: eid(ids[5], ids[7]), source: ids[5], target: ids[7] },
        { id: eid(ids[6], ids[7]), source: ids[6], target: ids[7] },
      ]
    })(),
    placeholders: [
      { key: "public.features", label: "Feature table", description: "Child features (points, lines, or polygons)", type: "schema.table" },
      { key: "public.zones", label: "Zone table", description: "Parent zones receiving aggregated stats", type: "schema.table" },
      { key: "value", label: "Numeric field", description: "Field to SUM and AVG", type: "field" },
      { key: "name", label: "Text field", description: "Field for STRING_AGG concatenation", type: "field" },
    ],
  },

  // ── Generic: Within Check + Copy Fields from Polygon ───────────────
  {
    id: "generic-within-copy-fields",
    name: "Within Check + Copy Fields",
    description: "INSERT point/line → ST_Within polygon → copy ID + name + type from parent polygon",
    domain: "generic",
    nodes: (() => {
      const src = nid()
      const within = nid()
      const copyId = nid()
      const copyName = nid()
      const copyType = nid()
      const valid = nid()
      return [
        mkNode(src, "tableSource", 0, 120, {
          nodeKind: "tableSource", label: "features", schema: "public", table: "features", event: "INSERT,UPDATE",
        }),
        mkNode(within, "spatialOp", 270, 120, {
          nodeKind: "spatialOp", label: "ST_Within Polygon", operation: "st_within",
          phase: "before", field: "polygon_id", coalesce: true,
          distantSchema: "public", distantTable: "polygons", distantField: "geom",
        }),
        mkNode(copyId, "customExpression", 560, 20, {
          nodeKind: "customExpression", label: "Copy Code", phase: "before", field: "polygon_code",
          expression: "(SELECT code FROM public.polygons WHERE id = ($1->>'polygon_id')::INT)",
          coalesce: true,
        }),
        mkNode(copyName, "customExpression", 560, 110, {
          nodeKind: "customExpression", label: "Copy Name", phase: "before", field: "polygon_name",
          expression: "(SELECT name FROM public.polygons WHERE id = ($1->>'polygon_id')::INT)",
          coalesce: true,
        }),
        mkNode(copyType, "customExpression", 560, 200, {
          nodeKind: "customExpression", label: "Copy Type", phase: "before", field: "polygon_type",
          expression: "(SELECT type FROM public.polygons WHERE id = ($1->>'polygon_id')::INT)",
          coalesce: true,
        }),
        mkNode(valid, "validation", 560, 290, {
          nodeKind: "validation", label: "Validate FK", rules: [
            { type: "not_null", config: { field: "polygon_id" }, onFail: "warn" },
          ],
        }),
      ]
    })(),
    edges: (() => {
      const ids = Array.from({ length: 6 }, (_, i) => `tpl-${_id - 5 + i}`)
      return [
        { id: eid(ids[0], ids[1]), source: ids[0], target: ids[1] },
        { id: eid(ids[1], ids[2]), source: ids[1], target: ids[2] },
        { id: eid(ids[1], ids[3]), source: ids[1], target: ids[3] },
        { id: eid(ids[1], ids[4]), source: ids[1], target: ids[4] },
        { id: eid(ids[1], ids[5]), source: ids[1], target: ids[5] },
      ]
    })(),
    placeholders: [
      { key: "public.features", label: "Feature table", description: "Points or lines to enrich with polygon attributes", type: "schema.table" },
      { key: "public.polygons", label: "Polygon layer", description: "Parent polygon layer (zones, parcels, etc.)", type: "schema.table" },
      { key: "code", label: "Field A (code)", description: "First field to copy from polygon", type: "field" },
      { key: "name", label: "Field B (name)", description: "Second field to copy from polygon", type: "field" },
      { key: "type", label: "Field C (type)", description: "Third field to copy from polygon", type: "field" },
    ],
  },
]
