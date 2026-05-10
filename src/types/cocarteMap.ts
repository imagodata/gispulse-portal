/**
 * Cocarte Map entity types — mirrors `core.models.CocarteMap` on the backend.
 *
 * Naming: the class is `CocarteMap` (not `Map`) to avoid shadowing the JS
 * built-in `globalThis.Map`. The store, API client, and components follow
 * the same convention.
 *
 * Issue imagodata/gispulse-portal#56 (Sprint 1.1 frontend half).
 */

export type MapVisibility = "private" | "unlisted" | "public"

export interface CocarteMapViewState {
  center: [number, number]
  zoom: number
  basemap: string
  bearing?: number
  pitch?: number
}

export type ClassificationMethod = "jenks" | "equal_interval" | "quantile"

export interface ClassificationParams {
  method: ClassificationMethod
  classes: number
  attribute: string
}

export interface CocarteLayerConfig {
  id: string
  source_ref: string
  preset: "choropleth" | "bubble" | "heatmap" | "raw"
  classification?: ClassificationParams
  visible: boolean
}

export interface CocarteMap {
  id: string
  slug: string
  project_id: string | null
  owner_id: string | null
  title: string
  description: string
  visibility: MapVisibility
  share_token: string | null
  view_state: CocarteMapViewState | Record<string, unknown>
  layers: CocarteLayerConfig[] | Record<string, unknown>[]
  style_overrides: Record<string, unknown>
  snapshot_uri: string | null
  published_at: string | null
  template_origin_id: string | null
  deleted_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** Public viewer projection — strips owner_id and share_token. Sprint 1.2. */
export interface CocarteMapPublic {
  id: string
  slug: string
  title: string
  description: string
  visibility: MapVisibility
  view_state: CocarteMapViewState | Record<string, unknown>
  layers: CocarteLayerConfig[] | Record<string, unknown>[]
  style_overrides: Record<string, unknown>
  snapshot_uri: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CocarteMapCreateInput {
  title: string
  description?: string
  project_id?: string
}

export interface CocarteMapUpdateInput {
  title?: string
  description?: string
  visibility?: MapVisibility
  view_state?: CocarteMapViewState | Record<string, unknown>
  layers?: CocarteLayerConfig[] | Record<string, unknown>[]
  style_overrides?: Record<string, unknown>
  metadata?: Record<string, unknown>
}
