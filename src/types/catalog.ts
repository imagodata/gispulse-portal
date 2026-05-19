export type CatalogDomain = "projection" | "basemap" | "flux" | "opendata"
export type FluxProtocol = "wms" | "wfs" | "wmts" | "tms" | "xyz" | "ogc-features" | "ogc-tiles"

export interface CatalogEntry {
  id: string
  domain: CatalogDomain
  provider: string
  name: string
  description: string
  tags: string[]
  metadata: Record<string, unknown>
}

export interface ProjectionEntry extends CatalogEntry {
  epsg_code: number
  proj4: string
  area_of_use: string
  unit: string
  bounds: number[] | null
}

export interface BasemapEntry extends CatalogEntry {
  url_template: string
  protocol: FluxProtocol
  attribution: string
  max_zoom: number
}

export interface FluxEntry extends CatalogEntry {
  service_url: string
  protocol: FluxProtocol
  layer_name: string
  attribution: string
  default_crs: string
}

export interface OpenDataEntry extends CatalogEntry {
  source_url: string
  format: string
  license: string
  download_url: string | null
  update_frequency: string
  spatial_coverage: string
}

export interface CatalogProviderInfo {
  name: string
  domain: CatalogDomain
  description: string
  entry_count: number
}

// ---------------------------------------------------------------------------
// Worldwide aggregator (EPIC v1.9.0 #226 — issue #238 / A12)
//
// The worldwide catalog exposes geo-data sources from many jurisdictions
// (FR, NL, US, world, …) that can be consumed lazily as *virtual* datasets
// — no download until the user materialises a bounding box.
// ---------------------------------------------------------------------------

/** A single entry of the worldwide aggregated catalog. */
export interface WorldwideEntry {
  id: string
  name: string
  /** Thematic domain, e.g. "cadastre", "buildings", "transport". */
  domain: string
  /** Payload kind, e.g. "vector", "raster", "pointcloud". */
  payload: string
  /** ISO jurisdiction code or "world", e.g. "FR", "NL", "US". */
  jurisdiction: string
  /** Access protocol, e.g. "ogc-features", "wfs", "stac". */
  protocol: string
  /** Fetcher family, e.g. "overture", "ign", "pdok". */
  family: string
  endpoint: string
  revision_token: string
  metadata: Record<string, unknown>
}

/** Filters accepted by GET /api/catalog/worldwide (all optional). */
export interface WorldwideFilters {
  search?: string
  domain?: string
  payload?: string
  jurisdiction?: string
  protocol?: string
  family?: string
}
