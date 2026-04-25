import { describe, it, expect, beforeEach } from "vitest"
import { useUIStore } from "@/stores/uiStore"

describe("uiStore", () => {
  beforeEach(() => {
    // Reset to defaults
    useUIStore.setState({
      workspaceId: "map",
      bottomTab: "table",
      bottomPanelOpen: true,
      activeSection: "layers",
      leftPanelOpen: true,
      inspectorOpen: true,
      contextSelection: { type: "none" },
      selectedLayers: new Set(),
      lastSelectedLayerKey: null,
    })
  })

  // ---- WorkspaceId ----

  it("defaults to map workspace", () => {
    expect(useUIStore.getState().workspaceId).toBe("map")
  })

  it("setWorkspaceId updates workspaceId", () => {
    useUIStore.getState().setWorkspaceId("workflows")
    expect(useUIStore.getState().workspaceId).toBe("workflows")
  })

  it("does not have mainView property (legacy removed)", () => {
    const state = useUIStore.getState() as Record<string, unknown>
    expect(state).not.toHaveProperty("mainView")
  })

  it("does not have setMainView action (legacy removed)", () => {
    const state = useUIStore.getState() as Record<string, unknown>
    expect(state).not.toHaveProperty("setMainView")
  })

  // ---- Panel toggles ----

  it("toggleLeftPanel toggles left panel", () => {
    expect(useUIStore.getState().leftPanelOpen).toBe(true)
    useUIStore.getState().toggleLeftPanel()
    expect(useUIStore.getState().leftPanelOpen).toBe(false)
    useUIStore.getState().toggleLeftPanel()
    expect(useUIStore.getState().leftPanelOpen).toBe(true)
  })

  it("toggleInspector toggles inspector", () => {
    expect(useUIStore.getState().inspectorOpen).toBe(true)
    useUIStore.getState().toggleInspector()
    expect(useUIStore.getState().inspectorOpen).toBe(false)
  })

  it("toggleBottomPanel toggles bottom panel", () => {
    expect(useUIStore.getState().bottomPanelOpen).toBe(true)
    useUIStore.getState().toggleBottomPanel()
    expect(useUIStore.getState().bottomPanelOpen).toBe(false)
  })

  it("setBottomTab switches tab and opens bottom panel", () => {
    useUIStore.getState().setBottomPanelOpen(false)
    useUIStore.getState().setBottomTab("sql")
    expect(useUIStore.getState().bottomTab).toBe("sql")
    expect(useUIStore.getState().bottomPanelOpen).toBe(true)
  })

  // ---- Activity sections ----

  it("setActiveSection opens left panel and switches section", () => {
    useUIStore.getState().setLeftPanelOpen(false)
    useUIStore.getState().setActiveSection("rules")
    expect(useUIStore.getState().activeSection).toBe("rules")
    expect(useUIStore.getState().leftPanelOpen).toBe(true)
  })

  it("setActiveSection toggles panel off if same section clicked while open", () => {
    // Switch to a non-default section first
    useUIStore.getState().setActiveSection("rules")
    expect(useUIStore.getState().activeSection).toBe("rules")
    expect(useUIStore.getState().leftPanelOpen).toBe(true)
    // Click same section again -> closes
    useUIStore.getState().setActiveSection("rules")
    expect(useUIStore.getState().leftPanelOpen).toBe(false)
  })

  // ---- Context selection ----

  it("setContextSelection updates selection", () => {
    useUIStore.getState().setContextSelection({ type: "layer", datasetId: "d1", layerName: "l1" })
    const sel = useUIStore.getState().contextSelection
    expect(sel.type).toBe("layer")
    if (sel.type === "layer") {
      expect(sel.datasetId).toBe("d1")
      expect(sel.layerName).toBe("l1")
    }
  })

  it("setContextSelection can set to none", () => {
    useUIStore.getState().setContextSelection({ type: "rule", ruleId: "r1" })
    useUIStore.getState().setContextSelection({ type: "none" })
    expect(useUIStore.getState().contextSelection.type).toBe("none")
  })

  // ---- Multi-layer selection ----

  it("toggleLayerInSelection adds and removes layers", () => {
    useUIStore.getState().toggleLayerInSelection("ds1::layer1")
    expect(useUIStore.getState().selectedLayers.has("ds1::layer1")).toBe(true)
    useUIStore.getState().toggleLayerInSelection("ds1::layer1")
    expect(useUIStore.getState().selectedLayers.has("ds1::layer1")).toBe(false)
  })

  it("clearLayerSelection empties the set", () => {
    useUIStore.getState().toggleLayerInSelection("a")
    useUIStore.getState().toggleLayerInSelection("b")
    useUIStore.getState().clearLayerSelection()
    expect(useUIStore.getState().selectedLayers.size).toBe(0)
  })

  it("setSelectedLayers replaces the entire selection", () => {
    useUIStore.getState().setSelectedLayers(["x", "y", "z"])
    expect(useUIStore.getState().selectedLayers.size).toBe(3)
    expect(useUIStore.getState().selectedLayers.has("y")).toBe(true)
  })

  // ---- Bookmarks ----

  it("addBookmark appends and generates id", () => {
    useUIStore.getState().addBookmark({
      name: "Test",
      center: [2.35, 48.85],
      zoom: 12,
      bearing: 0,
      pitch: 0,
    })
    const bm = useUIStore.getState().bookmarks
    expect(bm.length).toBeGreaterThanOrEqual(1)
    const last = bm[bm.length - 1]
    expect(last.name).toBe("Test")
    expect(last.id).toMatch(/^bm-/)
  })

  it("removeBookmark deletes by id", () => {
    const { addBookmark, removeBookmark } = useUIStore.getState()
    addBookmark({ name: "A", center: [0, 0], zoom: 1, bearing: 0, pitch: 0 })
    const id = useUIStore.getState().bookmarks[useUIStore.getState().bookmarks.length - 1].id
    removeBookmark(id)
    expect(useUIStore.getState().bookmarks.find((b) => b.id === id)).toBeUndefined()
  })
})
