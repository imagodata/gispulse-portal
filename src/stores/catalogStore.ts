import { create } from "zustand"
import type { CatalogDomain } from "@/types/catalog"

// Debounce timer for catalog search (#202)
let _searchDebounceTimer: ReturnType<typeof setTimeout> | undefined

// AbortController to cancel in-flight fetches when a new one starts (#207)
let _fetchAbortController: AbortController | undefined
import type {
  BasemapEntry,
  ProjectionEntry,
  FluxEntry,
  OpenDataEntry,
  CatalogProviderInfo,
  WorldwideEntry,
  WorldwideFilters,
} from "@/types/catalog"
import type { DatasetMeta } from "@/types/dataset"
import {
  searchProjections,
  searchBasemaps,
  searchFlux,
  searchOpenData,
  listCatalogProviders,
  searchWorldwide,
} from "@/api/client"

/**
 * Catalog tabs. "worldwide" (issue #238 / A12) is an extra tab beyond the
 * four canonical catalog domains — it browses the global aggregated catalog.
 */
export type CatalogTab = CatalogDomain | "worldwide"

/** Detected spatial context from loaded datasets */
export interface SpatialContext {
  epsgCodes: string[]       // unique CRS codes, e.g. ["EPSG:2154", "EPSG:4326"]
  bbox: [number, number, number, number] | null // merged extent [W,S,E,N] in WGS84
  country: string | null    // inferred from extent
}

interface CatalogState {
  tab: CatalogTab
  search: string
  loading: boolean
  projections: ProjectionEntry[]
  basemaps: BasemapEntry[]
  flux: FluxEntry[]
  opendata: OpenDataEntry[]
  providers: CatalogProviderInfo[]

  // Worldwide aggregator (#238 / A12)
  worldwide: WorldwideEntry[]
  /** Pre-filter applied to the worldwide tab (jurisdiction, domain, …). */
  worldwideFilters: WorldwideFilters
  /** Virtual datasets created from worldwide entries, keyed by virtual id. */
  virtualDatasets: Record<string, DatasetMeta>

  // Smart context
  spatialContext: SpatialContext

  setTab: (tab: CatalogTab) => void
  setSearch: (q: string) => void
  fetchTab: (tab?: CatalogTab, search?: string) => Promise<void>
  fetchProviders: () => Promise<void>
  setSpatialContext: (ctx: SpatialContext) => void

  // Worldwide actions (#238 / A12)
  setWorldwideFilters: (filters: WorldwideFilters) => void
  fetchWorldwide: (search?: string) => Promise<void>
  upsertVirtualDataset: (ds: DatasetMeta) => void
  removeVirtualDataset: (virtualId: string) => void
}

/** Infer a country hint from a WGS84 bounding box */
function inferCountry(bbox: [number, number, number, number] | null): string | null {
  if (!bbox) return null
  const [w, s, e, n] = bbox
  const cx = (w + e) / 2
  const cy = (s + n) / 2
  // France metropolitaine rough bounds
  if (cx >= -5.5 && cx <= 10 && cy >= 41 && cy <= 51.5) return "france"
  // Belgique
  if (cx >= 2.5 && cx <= 6.5 && cy >= 49.5 && cy <= 51.6) return "belgique"
  // Suisse
  if (cx >= 5.9 && cx <= 10.5 && cy >= 45.8 && cy <= 47.9) return "suisse"
  // Luxembourg
  if (cx >= 5.7 && cx <= 6.5 && cy >= 49.4 && cy <= 50.2) return "luxembourg"
  return null
}

/** Infer country from EPSG code */
function inferCountryFromEpsg(code: string): string | null {
  const num = parseInt(code.replace(/\D/g, ""), 10)
  if (!num) return null
  // Lambert 93 / RGF93
  if ([2154, 3942, 3943, 3944, 3945, 3946, 3947, 3948, 3949, 3950].includes(num)) return "france"
  // Lambert 72 BE
  if ([31370, 3812].includes(num)) return "belgique"
  // CH1903+
  if ([2056, 21781].includes(num)) return "suisse"
  // Luxembourg
  if (num === 2169) return "luxembourg"
  return null
}

export function detectSpatialContext(
  datasets: { crs: string; layers: { bbox: [number, number, number, number]; crs: string }[] }[],
): SpatialContext {
  const epsgSet = new Set<string>()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let hasBbox = false

  for (const ds of datasets) {
    if (ds.crs) epsgSet.add(ds.crs)
    for (const l of ds.layers) {
      if (l.crs) epsgSet.add(l.crs)
      const [w, s, e, n] = l.bbox
      if (w !== 0 || s !== 0 || e !== 0 || n !== 0) {
        minX = Math.min(minX, w)
        minY = Math.min(minY, s)
        maxX = Math.max(maxX, e)
        maxY = Math.max(maxY, n)
        hasBbox = true
      }
    }
  }

  const epsgCodes = Array.from(epsgSet)
  const bbox: [number, number, number, number] | null = hasBbox ? [minX, minY, maxX, maxY] : null

  // Infer country: try bbox first, then EPSG
  let country = inferCountry(bbox)
  if (!country) {
    for (const code of epsgCodes) {
      country = inferCountryFromEpsg(code)
      if (country) break
    }
  }

  return { epsgCodes, bbox, country }
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  tab: "basemap",
  search: "",
  loading: false,
  projections: [],
  basemaps: [],
  flux: [],
  opendata: [],
  providers: [],
  worldwide: [],
  worldwideFilters: {},
  virtualDatasets: {},
  spatialContext: { epsgCodes: [], bbox: null, country: null },

  setTab: (tab) => {
    set({ tab })
    get().fetchTab(tab, get().search)
  },

  setSearch: (q) => {
    set({ search: q })
    // Debounce API call 300ms to avoid hammering server on every keystroke (#202)
    clearTimeout(_searchDebounceTimer)
    _searchDebounceTimer = setTimeout(() => {
      get().fetchTab(get().tab, q)
    }, 300)
  },

  fetchTab: async (tab, search) => {
    const t = tab ?? get().tab
    const q = search ?? get().search

    // Cancel any in-flight fetch before launching a new one (#207)
    _fetchAbortController?.abort()
    _fetchAbortController = new AbortController()
    const { signal } = _fetchAbortController

    set({ loading: true })
    try {
      switch (t) {
        case "projection":
          set({ projections: await searchProjections(q || undefined, signal) })
          break
        case "basemap":
          set({ basemaps: await searchBasemaps(q || undefined, signal) })
          break
        case "flux":
          set({ flux: await searchFlux(q || undefined, signal) })
          break
        case "opendata":
          set({ opendata: await searchOpenData(q || undefined, signal) })
          break
        case "worldwide": {
          const filters: WorldwideFilters = {
            ...get().worldwideFilters,
            search: q || undefined,
          }
          set({ worldwide: await searchWorldwide(filters, signal) })
          break
        }
      }
    } catch (err) {
      // AbortError is expected when a newer fetch supersedes this one — silence it
      if (err instanceof Error && err.name === "AbortError") return
      console.error("Catalog fetch failed:", err)
    } finally {
      if (!signal.aborted) set({ loading: false })
    }
  },

  fetchProviders: async () => {
    try {
      const providers = await listCatalogProviders()
      set({ providers })
    } catch {
      set({ providers: [] })
    }
  },

  setSpatialContext: (ctx) => set({ spatialContext: ctx }),

  // ─── Worldwide aggregator (#238 / A12) ──────────────────────────────────

  setWorldwideFilters: (filters) => {
    set({ worldwideFilters: filters })
    // Re-fetch immediately so the gallery reflects the new pre-filter.
    if (get().tab === "worldwide") {
      get().fetchWorldwide(get().search)
    }
  },

  fetchWorldwide: async (search) => {
    const q = search ?? get().search

    // Cancel any in-flight fetch before launching a new one (#207)
    _fetchAbortController?.abort()
    _fetchAbortController = new AbortController()
    const { signal } = _fetchAbortController

    set({ loading: true })
    try {
      const filters: WorldwideFilters = {
        ...get().worldwideFilters,
        search: q || undefined,
      }
      set({ worldwide: await searchWorldwide(filters, signal) })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      console.error("Worldwide catalog fetch failed:", err)
    } finally {
      if (!signal.aborted) set({ loading: false })
    }
  },

  upsertVirtualDataset: (ds) =>
    set((s) => ({ virtualDatasets: { ...s.virtualDatasets, [ds.id]: ds } })),

  removeVirtualDataset: (virtualId) =>
    set((s) => {
      const next = { ...s.virtualDatasets }
      delete next[virtualId]
      return { virtualDatasets: next }
    }),
}))
