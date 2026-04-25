import { describe, it, expect } from "vitest"
import {
  geomFamily,
  fromLegacyStyle,
  defaultSymbol,
  defaultPointSymbol,
  defaultLineSymbol,
  defaultFillSymbol,
} from "@/types/layerStyle"

describe("geomFamily", () => {
  it("detects point types", () => {
    expect(geomFamily("Point")).toBe("point")
    expect(geomFamily("MultiPoint")).toBe("point")
    expect(geomFamily("POINT")).toBe("point")
  })

  it("detects line types", () => {
    expect(geomFamily("LineString")).toBe("line")
    expect(geomFamily("MultiLineString")).toBe("line")
  })

  it("detects polygon types", () => {
    expect(geomFamily("Polygon")).toBe("polygon")
    expect(geomFamily("MultiPolygon")).toBe("polygon")
  })

  it("returns mixed for null/unknown", () => {
    expect(geomFamily(null)).toBe("mixed")
    expect(geomFamily("GeometryCollection")).toBe("mixed")
    expect(geomFamily("")).toBe("mixed")
  })
})

describe("defaultSymbol", () => {
  it("creates point symbol for point geom", () => {
    const sym = defaultSymbol("point")
    expect(sym.kind).toBe("point")
    expect((sym as any).shape).toBe("circle")
  })

  it("creates line symbol for line geom", () => {
    const sym = defaultSymbol("line")
    expect(sym.kind).toBe("line")
  })

  it("creates fill symbol for polygon geom", () => {
    const sym = defaultSymbol("polygon")
    expect(sym.kind).toBe("fill")
  })

  it("creates fill symbol for mixed geom", () => {
    const sym = defaultSymbol("mixed")
    expect(sym.kind).toBe("fill")
  })

  it("uses custom color", () => {
    const sym = defaultSymbol("point", "#ff0000")
    expect((sym as any).color).toBe("#ff0000")
  })
})

describe("fromLegacyStyle", () => {
  it("converts to point symbol for point geom", () => {
    const def = fromLegacyStyle({ color: "#3b82f6", opacity: 0.8 }, "point")
    expect(def.renderer).toBe("single")
    expect(def.symbol?.kind).toBe("point")
    expect((def.symbol as any).color).toBe("#3b82f6")
    expect((def.symbol as any).opacity).toBe(0.8)
  })

  it("converts to line symbol for line geom", () => {
    const def = fromLegacyStyle({ color: "#ef4444", opacity: 1, strokeColor: "#000000", strokeWidth: 3 }, "line")
    expect(def.renderer).toBe("single")
    expect(def.symbol?.kind).toBe("line")
    expect((def.symbol as any).color).toBe("#000000") // strokeColor takes precedence for lines
    expect((def.symbol as any).width).toBe(3)
  })

  it("converts to fill symbol for polygon geom", () => {
    const def = fromLegacyStyle({ color: "#22c55e", opacity: 0.5, strokeColor: "#000000", strokeWidth: 2 }, "polygon")
    expect(def.renderer).toBe("single")
    expect(def.symbol?.kind).toBe("fill")
    expect((def.symbol as any).color).toBe("#22c55e")
    expect((def.symbol as any).strokeColor).toBe("#000000")
    expect((def.symbol as any).strokeWidth).toBe(2)
  })

  it("uses defaults for missing stroke values", () => {
    const def = fromLegacyStyle({ color: "#3b82f6", opacity: 0.7 }, "polygon")
    expect((def.symbol as any).strokeColor).toBe("#3b82f6")
    expect((def.symbol as any).strokeWidth).toBe(1.5)
  })
})
