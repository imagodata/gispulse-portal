import { describe, it, expect } from "vitest"
import { styleToMaplibre } from "@/lib/styleConverter"
import type { LayerStyleDef, FillSymbol, LineSymbol, PointSymbol } from "@/types/layerStyle"

describe("styleToMaplibre", () => {
  describe("single symbol", () => {
    it("converts fill symbol for polygon", () => {
      const def: LayerStyleDef = {
        renderer: "single",
        symbol: {
          kind: "fill",
          color: "#3b82f6",
          opacity: 0.5,
          strokeColor: "#000000",
          strokeWidth: 2,
        },
      }
      const spec = styleToMaplibre(def, "polygon")
      expect(spec.fill).not.toBeNull()
      expect(spec.fill!.paint["fill-color"]).toBe("#3b82f6")
      expect(spec.fill!.paint["fill-opacity"]).toBe(0.5)
      expect(spec.line).not.toBeNull()
      expect(spec.line!.paint["line-color"]).toBe("#000000")
    })

    it("converts point symbol for point", () => {
      const def: LayerStyleDef = {
        renderer: "single",
        symbol: {
          kind: "point",
          shape: "circle",
          size: 8,
          color: "#ef4444",
          opacity: 0.9,
          strokeColor: "#ffffff",
          strokeWidth: 1,
        },
      }
      const spec = styleToMaplibre(def, "point")
      expect(spec.circle).not.toBeNull()
      expect(spec.circle!.paint["circle-radius"]).toBe(8)
      expect(spec.circle!.paint["circle-color"]).toBe("#ef4444")
    })

    it("converts line symbol for line", () => {
      const def: LayerStyleDef = {
        renderer: "single",
        symbol: {
          kind: "line",
          color: "#22c55e",
          width: 3,
          opacity: 1,
          dashPattern: [8, 4],
          cap: "round",
          join: "miter",
        },
      }
      const spec = styleToMaplibre(def, "line")
      expect(spec.line).not.toBeNull()
      expect(spec.line!.paint["line-color"]).toBe("#22c55e")
      expect(spec.line!.paint["line-width"]).toBe(3)
      expect(spec.line!.paint["line-dasharray"]).toEqual([8, 4])
      expect(spec.line!.layout["line-cap"]).toBe("round")
    })

    it("applies selection highlight", () => {
      const def: LayerStyleDef = {
        renderer: "single",
        symbol: { kind: "point", shape: "circle", size: 5, color: "#3b82f6", opacity: 0.85, strokeColor: "#fff", strokeWidth: 1 },
      }
      const normal = styleToMaplibre(def, "point", false)
      const selected = styleToMaplibre(def, "point", true)
      expect(selected.circle!.paint["circle-radius"]).toBeGreaterThan(normal.circle!.paint["circle-radius"] as number)
      expect(selected.circle!.paint["circle-stroke-color"]).toBe("#ffffff")
    })
  })

  describe("categorized", () => {
    it("generates match expression", () => {
      const def: LayerStyleDef = {
        renderer: "categorized",
        classField: "type",
        categories: [
          { value: "A", label: "A", symbol: { kind: "fill", color: "#ff0000", opacity: 0.5, strokeColor: "#ff0000", strokeWidth: 1 } },
          { value: "B", label: "B", symbol: { kind: "fill", color: "#0000ff", opacity: 0.5, strokeColor: "#0000ff", strokeWidth: 1 } },
          { value: null, label: "Other", symbol: { kind: "fill", color: "#888888", opacity: 0.5, strokeColor: "#888888", strokeWidth: 1 } },
        ],
      }
      const spec = styleToMaplibre(def, "polygon")
      expect(spec.fill).not.toBeNull()
      const fillColor = spec.fill!.paint["fill-color"] as unknown[]
      expect(fillColor[0]).toBe("match")
      // Should contain the field getter
      expect(fillColor[1]).toEqual(["get", "type"])
      // Should contain values and colors
      expect(fillColor).toContain("A")
      expect(fillColor).toContain("#ff0000")
    })
  })

  describe("graduated", () => {
    it("generates step expression", () => {
      const def: LayerStyleDef = {
        renderer: "graduated",
        graduatedField: "pop",
        classes: [
          { lower: 0, upper: 100, label: "0-100", symbol: { kind: "fill", color: "#ffffcc", opacity: 0.5, strokeColor: "#ffffcc", strokeWidth: 1 } },
          { lower: 100, upper: 500, label: "100-500", symbol: { kind: "fill", color: "#fd8d3c", opacity: 0.5, strokeColor: "#fd8d3c", strokeWidth: 1 } },
          { lower: 500, upper: 1000, label: "500-1k", symbol: { kind: "fill", color: "#800026", opacity: 0.5, strokeColor: "#800026", strokeWidth: 1 } },
        ],
      }
      const spec = styleToMaplibre(def, "polygon")
      expect(spec.fill).not.toBeNull()
      const fillColor = spec.fill!.paint["fill-color"] as unknown[]
      expect(fillColor[0]).toBe("step")
      expect(fillColor[1]).toEqual(["get", "pop"])
    })
  })

  describe("labels", () => {
    it("generates symbol layer for labels", () => {
      const def: LayerStyleDef = {
        renderer: "single",
        symbol: { kind: "fill", color: "#3b82f6", opacity: 0.5, strokeColor: "#3b82f6", strokeWidth: 1 },
        labeling: {
          enabled: true,
          field: "name",
          color: "#333333",
          fontSize: 12,
          haloColor: "#ffffff",
          haloWidth: 1,
        },
      }
      const spec = styleToMaplibre(def, "polygon")
      expect(spec.symbol).not.toBeNull()
      expect(spec.symbol!.layout["text-field"]).toEqual(["get", "name"])
      expect(spec.symbol!.layout["text-size"]).toBe(12)
      expect(spec.symbol!.paint["text-color"]).toBe("#333333")
      expect(spec.symbol!.paint["text-halo-color"]).toBe("#ffffff")
    })

    it("does not generate symbol layer when labeling disabled", () => {
      const def: LayerStyleDef = {
        renderer: "single",
        symbol: { kind: "fill", color: "#3b82f6", opacity: 0.5, strokeColor: "#3b82f6", strokeWidth: 1 },
        labeling: { enabled: false, field: "name", color: "#000", fontSize: 10 },
      }
      const spec = styleToMaplibre(def, "polygon")
      expect(spec.symbol).toBeNull()
    })
  })

  describe("scale visibility", () => {
    it("sets minzoom/maxzoom in layout", () => {
      const def: LayerStyleDef = {
        renderer: "single",
        symbol: { kind: "fill", color: "#3b82f6", opacity: 0.5, strokeColor: "#3b82f6", strokeWidth: 1 },
        minZoom: 5,
        maxZoom: 15,
      }
      const spec = styleToMaplibre(def, "polygon")
      expect(spec.fill!.layout["minzoom"]).toBe(5)
      expect(spec.fill!.layout["maxzoom"]).toBe(15)
    })
  })

  describe("empty/fallback", () => {
    it("returns empty spec for missing symbol", () => {
      const def: LayerStyleDef = { renderer: "single" }
      const spec = styleToMaplibre(def, "polygon")
      expect(spec.fill).toBeNull()
      expect(spec.line).toBeNull()
      expect(spec.circle).toBeNull()
    })
  })
})
