/**
 * api/filter.ts — Filter API client functions.
 *
 * Backend mount: `/api/filter` (router carries its own `/api` prefix,
 * mounted at the origin root). Endpoints for the interactive
 * FilterPanel, now with chain, validate, and cache.
 *
 * Issue #108 (Realign 2.0): the base is now composed via
 * `getOriginBase()` so Mode 2 ("Connect your engine") routes filter
 * calls to the external backend instead of pinning to same-origin.
 */

import { getOriginBase, request } from "./request"

/**
 * Live resolver for the filter base — re-read at every call so a
 * `backendUrl` change is honoured immediately.
 */
function filterBase(): string {
  return `${getOriginBase()}/api/filter`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterRequest {
  dataset_id: string
  layer_name: string
  expression?: string | null
  spatial_predicate?: string | null
  ref_dataset_id?: string | null
  ref_layer_name?: string | null
  ref_wkt?: string | null
  ref_geojson?: Record<string, unknown> | null
  buffer_distance?: number | null
  limit?: number
}

export interface FilterChainRequest {
  dataset_id: string
  layer_name: string
  combination_strategy: string
  filters: FilterChainItem[]
  limit?: number
}

export interface FilterChainItem {
  type: string
  expression: string
  layer_name: string
  priority?: number
  operator?: string
  metadata?: Record<string, unknown>
}

export interface FilterPreviewResponse {
  count: number
  total: number
  bbox: [number, number, number, number] | null
  execution_time_ms: number
  is_cached: boolean
  backend: string
}

export interface FilterApplyResponse {
  type: "FeatureCollection"
  features: Record<string, unknown>[]
  total_count: number
  filtered_count: number
  bbox: [number, number, number, number] | null
  execution_time_ms: number
  is_cached: boolean
  backend: string
}

export interface FilterValidateResponse {
  is_valid: boolean
  errors: string[]
}

export interface CacheStatsResponse {
  hits: number
  misses: number
  size: number
  max_size: number
  hit_rate: number
  utilization: number
}

export interface SpatialPredicateInfo {
  id: string
  label: string
  description: string
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/** List available spatial predicates. */
export async function listPredicates(): Promise<SpatialPredicateInfo[]> {
  return request<SpatialPredicateInfo[]>("/predicates", undefined, filterBase())
}

/** Preview filter: count + bbox without returning features. */
export async function previewFilter(req: FilterRequest): Promise<FilterPreviewResponse> {
  return request<FilterPreviewResponse>("/preview", {
    method: "POST",
    body: JSON.stringify(req),
  }, filterBase())
}

/** Apply filter and return GeoJSON features. */
export async function applyFilter(req: FilterRequest): Promise<FilterApplyResponse> {
  return request<FilterApplyResponse>("/apply", {
    method: "POST",
    body: JSON.stringify(req),
  }, filterBase())
}

/** Apply a multi-step FilterChain. */
export async function applyChain(req: FilterChainRequest): Promise<FilterApplyResponse> {
  return request<FilterApplyResponse>("/chain", {
    method: "POST",
    body: JSON.stringify(req),
  }, filterBase())
}

/** Validate a filter expression without executing it. */
export async function validateExpression(expression: string): Promise<FilterValidateResponse> {
  return request<FilterValidateResponse>("/validate", {
    method: "POST",
    body: JSON.stringify({ expression }),
  }, filterBase())
}

/** Get filter cache statistics. */
export async function getCacheStats(): Promise<CacheStatsResponse> {
  return request<CacheStatsResponse>("/cache/stats", undefined, filterBase())
}

/** Clear filter cache (optionally for a specific layer). */
export async function clearCache(layerKey?: string): Promise<{ cleared: number }> {
  const params = layerKey ? `?layer_key=${encodeURIComponent(layerKey)}` : ""
  return request<{ cleared: number }>(`/cache${params}`, { method: "DELETE" }, filterBase())
}
