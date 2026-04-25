/**
 * layerStyle.ts — Advanced layer style definitions.
 *
 * Models the full QGIS renderer hierarchy (single, categorized, graduated, rule-based)
 * in a format that can be:
 *   1. Edited in the portal UI (StyleEditorPanel)
 *   2. Converted to MapLibre paint/layout expressions for rendering
 *   3. Serialized to/from QGIS QML for roundtrip compatibility
 *   4. Stored in GPKG layer_styles table
 */

// ── Geometry awareness ────────────────────────────────────────────────

export type GeomFamily = "point" | "line" | "polygon" | "mixed"

export function geomFamily(geomType: string | null): GeomFamily {
  const t = (geomType ?? "").toLowerCase()
  if (t.includes("point")) return "point"
  if (t.includes("line")) return "line"
  if (t.includes("polygon")) return "polygon"
  return "mixed"
}

// ── Symbol definitions (per geometry type) ────────────────────────────

export type PointShape = "circle" | "square" | "triangle" | "cross" | "star" | "diamond"

export interface PointSymbol {
  kind: "point"
  shape: PointShape
  size: number         // px (MapLibre circle-radius or icon-size)
  color: string        // hex
  opacity: number      // 0-1
  strokeColor: string
  strokeWidth: number
  rotation?: number    // degrees
}

export interface LineSymbol {
  kind: "line"
  color: string
  width: number
  opacity: number
  dashPattern?: number[]   // [dash, gap, ...] in px
  cap?: "butt" | "round" | "square"
  join?: "miter" | "round" | "bevel"
}

export interface FillSymbol {
  kind: "fill"
  color: string
  opacity: number
  strokeColor: string
  strokeWidth: number
  strokeDashPattern?: number[]
}

export type SymbolDef = PointSymbol | LineSymbol | FillSymbol

// ── Default symbol factories ──────────────────────────────────────────

export function defaultPointSymbol(color = "#3b82f6"): PointSymbol {
  return { kind: "point", shape: "circle", size: 5, color, opacity: 0.85, strokeColor: "#ffffff", strokeWidth: 1 }
}

export function defaultLineSymbol(color = "#3b82f6"): LineSymbol {
  return { kind: "line", color, width: 2, opacity: 1, cap: "round", join: "round" }
}

export function defaultFillSymbol(color = "#3b82f6"): FillSymbol {
  return { kind: "fill", color, opacity: 0.4, strokeColor: color, strokeWidth: 1.5 }
}

export function defaultSymbol(geom: GeomFamily, color = "#3b82f6"): SymbolDef {
  if (geom === "point") return defaultPointSymbol(color)
  if (geom === "line") return defaultLineSymbol(color)
  return defaultFillSymbol(color)
}

// ── Color ramps ───────────────────────────────────────────────────────

export interface ColorRampDef {
  name: string
  colors: string[]  // ordered hex stops
}

// ── Renderer types ────────────────────────────────────────────────────

export type RendererType = "single" | "categorized" | "graduated" | "rule-based"

/** One class in a categorized renderer */
export interface CategoryEntry {
  value: string | number | null   // attribute value (null = "all other values")
  label: string
  symbol: SymbolDef
}

/** One class in a graduated renderer */
export interface GraduatedEntry {
  lower: number
  upper: number
  label: string
  symbol: SymbolDef
}

export type ClassifyMethod = "equal_interval" | "quantile" | "natural_breaks" | "std_dev"

/** One rule in a rule-based renderer */
export interface RuleEntry {
  name: string
  filter: string            // expression string, e.g. "status = 'active'"
  symbol: SymbolDef
  enabled: boolean
}

// ── Label definition ──────────────────────────────────────────────────

export interface LabelDef {
  enabled: boolean
  field: string
  color: string
  fontSize: number         // px
  fontWeight?: "normal" | "bold"
  haloColor?: string
  haloWidth?: number       // px
  placement?: "point" | "line" | "curved"
  offset?: [number, number]
  minZoom?: number
  maxZoom?: number
}

// ── Complete layer style definition ───────────────────────────────────

export interface LayerStyleDef {
  renderer: RendererType

  // Single symbol (renderer = "single")
  symbol?: SymbolDef

  // Categorized (renderer = "categorized")
  classField?: string
  categories?: CategoryEntry[]

  // Graduated (renderer = "graduated")
  graduatedField?: string
  classifyMethod?: ClassifyMethod
  colorRamp?: ColorRampDef
  classes?: GraduatedEntry[]

  // Rule-based (renderer = "rule-based")
  rules?: RuleEntry[]

  // Labels
  labeling?: LabelDef

  // Scale visibility
  minZoom?: number
  maxZoom?: number
}

// ── Migration helper: legacy flat style → LayerStyleDef ───────────────

export interface LegacyFlatStyle {
  color: string
  opacity: number
  strokeColor?: string
  strokeWidth?: number
}

/**
 * Convert a legacy flat style (color+opacity) into a proper LayerStyleDef
 * based on the geometry type of the layer.
 */
export function fromLegacyStyle(flat: LegacyFlatStyle, geom: GeomFamily): LayerStyleDef {
  const { color, opacity, strokeColor, strokeWidth } = flat

  if (geom === "point") {
    return {
      renderer: "single",
      symbol: {
        kind: "point",
        shape: "circle",
        size: 5,
        color,
        opacity,
        strokeColor: strokeColor ?? "#ffffff",
        strokeWidth: strokeWidth ?? 1,
      },
    }
  }

  if (geom === "line") {
    return {
      renderer: "single",
      symbol: {
        kind: "line",
        color: strokeColor ?? color,
        width: strokeWidth ?? 2,
        opacity,
        cap: "round",
        join: "round",
      },
    }
  }

  // polygon or mixed
  return {
    renderer: "single",
    symbol: {
      kind: "fill",
      color,
      opacity,
      strokeColor: strokeColor ?? color,
      strokeWidth: strokeWidth ?? 1.5,
    },
  }
}
