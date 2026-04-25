import { describe, it, expect } from "vitest"
import {
  sampleRamp,
  pickQualitative,
  SEQUENTIAL_RAMPS,
  DIVERGING_RAMPS,
  QUALITATIVE_RAMPS,
  ALL_RAMPS,
  RAMP_BY_NAME,
} from "@/lib/colorRamps"

describe("colorRamps", () => {
  it("has at least 10 sequential ramps", () => {
    expect(SEQUENTIAL_RAMPS.length).toBeGreaterThanOrEqual(10)
  })

  it("has at least 5 diverging ramps", () => {
    expect(DIVERGING_RAMPS.length).toBeGreaterThanOrEqual(5)
  })

  it("has at least 4 qualitative ramps", () => {
    expect(QUALITATIVE_RAMPS.length).toBeGreaterThanOrEqual(4)
  })

  it("ALL_RAMPS is the union", () => {
    expect(ALL_RAMPS.length).toBe(
      SEQUENTIAL_RAMPS.length + DIVERGING_RAMPS.length + QUALITATIVE_RAMPS.length,
    )
  })

  it("RAMP_BY_NAME indexes all ramps", () => {
    expect(RAMP_BY_NAME.size).toBe(ALL_RAMPS.length)
    expect(RAMP_BY_NAME.get("Viridis")).toBeDefined()
    expect(RAMP_BY_NAME.get("Spectral")).toBeDefined()
    expect(RAMP_BY_NAME.get("Paired")).toBeDefined()
  })

  it("all ramps have valid hex colors", () => {
    for (const ramp of ALL_RAMPS) {
      expect(ramp.colors.length).toBeGreaterThanOrEqual(3)
      for (const c of ramp.colors) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })
})

describe("sampleRamp", () => {
  const viridis = RAMP_BY_NAME.get("Viridis")!

  it("returns empty for n=0", () => {
    expect(sampleRamp(viridis, 0)).toEqual([])
  })

  it("returns middle color for n=1", () => {
    const result = sampleRamp(viridis, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it("returns N colors for n=5", () => {
    const result = sampleRamp(viridis, 5)
    expect(result).toHaveLength(5)
    // First should be close to first ramp color, last close to last
    expect(result[0]).toBe(viridis.colors[0])
    expect(result[4]).toBe(viridis.colors[viridis.colors.length - 1])
  })

  it("returns all colors when n >= ramp length", () => {
    const result = sampleRamp(viridis, 100)
    expect(result).toHaveLength(viridis.colors.length)
  })

  it("interpolates intermediate colors", () => {
    const result = sampleRamp(viridis, 3)
    expect(result).toHaveLength(3)
    // Middle color should be different from both endpoints
    expect(result[1]).not.toBe(result[0])
    expect(result[1]).not.toBe(result[2])
  })
})

describe("pickQualitative", () => {
  const paired = RAMP_BY_NAME.get("Paired")!

  it("picks N distinct colors", () => {
    const result = pickQualitative(paired, 5)
    expect(result).toHaveLength(5)
    // All should be valid hex
    for (const c of result) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it("wraps around for large N", () => {
    const result = pickQualitative(paired, paired.colors.length + 2)
    expect(result).toHaveLength(paired.colors.length + 2)
    // First and (length+1)th should be the same (wrap)
    expect(result[paired.colors.length]).toBe(result[0])
  })

  it("returns empty for n=0", () => {
    expect(pickQualitative(paired, 0)).toEqual([])
  })
})
