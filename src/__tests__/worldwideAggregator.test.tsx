/**
 * worldwideAggregator.test — A12 / issue #238 (EPIC v1.9.0 #226).
 *
 * Covers the two acceptance criteria most easily unit-tested:
 *  1. The jurisdiction pre-filter on the worldwide catalog store narrows
 *     the gallery and re-fetches with the right filter.
 *  2. The "Materialize" button stays disabled until a bbox is drawn.
 *
 * MapLibre is mocked so the dialog can mount in happy-dom without a
 * real WebGL context.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

import { useCatalogStore } from "@/stores/catalogStore"
import { WorldwideMaterializeDialog } from "@/components/WorldwideMaterializeDialog"
import type { WorldwideEntry } from "@/types/catalog"
import type { DatasetMeta } from "@/types/dataset"

// ── Mocks ───────────────────────────────────────────────────────────────────

// maplibre-gl is a heavy WebGL dependency — stub it for the dialog's BBoxDrawMap.
vi.mock("maplibre-gl", () => ({
  Map: class {
    on() {}
    remove() {}
    addSource() {}
    addLayer() {}
    getSource() {}
    getCanvas() {
      return { style: {} }
    }
    isStyleLoaded() {
      return false
    }
    dragPan = { enable() {}, disable() {} }
  },
}))

// Mock the worldwide search API so the store does not hit a real backend.
const searchWorldwideMock = vi.fn()
vi.mock("@/api/client", async (orig) => {
  const actual = await orig<typeof import("@/api/client")>()
  return { ...actual, searchWorldwide: (...a: unknown[]) => searchWorldwideMock(...a) }
})

// ── Fixtures ────────────────────────────────────────────────────────────────

const ENTRY_FR: WorldwideEntry = {
  id: "wec:fr-cadastre",
  name: "Cadastre FR",
  domain: "cadastre",
  payload: "vector",
  jurisdiction: "FR",
  protocol: "ogc-features",
  family: "ign",
  endpoint: "https://example.org/fr",
  revision_token: "tok-fr",
  metadata: {},
}

const ENTRY_NL: WorldwideEntry = {
  ...ENTRY_FR,
  id: "wec:nl-buildings",
  name: "Buildings NL",
  domain: "buildings",
  jurisdiction: "NL",
  family: "pdok",
  endpoint: "https://example.org/nl",
  revision_token: "tok-nl",
}

const VIRTUAL: DatasetMeta = {
  id: "virtual:worldwide/wec:fr-cadastre",
  name: "Cadastre FR",
  source_path: "",
  format: "virtual",
  crs: "EPSG:4326",
  file_size: 0,
  layers: [],
  created_at: "2026-05-19T00:00:00Z",
  source_type: "virtual",
  virtual_source_uri: "https://example.org/fr",
  feature_count: null,
  virtual_bbox: null,
  catalog_entry: ENTRY_FR.id,
}

function resetStore() {
  useCatalogStore.setState({
    tab: "worldwide",
    search: "",
    loading: false,
    worldwide: [],
    worldwideFilters: {},
    virtualDatasets: {},
  })
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("worldwide aggregator — store jurisdiction filter (#238)", () => {
  beforeEach(() => {
    resetStore()
    searchWorldwideMock.mockReset()
  })

  it("setWorldwideFilters stores the jurisdiction pre-filter", () => {
    useCatalogStore.getState().setWorldwideFilters({ jurisdiction: "FR" })
    expect(useCatalogStore.getState().worldwideFilters.jurisdiction).toBe("FR")
  })

  it("setWorldwideFilters re-fetches with the jurisdiction when on the worldwide tab", () => {
    searchWorldwideMock.mockResolvedValue([ENTRY_FR])
    useCatalogStore.getState().setWorldwideFilters({ jurisdiction: "FR" })
    expect(searchWorldwideMock).toHaveBeenCalledTimes(1)
    const filters = searchWorldwideMock.mock.calls[0][0]
    expect(filters.jurisdiction).toBe("FR")
  })

  it("fetchWorldwide loads entries into the store", async () => {
    searchWorldwideMock.mockResolvedValue([ENTRY_FR, ENTRY_NL])
    await useCatalogStore.getState().fetchWorldwide()
    expect(useCatalogStore.getState().worldwide).toHaveLength(2)
  })

  it("upsert/removeVirtualDataset manage the virtual dataset map", () => {
    useCatalogStore.getState().upsertVirtualDataset(VIRTUAL)
    expect(useCatalogStore.getState().virtualDatasets[VIRTUAL.id]).toBeDefined()
    useCatalogStore.getState().removeVirtualDataset(VIRTUAL.id)
    expect(useCatalogStore.getState().virtualDatasets[VIRTUAL.id]).toBeUndefined()
  })
})

describe("WorldwideMaterializeDialog — bbox gating (#238)", () => {
  afterEach(() => cleanup())

  it("disables the Materialize button until a bbox is drawn", () => {
    render(
      <WorldwideMaterializeDialog
        entry={ENTRY_FR}
        virtual={VIRTUAL}
        onClose={() => {}}
        onPreviewed={() => {}}
        onMaterialized={() => {}}
      />,
    )
    const btn = screen.getByTestId("worldwide-materialize-btn")
    // No bbox set on first render → button must be disabled.
    expect(btn).toBeDisabled()
  })

  it("shows the draw-a-bbox hint when no bbox is set", () => {
    render(
      <WorldwideMaterializeDialog
        entry={ENTRY_FR}
        virtual={VIRTUAL}
        onClose={() => {}}
        onPreviewed={() => {}}
        onMaterialized={() => {}}
      />,
    )
    expect(
      screen.getByText(/bounding box|emprise/i),
    ).toBeInTheDocument()
  })
})
