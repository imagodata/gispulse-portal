/** Project, Rule, and Trigger types matching backend models. */

export interface Project {
  id: string
  name: string
  description: string
  schema_name: string
  engine_backend: string
  datasets: string[]
  rules: string[]
  triggers: string[]
  created_at: string
}

export interface Rule {
  id: string
  name: string
  description: string
  scope: string
  capability: string
  config: Record<string, unknown>
  enabled: boolean
}

export interface Trigger {
  id: string
  name: string
  description?: string
  event: string
  trigger_type: string
  category?: string
  severity?: string
  rule_id: string | null
  conditions: Record<string, unknown>
  enabled: boolean
  auto_eval?: boolean
}

export interface Scenario {
  id: string
  project_id: string
  name: string
  description?: string
  status: "draft" | "active" | "archived"
  node_count: number
  edge_count: number
  last_run?: {
    at: string
    duration_ms: number
    status: "success" | "failed"
  }
  created_at: string
  updated_at: string
}

export interface FiredTriggerResult {
  id: string
  trigger_id: string
  change_record_id: string | null
  matched: boolean
  actions_dispatched: string[]
  eval_time_ms: number
  result_summary: Record<string, unknown>
  cascade_depth: number
  fired_at: string
}

export interface LayerVisibility {
  visible: boolean
  opacity: number
  color: string
  strokeColor?: string
  strokeWidth?: number
  displayName?: string
}

export type BasemapId = string

export interface BasemapDef {
  id: string
  name: string
  url: string | null
  attribution: string
}

/**
 * Offline fallback basemaps. The full catalog is loaded asynchronously
 * from the backend via getCachedBasemaps() and merged in BasemapSwitcher
 * and MapView. This list ensures the app works without a backend.
 */
export const BASEMAPS: BasemapDef[] = [
  {
    id: "osm",
    name: "OpenStreetMap",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  {
    id: "satellite",
    name: "Satellite (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri, Maxar, Earthstar Geographics",
  },
  {
    id: "dark",
    name: "Dark (CartoDB)",
    url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
    attribution: "&copy; CartoDB",
  },
  {
    id: "topo",
    name: "Topo (OpenTopoMap)",
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenTopoMap",
  },
  {
    id: "ign-plan",
    name: "IGN Plan v2",
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    attribution: "&copy; IGN G\u00e9oplateforme",
  },
  {
    id: "ign-ortho",
    name: "IGN Ortho HR",
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
    attribution: "&copy; IGN G\u00e9oplateforme",
  },
  {
    id: "none",
    name: "No basemap",
    url: null,
    attribution: "",
  },
]
