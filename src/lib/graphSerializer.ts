/**
 * Serializes/deserializes ReactFlow graphs to/from the backend scenario format.
 *
 * Backend node types: dataset, capability, artifact, branch, trigger
 * Frontend node types: datasetSource, capability, output, branch, trigger, codeBlock
 */

import type { Node, Edge } from "@xyflow/react"

// ---------------------------------------------------------------------------
// Backend types (matching POST /scenarios body)
// ---------------------------------------------------------------------------

export interface BackendNodeDef {
  id: string
  type: string
  label: string
  config: Record<string, unknown>
  position: { x: number; y: number }
}

export interface BackendEdgeDef {
  id: string
  source: string
  target: string
  source_handle?: string | null
  target_handle?: string | null
}

export interface ScenarioGraph {
  name: string
  nodes: BackendNodeDef[]
  edges: BackendEdgeDef[]
}

// ---------------------------------------------------------------------------
// Frontend -> Backend type mapping
// ---------------------------------------------------------------------------

const FRONTEND_TO_BACKEND: Record<string, string> = {
  // Pipeline graph nodes
  datasetSource: "dataset",
  capability: "capability",
  output: "artifact",
  branch: "branch",
  trigger: "trigger",
  codeBlock: "capability",
  // Ops / trigger operation nodes
  tableSource: "table_source",
  spatialOp: "spatial_op",
  aggregate: "aggregate",
  target: "target",
  customExpression: "custom_expression",
  validation: "validation",
  businessRule: "business_rule",
  composite: "composite",
}

const BACKEND_TO_FRONTEND: Record<string, string> = {
  // Pipeline graph nodes
  dataset: "datasetSource",
  capability: "capability",
  artifact: "output",
  branch: "branch",
  trigger: "trigger",
  // Ops / trigger operation nodes
  table_source: "tableSource",
  spatial_op: "spatialOp",
  aggregate: "aggregate",
  target: "target",
  custom_expression: "customExpression",
  validation: "validation",
  business_rule: "businessRule",
  composite: "composite",
}

// ---------------------------------------------------------------------------
// Serialization (ReactFlow -> Backend)
// ---------------------------------------------------------------------------

export function serializeGraph(
  nodes: Node[],
  edges: Edge[],
  name: string,
): ScenarioGraph {
  const backendNodes: BackendNodeDef[] = nodes
    .filter((n) => n.type !== "group") // groups are UI-only
    .map((n) => {
      const d = n.data as Record<string, unknown>
      const frontendType = n.type ?? "capability"
      const backendType = FRONTEND_TO_BACKEND[frontendType] ?? frontendType

      // Build config from node data, stripping UI-only fields
      const { label, status, featureCount, ...config } = d

      // For codeBlock nodes, mark them so the backend knows it's a postgis_sql capability
      if (frontendType === "codeBlock") {
        config.sub_type = "postgis_sql"
      }

      return {
        id: n.id,
        type: backendType,
        label: (label as string) ?? backendType,
        config,
        position: { x: n.position.x, y: n.position.y },
      }
    })

  const backendEdges: BackendEdgeDef[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    source_handle: e.sourceHandle ?? null,
    target_handle: e.targetHandle ?? null,
  }))

  return { name, nodes: backendNodes, edges: backendEdges }
}

// ---------------------------------------------------------------------------
// Deserialization (Backend -> ReactFlow)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PipelineSpec v2 conversion (Issue #406)
// ---------------------------------------------------------------------------

export interface PipelineStepSpec {
  id: string
  type: string
  capability?: string | null
  params: Record<string, unknown>
  input?: string | string[] | null
  enabled?: boolean
  order?: number
}

export interface PipelineSpecV2 {
  version: 2
  name: string
  description?: string
  steps: PipelineStepSpec[]
  triggers?: Array<{ on: string; then: string; then_config?: Record<string, unknown> }>
  ref_layers?: Record<string, string>
}

/**
 * Convert ReactFlow graph → PipelineSpec v2.
 *
 * Maps capability nodes to StepSpecs, wires edges as `input` references,
 * and collects datasetSource nodes as `ref_layers` hints.
 */
export function graphToPipelineSpec(
  nodes: Node[],
  edges: Edge[],
  name: string,
  description = "",
): PipelineSpecV2 {
  const steps: PipelineStepSpec[] = []
  const refLayers: Record<string, string> = {}

  // Build incoming edges index: target → source[]
  const incomingMap = new Map<string, string[]>()
  for (const e of edges) {
    const existing = incomingMap.get(e.target) ?? []
    existing.push(e.source)
    incomingMap.set(e.target, existing)
  }

  // Collect dataset source nodes for ref_layers
  const datasetNodes = new Map<string, string>()
  for (const n of nodes) {
    if (n.type === "datasetSource") {
      const d = n.data as Record<string, unknown>
      const datasetName = (d.datasetName as string) ?? (d.label as string) ?? n.id
      const sourcePath = (d.sourcePath as string) ?? (d.filePath as string) ?? ""
      datasetNodes.set(n.id, datasetName)
      if (sourcePath) {
        refLayers[datasetName] = sourcePath
      }
    }
  }

  // Convert capability/filter/codeBlock nodes to StepSpecs
  let order = 0
  for (const n of nodes) {
    const frontendType = n.type ?? "capability"
    if (frontendType === "group" || frontendType === "datasetSource" || frontendType === "output") {
      continue
    }

    const d = n.data as Record<string, unknown>
    const { label, status, featureCount, ...config } = d

    // Determine step type and capability
    let stepType = "capability"
    let capability: string | null = (config.capability as string) ?? null

    if (frontendType === "codeBlock") {
      stepType = "custom_sql"
      capability = null
    } else if (frontendType === "trigger") {
      continue // triggers are handled separately
    }

    // Resolve input references
    const sources = incomingMap.get(n.id) ?? []
    let input: string | string[] | null = null
    if (sources.length === 1) {
      // Replace dataset node refs with their name
      input = datasetNodes.get(sources[0]) ?? sources[0]
    } else if (sources.length > 1) {
      input = sources.map((s) => datasetNodes.get(s) ?? s)
    }

    steps.push({
      id: n.id,
      type: stepType,
      capability,
      params: config as Record<string, unknown>,
      input,
      enabled: (config.enabled as boolean) ?? true,
      order: order++,
    })
  }

  return {
    version: 2,
    name,
    description,
    steps,
    ref_layers: Object.keys(refLayers).length > 0 ? refLayers : undefined,
  }
}

/**
 * Convert PipelineSpec v2 → ReactFlow nodes + edges.
 *
 * Creates capability nodes positioned vertically, with edges
 * derived from step `input` references.
 */
export function pipelineSpecToGraph(spec: PipelineSpecV2): {
  nodes: Node[]
  edges: Edge[]
} {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const Y_SPACING = 120
  const X_CENTER = 300

  // Create ref_layer dataset nodes
  let y = 50
  if (spec.ref_layers) {
    for (const [alias, sourcePath] of Object.entries(spec.ref_layers)) {
      nodes.push({
        id: alias,
        type: "datasetSource",
        position: { x: X_CENTER - 200, y },
        data: {
          label: alias,
          datasetName: alias,
          sourcePath,
        },
      })
      y += Y_SPACING
    }
  }

  // Create step nodes
  y = 50
  for (const step of spec.steps) {
    let frontendType = "capability"
    if (step.type === "custom_sql") {
      frontendType = "codeBlock"
    }

    const data: Record<string, unknown> = {
      label: step.capability ?? step.id,
      capability: step.capability,
      ...step.params,
      enabled: step.enabled ?? true,
    }

    nodes.push({
      id: step.id,
      type: frontendType,
      position: { x: X_CENTER, y },
      data,
    })

    // Create edges from input references
    if (step.input) {
      const sources = Array.isArray(step.input) ? step.input : [step.input]
      for (const src of sources) {
        edges.push({
          id: `e-${src}-${step.id}`,
          source: src,
          target: step.id,
        })
      }
    }

    y += Y_SPACING
  }

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Deserialization (Backend -> ReactFlow)
// ---------------------------------------------------------------------------

export function deserializeGraph(scenario: ScenarioGraph): {
  nodes: Node[]
  edges: Edge[]
} {
  const nodes: Node[] = scenario.nodes.map((bn) => {
    // Determine frontend type
    let frontendType: string
    if (bn.type === "capability" && bn.config?.sub_type === "postgis_sql") {
      frontendType = "codeBlock"
    } else {
      frontendType = BACKEND_TO_FRONTEND[bn.type] ?? bn.type
    }

    // Reconstruct node data
    const { sub_type, ...restConfig } = bn.config ?? {}
    const data: Record<string, unknown> = {
      label: bn.label,
      ...restConfig,
    }

    return {
      id: bn.id,
      type: frontendType,
      position: bn.position,
      data,
    }
  })

  const edges: Edge[] = scenario.edges.map((be) => ({
    id: be.id,
    source: be.source,
    target: be.target,
    sourceHandle: be.source_handle ?? undefined,
    targetHandle: be.target_handle ?? undefined,
  }))

  return { nodes, edges }
}
