/**
 * Port type system for connection validation and visual coloring.
 *
 * Port types:
 *   - geometry: spatial data (blue handles)
 *   - tabular:  non-spatial / filtered data (green handles)
 *   - event:    trigger signals (purple handles)
 *   - any:      accepts/emits anything (gray handles)
 */

export type PortType = "geometry" | "tabular" | "event" | "any"

export interface PortSpec {
  inputs: PortType[]
  outputs: PortType[]
}

/** Default port specs per node type. */
export const PORT_SPECS: Record<string, PortSpec> = {
  datasetSource: { inputs: [], outputs: ["geometry"] },
  capability:    { inputs: ["geometry"], outputs: ["geometry"] },
  branch:        { inputs: ["geometry"], outputs: ["geometry", "geometry"] },
  trigger:       { inputs: [], outputs: ["event"] },
  codeBlock:     { inputs: ["any"], outputs: ["any"] },
  output:        { inputs: ["geometry"], outputs: [] },
  // Trigger operation nodes
  tableSource:       { inputs: [], outputs: ["event"] },
  spatialOp:         { inputs: ["event"], outputs: ["geometry"] },
  aggregate:         { inputs: ["event"], outputs: ["tabular"] },
  target:            { inputs: ["tabular"], outputs: [] },
  customExpression:  { inputs: ["event"], outputs: ["any"] },
  validation:        { inputs: ["event"], outputs: ["event"] },
  composite:         { inputs: ["event"], outputs: ["geometry"] },
  businessRule:      { inputs: ["event"], outputs: ["any"] },
}

/** Handle color classes per port type (Tailwind). */
export const PORT_COLORS: Record<PortType, string> = {
  geometry: "!bg-blue-500",
  tabular:  "!bg-green-500",
  event:    "!bg-purple-500",
  any:      "!bg-gray-500",
}

/**
 * Check if a source port type can connect to a target port type.
 * "any" is compatible with everything. Otherwise types must match.
 */
export function arePortTypesCompatible(source: PortType, target: PortType): boolean {
  if (source === "any" || target === "any") return true
  return source === target
}
