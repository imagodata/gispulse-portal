/** Mirrors the backend Dataset + Layer metadata. */

export interface LayerField {
  name: string
  type: string // "int" | "float" | "str" | "datetime" | "bool"
}

export interface LayerMeta {
  name: string
  geometry_type: string | null
  feature_count: number
  bbox: [number, number, number, number]
  crs: string
  fields: LayerField[]
}

/** Parsed style info extracted from GPKG layer_styles table. */
export interface StyleMeta {
  layer_name: string
  style_name: string
  color: string | null
  opacity: number | null
  stroke_color: string | null
  stroke_width: number | null
}

export interface DatasetMeta {
  id: string
  name: string
  source_path: string
  format: string
  crs: string
  file_size: number
  layers: LayerMeta[]
  styles?: StyleMeta[]
  /** Full advanced style definitions keyed by layer name (from QGIS QML parsing). */
  style_defs?: Record<string, Record<string, unknown>>
  created_at: string
  /**
   * Dataset provenance:
   * - "project" (default) — a real dataset materialised on disk
   * - "session"           — a PostGIS-backed live session dataset
   * - "virtual"           — a lazy worldwide catalog entry, not yet
   *                         materialised (issue #238 / A12)
   */
  source_type?: "project" | "session" | "virtual"
  session_id?: string                   // set when source_type is "session"

  // ─── Virtual dataset fields (worldwide aggregator, #238) ─────────────────
  /** URI of the remote worldwide source backing a virtual dataset. */
  virtual_source_uri?: string
  /** Thematic data category of the virtual source. */
  data_category?: string
  /** Feature count of the previewed bbox; null until previewed. */
  feature_count?: number | null
  /** Bounding box used for the last preview/scan; null until previewed. */
  virtual_bbox?: number[] | null
  /** Worldwide catalog entry id this virtual dataset was created from. */
  catalog_entry?: string
}

export interface CapabilitySchema {
  name: string
  description: string
  json_schema: Record<string, unknown>
}
