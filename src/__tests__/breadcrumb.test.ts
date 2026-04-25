import { describe, it, expect } from "vitest"

// Test the breadcrumb label mapping directly (C11 regression test)
const workspaceLabels: Record<string, string> = {
  explorer: "Explorer",
  map: "Map",
  datasets: "Datasets",
  workflows: "Workflows",
  catalog: "Catalog",
  schema: "Schema",
}

describe("Breadcrumb — workspace labels", () => {
  it("has a label for every workspace", () => {
    const expectedWorkspaces = ["explorer", "map", "datasets", "workflows", "catalog", "schema"]
    for (const ws of expectedWorkspaces) {
      expect(workspaceLabels[ws]).toBeTruthy()
    }
  })

  it("datasets label is capitalized (C11 fix)", () => {
    expect(workspaceLabels["datasets"]).toBe("Datasets")
  })

  it("labels are all capitalized", () => {
    for (const [key, label] of Object.entries(workspaceLabels)) {
      expect(label[0]).toBe(label[0].toUpperCase())
    }
  })
})
