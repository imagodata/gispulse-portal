import { describe, it, expect } from "vitest"
import { PANEL_WORKSPACES, workspaces, type WorkspaceId } from "@/router"

describe("router — workspace configuration", () => {
  it("defines 6 workspaces", () => {
    expect(workspaces).toHaveLength(6)
  })

  it("each workspace has id, path, and label", () => {
    for (const ws of workspaces) {
      expect(ws.id).toBeTruthy()
      expect(ws.path).toMatch(/^\//)
      expect(ws.label).toBeTruthy()
    }
  })

  it("workspace ids are unique", () => {
    const ids = workspaces.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("workspace paths are unique", () => {
    const paths = workspaces.map((w) => w.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it("PANEL_WORKSPACES contains exactly map, workflows, schema", () => {
    expect(PANEL_WORKSPACES.has("map")).toBe(true)
    expect(PANEL_WORKSPACES.has("workflows")).toBe(true)
    expect(PANEL_WORKSPACES.has("schema")).toBe(true)
    expect(PANEL_WORKSPACES.size).toBe(3)
  })

  it("PANEL_WORKSPACES does not include standalone workspaces", () => {
    const standalone: WorkspaceId[] = ["explorer", "datasets", "catalog"]
    for (const ws of standalone) {
      expect(PANEL_WORKSPACES.has(ws)).toBe(false)
    }
  })

  it("all PANEL_WORKSPACES entries are valid workspace ids", () => {
    const validIds = new Set(workspaces.map((w) => w.id))
    for (const ws of PANEL_WORKSPACES) {
      expect(validIds.has(ws)).toBe(true)
    }
  })
})
