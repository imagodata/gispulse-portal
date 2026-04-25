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
  source_type?: "project" | "session"  // defaults to "project"
  session_id?: string                   // set when source_type is "session"
}

export interface CapabilitySchema {
  name: string
  description: string
  json_schema: Record<string, unknown>
}
