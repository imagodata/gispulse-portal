import { describe, it, expect, beforeEach } from "vitest"
import { useSceneStore, type SceneSnapshot } from "@/stores/sceneStore"

const MOCK_SNAPSHOT: SceneSnapshot = {
  layerVisibility: {},
  layerOrder: ["ds1::layer1"],
  layerGroups: {},
  basemap: "osm",
  mainView: "map",
  bottomPanelOpen: true,
}

describe("sceneStore", () => {
  beforeEach(() => {
    // Clear all scenes
    const scenes = useSceneStore.getState().scenes
    for (const s of scenes) {
      useSceneStore.getState().deleteScene(s.id)
    }
  })

  it("starts with loaded scenes (may be empty)", () => {
    expect(Array.isArray(useSceneStore.getState().scenes)).toBe(true)
  })

  it("saveScene creates a scene with generated id", () => {
    const scene = useSceneStore.getState().saveScene("Test Scene", MOCK_SNAPSHOT)
    expect(scene.id).toMatch(/^scene-/)
    expect(scene.name).toBe("Test Scene")
    expect(scene.snapshot).toEqual(MOCK_SNAPSHOT)
    expect(scene.createdAt).toBeGreaterThan(0)
  })

  it("saveScene auto-names when name is empty", () => {
    const scene = useSceneStore.getState().saveScene("", MOCK_SNAPSHOT)
    expect(scene.name).toMatch(/^Scene \d+/)
  })

  it("deleteScene removes scene by id", () => {
    const scene = useSceneStore.getState().saveScene("To Delete", MOCK_SNAPSHOT)
    useSceneStore.getState().deleteScene(scene.id)
    expect(useSceneStore.getState().scenes.find((s) => s.id === scene.id)).toBeUndefined()
  })

  it("renameScene updates name", () => {
    const scene = useSceneStore.getState().saveScene("Original", MOCK_SNAPSHOT)
    useSceneStore.getState().renameScene(scene.id, "Renamed")
    const updated = useSceneStore.getState().scenes.find((s) => s.id === scene.id)
    expect(updated?.name).toBe("Renamed")
  })

  it("renameScene with empty string keeps original name", () => {
    const scene = useSceneStore.getState().saveScene("Keep This", MOCK_SNAPSHOT)
    useSceneStore.getState().renameScene(scene.id, "  ")
    const updated = useSceneStore.getState().scenes.find((s) => s.id === scene.id)
    expect(updated?.name).toBe("Keep This")
  })

  it("snapshot mainView accepts WorkspaceId values", () => {
    const snapshot: SceneSnapshot = { ...MOCK_SNAPSHOT, mainView: "workflows" }
    const scene = useSceneStore.getState().saveScene("Workflows", snapshot)
    expect(scene.snapshot.mainView).toBe("workflows")
  })
})
