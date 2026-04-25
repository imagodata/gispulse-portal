/**
 * styleConverter.ts — Convert LayerStyleDef → MapLibre paint/layout properties.
 *
 * Handles all renderer types:
 *   single     → static paint values
 *   categorized → ["match", ["get", field], ...] expressions
 *   graduated  → ["step", ["get", field], ...] expressions
 *   rule-based → ["case", ...] expressions
 *
 * Each conversion returns separate specs for fill, line, and circle layers
 * so MapView.tsx can apply them directly.
 */

import type {
  LayerStyleDef,
  SymbolDef,
  PointSymbol,
  LineSymbol,
  FillSymbol,
  CategoryEntry,
  GraduatedEntry,
  GeomFamily,
  LabelDef,
} from "@/types/layerStyle"

// ── Output types ──────────────────────────────────────────────────────

type MLValue = string | number | boolean | unknown[]

export interface MapLibreLayerSpec {
  paint: Record<string, MLValue>
  layout: Record<string, MLValue>
}

export interface StyleSpec {
  fill: MapLibreLayerSpec | null
  line: MapLibreLayerSpec | null
  circle: MapLibreLayerSpec | null
  symbol: MapLibreLayerSpec | null  // for labels and icon markers
}

// ── Main entry point ──────────────────────────────────────────────────

export function styleToMaplibre(
  def: LayerStyleDef,
  geom: GeomFamily,
  isSelected = false,
): StyleSpec {
  switch (def.renderer) {
    case "single":
      return singleToML(def, geom, isSelected)
    case "categorized":
      return categorizedToML(def, geom, isSelected)
    case "graduated":
      return graduatedToML(def, geom, isSelected)
    case "rule-based":
      return ruleBasedToML(def, geom, isSelected)
    default:
      return singleToML(def, geom, isSelected)
  }
}

// ── Single symbol ─────────────────────────────────────────────────────

function singleToML(def: LayerStyleDef, geom: GeomFamily, isSelected: boolean): StyleSpec {
  const sym = def.symbol
  if (!sym) return emptySpec()

  const spec = emptySpec()
  const zoom = zoomLayout(def)

  if (sym.kind === "fill" || (geom === "polygon" && sym.kind !== "line")) {
    const s = sym as FillSymbol
    spec.fill = {
      paint: {
        "fill-color": s.color,
        "fill-opacity": s.opacity,
        "fill-outline-color": isSelected ? "#ffffff" : s.strokeColor,
      },
      layout: { visibility: "visible", ...zoom },
    }
    spec.line = {
      paint: {
        "line-color": s.strokeColor,
        "line-width": isSelected ? s.strokeWidth + 1 : s.strokeWidth,
        "line-opacity": Math.min(s.opacity + 0.4, 1),
        ...(s.strokeDashPattern ? { "line-dasharray": s.strokeDashPattern } : {}),
      },
      layout: { visibility: "visible", ...zoom },
    }
  }

  if (sym.kind === "line" || geom === "line") {
    const s = (sym.kind === "line" ? sym : null) as LineSymbol | null
    if (s) {
      spec.line = {
        paint: {
          "line-color": s.color,
          "line-width": isSelected ? s.width + 1 : s.width,
          "line-opacity": s.opacity,
          ...(s.dashPattern ? { "line-dasharray": s.dashPattern } : {}),
        },
        layout: {
          visibility: "visible",
          ...(s.cap ? { "line-cap": s.cap } : {}),
          ...(s.join ? { "line-join": s.join } : {}),
          ...zoom,
        },
      }
    }
  }

  if (sym.kind === "point" || geom === "point") {
    const s = (sym.kind === "point" ? sym : null) as PointSymbol | null
    if (s) {
      spec.circle = {
        paint: {
          "circle-radius": isSelected ? s.size + 1 : s.size,
          "circle-color": s.color,
          "circle-opacity": s.opacity,
          "circle-stroke-color": isSelected ? "#ffffff" : s.strokeColor,
          "circle-stroke-width": isSelected ? s.strokeWidth + 1 : s.strokeWidth,
        },
        layout: { visibility: "visible", ...zoom },
      }
    }
  }

  // Labels
  if (def.labeling?.enabled) {
    spec.symbol = labelToML(def.labeling)
  }

  return spec
}

// ── Categorized ───────────────────────────────────────────────────────

function categorizedToML(def: LayerStyleDef, geom: GeomFamily, isSelected: boolean): StyleSpec {
  const field = def.classField
  const cats = def.categories
  if (!field || !cats || cats.length === 0) return singleToML(def, geom, isSelected)

  const spec = emptySpec()
  const zoom = zoomLayout(def)

  // Build a match expression for each paint property
  const getField: unknown[] = ["get", field]

  if (geom === "polygon" || geom === "mixed") {
    const fillColors = buildMatchExpr(getField, cats, (c) => c.symbol.kind === "fill" ? (c.symbol as FillSymbol).color : "#888888")
    const fillOpacities = buildMatchExpr(getField, cats, (c) => c.symbol.kind === "fill" ? (c.symbol as FillSymbol).opacity : 0.4)
    const strokeColors = buildMatchExpr(getField, cats, (c) => c.symbol.kind === "fill" ? (c.symbol as FillSymbol).strokeColor : "#888888")

    spec.fill = {
      paint: {
        "fill-color": fillColors,
        "fill-opacity": fillOpacities,
        "fill-outline-color": isSelected ? "#ffffff" : strokeColors,
      },
      layout: { visibility: "visible", ...zoom },
    }
    spec.line = {
      paint: {
        "line-color": strokeColors,
        "line-width": isSelected ? 2.5 : 1.5,
        "line-opacity": 1,
      },
      layout: { visibility: "visible", ...zoom },
    }
  }

  if (geom === "line" || geom === "mixed") {
    const lineColors = buildMatchExpr(getField, cats, (c) => c.symbol.kind === "line" ? (c.symbol as LineSymbol).color : "#888888")
    const lineWidths = buildMatchExpr(getField, cats, (c) => c.symbol.kind === "line" ? (c.symbol as LineSymbol).width : 2)

    spec.line = {
      paint: {
        "line-color": lineColors,
        "line-width": isSelected ? ["+" as unknown, lineWidths, 1] : lineWidths,
        "line-opacity": 1,
      },
      layout: { visibility: "visible", ...zoom },
    }
  }

  if (geom === "point" || geom === "mixed") {
    const circleColors = buildMatchExpr(getField, cats, (c) => c.symbol.kind === "point" ? (c.symbol as PointSymbol).color : "#888888")
    const circleSizes = buildMatchExpr(getField, cats, (c) => c.symbol.kind === "point" ? (c.symbol as PointSymbol).size : 5)

    spec.circle = {
      paint: {
        "circle-radius": isSelected ? ["+" as unknown, circleSizes, 1] : circleSizes,
        "circle-color": circleColors,
        "circle-opacity": 0.85,
        "circle-stroke-color": isSelected ? "#ffffff" : "#333333",
        "circle-stroke-width": 1,
      },
      layout: { visibility: "visible", ...zoom },
    }
  }

  if (def.labeling?.enabled) {
    spec.symbol = labelToML(def.labeling)
  }

  return spec
}

// ── Graduated ─────────────────────────────────────────────────────────

function graduatedToML(def: LayerStyleDef, geom: GeomFamily, isSelected: boolean): StyleSpec {
  const field = def.graduatedField
  const classes = def.classes
  if (!field || !classes || classes.length === 0) return singleToML(def, geom, isSelected)

  const spec = emptySpec()
  const zoom = zoomLayout(def)
  const getField: unknown[] = ["get", field]

  // Build step expression: ["step", ["get", field], color0, break1, color1, break2, color2, ...]
  const buildStep = (extract: (c: GraduatedEntry) => MLValue): unknown[] => {
    const expr: unknown[] = ["step", getField]
    // Default (below first break)
    expr.push(extract(classes[0]))
    for (let i = 1; i < classes.length; i++) {
      expr.push(classes[i].lower)
      expr.push(extract(classes[i]))
    }
    return expr
  }

  if (geom === "polygon" || geom === "mixed") {
    spec.fill = {
      paint: {
        "fill-color": buildStep((c) => c.symbol.kind === "fill" ? (c.symbol as FillSymbol).color : "#888888"),
        "fill-opacity": buildStep((c) => c.symbol.kind === "fill" ? (c.symbol as FillSymbol).opacity : 0.4),
        "fill-outline-color": isSelected ? "#ffffff" : "#333333",
      },
      layout: { visibility: "visible", ...zoom },
    }
    spec.line = {
      paint: {
        "line-color": buildStep((c) => c.symbol.kind === "fill" ? (c.symbol as FillSymbol).strokeColor : "#888888"),
        "line-width": isSelected ? 2.5 : 1.5,
        "line-opacity": 1,
      },
      layout: { visibility: "visible", ...zoom },
    }
  }

  if (geom === "line" || geom === "mixed") {
    spec.line = {
      paint: {
        "line-color": buildStep((c) => c.symbol.kind === "line" ? (c.symbol as LineSymbol).color : "#888888"),
        "line-width": buildStep((c) => c.symbol.kind === "line" ? (c.symbol as LineSymbol).width : 2),
        "line-opacity": 1,
      },
      layout: { visibility: "visible", ...zoom },
    }
  }

  if (geom === "point" || geom === "mixed") {
    spec.circle = {
      paint: {
        "circle-radius": buildStep((c) => c.symbol.kind === "point" ? (c.symbol as PointSymbol).size : 5),
        "circle-color": buildStep((c) => c.symbol.kind === "point" ? (c.symbol as PointSymbol).color : "#888888"),
        "circle-opacity": 0.85,
        "circle-stroke-color": isSelected ? "#ffffff" : "#333333",
        "circle-stroke-width": 1,
      },
      layout: { visibility: "visible", ...zoom },
    }
  }

  if (def.labeling?.enabled) {
    spec.symbol = labelToML(def.labeling)
  }

  return spec
}

// ── Rule-based ────────────────────────────────────────────────────────

function ruleBasedToML(def: LayerStyleDef, geom: GeomFamily, isSelected: boolean): StyleSpec {
  const rules = def.rules?.filter((r) => r.enabled)
  if (!rules || rules.length === 0) return singleToML(def, geom, isSelected)

  // Rule-based uses ["case", cond1, val1, cond2, val2, ..., fallback]
  // We parse simple filter expressions into MapLibre boolean expressions
  const spec = emptySpec()
  const zoom = zoomLayout(def)

  const buildCase = (extract: (sym: SymbolDef) => MLValue, fallback: MLValue): unknown[] => {
    const expr: unknown[] = ["case"]
    for (const rule of rules) {
      const condition = parseFilterExpr(rule.filter)
      if (condition) {
        expr.push(condition)
        expr.push(extract(rule.symbol))
      }
    }
    expr.push(fallback) // fallback
    return expr
  }

  if (geom === "polygon" || geom === "mixed") {
    spec.fill = {
      paint: {
        "fill-color": buildCase((s) => s.kind === "fill" ? (s as FillSymbol).color : "#888888", "#888888"),
        "fill-opacity": buildCase((s) => s.kind === "fill" ? (s as FillSymbol).opacity : 0.4, 0.4),
        "fill-outline-color": isSelected ? "#ffffff" : "#333333",
      },
      layout: { visibility: "visible", ...zoom },
    }
  }

  if (geom === "line" || geom === "mixed") {
    spec.line = {
      paint: {
        "line-color": buildCase((s) => s.kind === "line" ? (s as LineSymbol).color : "#888888", "#888888"),
        "line-width": buildCase((s) => s.kind === "line" ? (s as LineSymbol).width : 2, 2),
        "line-opacity": 1,
      },
      layout: { visibility: "visible", ...zoom },
    }
  }

  if (geom === "point" || geom === "mixed") {
    spec.circle = {
      paint: {
        "circle-radius": buildCase((s) => s.kind === "point" ? (s as PointSymbol).size : 5, 5),
        "circle-color": buildCase((s) => s.kind === "point" ? (s as PointSymbol).color : "#888888", "#888888"),
        "circle-opacity": 0.85,
        "circle-stroke-color": isSelected ? "#ffffff" : "#333333",
        "circle-stroke-width": 1,
      },
      layout: { visibility: "visible", ...zoom },
    }
  }

  if (def.labeling?.enabled) {
    spec.symbol = labelToML(def.labeling)
  }

  return spec
}

// ── Label rendering ───────────────────────────────────────────────────

function labelToML(label: LabelDef): MapLibreLayerSpec {
  return {
    paint: {
      "text-color": label.color,
      ...(label.haloColor ? { "text-halo-color": label.haloColor } : {}),
      ...(label.haloWidth ? { "text-halo-width": label.haloWidth } : {}),
    },
    layout: {
      visibility: "visible",
      "text-field": ["get", label.field],
      "text-size": label.fontSize,
      ...(label.fontWeight === "bold" ? { "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"] } : {}),
      ...(label.offset ? { "text-offset": label.offset } : {}),
      ...(label.placement === "line" ? { "symbol-placement": "line" } : {}),
      "text-allow-overlap": false,
      ...(label.minZoom != null ? { "min-zoom": label.minZoom } : {}),
      ...(label.maxZoom != null ? { "max-zoom": label.maxZoom } : {}),
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function emptySpec(): StyleSpec {
  return { fill: null, line: null, circle: null, symbol: null }
}

function zoomLayout(def: LayerStyleDef): Record<string, number> {
  const out: Record<string, number> = {}
  if (def.minZoom != null) out["minzoom"] = def.minZoom
  if (def.maxZoom != null) out["maxzoom"] = def.maxZoom
  return out
}

/**
 * Build a MapLibre "match" expression from categories.
 * ["match", ["get", field], val1, result1, val2, result2, ..., fallback]
 */
function buildMatchExpr(
  getField: unknown[],
  cats: CategoryEntry[],
  extract: (c: CategoryEntry) => MLValue,
): unknown[] {
  const expr: unknown[] = ["match", getField]
  let fallback: MLValue = "#888888"

  for (const cat of cats) {
    if (cat.value === null) {
      // null category = fallback/default
      fallback = extract(cat)
    } else {
      expr.push(cat.value)
      expr.push(extract(cat))
    }
  }

  expr.push(fallback)
  return expr
}

/**
 * Parse a simple filter string into a MapLibre boolean expression.
 * Supports:  field = 'value'  |  field > N  |  field < N  |  field >= N  |  field <= N  |  field != 'value'
 */
function parseFilterExpr(filter: string): unknown[] | null {
  // Simple patterns: "field op value"
  const m = filter.match(/^(\w+)\s*(=|!=|>|<|>=|<=)\s*(?:'([^']*)'|"([^"]*)"|(\S+))$/)
  if (!m) return null

  const field = m[1]
  const op = m[2]
  const value = m[3] ?? m[4] ?? m[5]

  const numVal = Number(value)
  const val = !isNaN(numVal) && value !== "" ? numVal : value

  const opMap: Record<string, string> = {
    "=": "==",
    "!=": "!=",
    ">": ">",
    "<": "<",
    ">=": ">=",
    "<=": "<=",
  }

  return [opMap[op] ?? "==", ["get", field], val]
}
