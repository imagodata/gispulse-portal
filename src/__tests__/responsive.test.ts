import { describe, it, expect } from "vitest"
import { PANEL_WORKSPACES, workspaces } from "@/router"

describe("PANEL_WORKSPACES consistency", () => {
  it("schema gets panel toggles (C8 regression test)", () => {
    expect(PANEL_WORKSPACES.has("schema")).toBe(true)
  })

  it("contains exactly map, workflows, schema", () => {
    expect(PANEL_WORKSPACES.size).toBe(3)
    expect(PANEL_WORKSPACES.has("map")).toBe(true)
    expect(PANEL_WORKSPACES.has("workflows")).toBe(true)
    expect(PANEL_WORKSPACES.has("schema")).toBe(true)
  })

  it("does not include standalone workspaces", () => {
    expect(PANEL_WORKSPACES.has("explorer" as never)).toBe(false)
    expect(PANEL_WORKSPACES.has("datasets" as never)).toBe(false)
    expect(PANEL_WORKSPACES.has("catalog" as never)).toBe(false)
  })

  it("all panel workspaces are valid workspace ids", () => {
    const ids = new Set(workspaces.map((w) => w.id))
    for (const pw of PANEL_WORKSPACES) {
      expect(ids.has(pw)).toBe(true)
    }
  })
})
