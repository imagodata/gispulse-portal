/**
 * api/catalog.ts — Catalog (basemaps, flux, open data, projections) API.
 *
 * Issue #194 (A7-S3): extracted from the monolithic client.ts.
 * Issue #207 (A7-S6): signal support to cancel in-flight requests.
 */

import { isBackendAlive } from "./request"
import type {
  CatalogDomain,
  CatalogEntry,
  CatalogProviderInfo,
  BasemapEntry,
  ProjectionEntry,
  FluxEntry,
  OpenDataEntry,
} from "@/types/catalog"

const CATALOG = "/api/catalog"

async function catalogRequest<T>(
  path: string,
  fallback: T,
  signal?: AbortSignal,
): Promise<T> {
  if (!(await isBackendAlive())) return fallback
  try {
    const res = await fetch(`${CATALOG}${path}`, { signal })
    if (!res.ok) return fallback
    return res.json() as Promise<T>
  } catch (err) {
    // Re-throw AbortError so the caller can handle it (#207)
    if (err instanceof Error && err.name === "AbortError") throw err
    return fallback
  }
}

export async function listCatalogProviders(): Promise<CatalogProviderInfo[]> {
  return catalogRequest<CatalogProviderInfo[]>("/providers", [])
}

export async function searchProjections(
  search?: string,
  signal?: AbortSignal,
  tags?: string,
): Promise<ProjectionEntry[]> {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (tags) params.set("tags", tags)
  const qs = params.toString() ? `?${params}` : ""
  return catalogRequest<ProjectionEntry[]>(`/projections${qs}`, [], signal)
}

let _basemapPromise: Promise<BasemapEntry[]> | null = null

export function getCachedBasemaps(): Promise<BasemapEntry[]> {
  if (!_basemapPromise) _basemapPromise = searchBasemaps()
  return _basemapPromise
}

export async function searchBasemaps(
  search?: string,
  signal?: AbortSignal,
): Promise<BasemapEntry[]> {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  const qs = params.toString() ? `?${params}` : ""
  return catalogRequest<BasemapEntry[]>(`/basemaps${qs}`, [], signal)
}

export async function searchFlux(
  search?: string,
  signal?: AbortSignal,
  protocol?: string,
  provider?: string,
): Promise<FluxEntry[]> {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (protocol) params.set("protocol", protocol)
  if (provider) params.set("provider", provider)
  const qs = params.toString() ? `?${params}` : ""
  return catalogRequest<FluxEntry[]>(`/flux${qs}`, [], signal)
}

export async function searchOpenData(
  search?: string,
  signal?: AbortSignal,
  provider?: string,
): Promise<OpenDataEntry[]> {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  if (provider) params.set("provider", provider)
  const qs = params.toString() ? `?${params}` : ""
  return catalogRequest<OpenDataEntry[]>(`/opendata${qs}`, [], signal)
}

export async function searchCatalog(
  q: string,
  domain?: CatalogDomain,
): Promise<CatalogEntry[]> {
  const params = new URLSearchParams({ q })
  if (domain) params.set("domain", domain)
  return catalogRequest<CatalogEntry[]>(`/search?${params}`, [])
}

export async function getCatalogEntry(entryId: string): Promise<CatalogEntry | null> {
  return catalogRequest<CatalogEntry | null>(`/entry/${entryId}`, null)
}

// ---------------------------------------------------------------------------
// Catalog import — fetch remote data and materialise as local dataset
// ---------------------------------------------------------------------------

export interface CatalogImportParams {
  entry_id: string
  bbox?: [number, number, number, number] | null
  crs?: string
  max_features?: number | null
  name?: string | null
}

export interface CatalogImportResult {
  id: string
  name: string
  source_path?: string
  format?: string
  crs?: string
  feature_count?: number
  file_size?: number
  layers?: Array<Record<string, unknown>>
  styles?: Array<Record<string, unknown>>
  created_at?: string
  catalog_entry?: string
  bbox?: number[] | null
  /** For raster flux entries, indicates this is an external layer (no download) */
  type?: "external_layer"
  protocol?: string
  service_url?: string
  layer_name?: string
  message?: string
}

export async function importFromCatalog(
  params: CatalogImportParams,
): Promise<CatalogImportResult> {
  const res = await fetch(`${CATALOG}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Catalog import failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<CatalogImportResult>
}
