import { describe, it, expect } from "vitest"

import { formatBadgeClass, formatBytes, formatNumber } from "@/lib/geo-display"

describe("formatBadgeClass", () => {
  it("returns the format-specific class for a known format", () => {
    expect(formatBadgeClass("gpkg")).toContain("emerald")
    expect(formatBadgeClass("GeoJSON")).toContain("orange")
  })

  it("returns the muted fallback for an unknown format", () => {
    expect(formatBadgeClass("xyz")).toBe("bg-muted text-muted-foreground")
  })

  it("returns the muted fallback when the format is missing", () => {
    // Regression: backend can omit `format` on freshly-uploaded datasets;
    // the explorer view used to crash with `Cannot read properties of null
    // (reading 'toLowerCase')` (#2026-05-02 production console error).
    expect(formatBadgeClass(null)).toBe("bg-muted text-muted-foreground")
    expect(formatBadgeClass(undefined)).toBe("bg-muted text-muted-foreground")
    expect(formatBadgeClass("")).toBe("bg-muted text-muted-foreground")
  })
})

describe("formatBytes", () => {
  it("returns 0 B for zero", () => {
    expect(formatBytes(0)).toBe("0 B")
  })

  it("formats kilobytes and megabytes", () => {
    expect(formatBytes(1024)).toBe("1 KB")
    expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB")
  })
})

describe("formatNumber", () => {
  it("compacts thousands and millions", () => {
    expect(formatNumber(999)).toBe("999")
    expect(formatNumber(1500)).toBe("1.5K")
    expect(formatNumber(2_500_000)).toBe("2.5M")
  })
})
