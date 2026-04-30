/**
 * api/styles.ts — Layer style API client.
 *
 * Wraps v1.5 styling endpoints (imagodata/gispulse#41/#42/#43) and re-exports
 * the existing /distinct + /stats helpers from api/datasets.ts so style editors
 * have a single import surface.
 */

import { request, BASE } from "./request"
import { getDistinctValues, getFieldStats } from "./datasets"
import type { LayerStyleDef, ClassifyMethod, GeomFamily } from "@/types/layerStyle"

export type BreaksMethod = "jenks" | "quantile" | "equal_interval" | "std_dev" | "pretty"

export interface BreaksResult {
  field: string
  method: BreaksMethod
  n_classes: number
  breaks: number[]
  labels: string[]
}

export async function getBreaks(
  datasetId: string,
  layerName: string,
  field: string,
  method: BreaksMethod = "jenks",
  nClasses = 5,
): Promise<BreaksResult> {
  return request<BreaksResult>(
    `/datasets/${datasetId}/layers/${layerName}/breaks`,
    {
      method: "POST",
      body: JSON.stringify({ field, method, n_classes: nClasses }),
    },
  )
}

export interface PutStyleResult {
  layer_name: string
  qml_size_bytes: number
}

export async function putStyle(
  datasetId: string,
  layerName: string,
  styleDef: LayerStyleDef,
  geomType: GeomFamily | "polygon" | "point" | "line" = "polygon",
): Promise<PutStyleResult> {
  const normalisedGeom = geomType === "mixed" ? "polygon" : geomType
  return request<PutStyleResult>(`/datasets/${datasetId}/styles`, {
    method: "PUT",
    body: JSON.stringify({
      layer_name: layerName,
      style_def: styleDef,
      geom_type: normalisedGeom,
    }),
  })
}

export interface ImportQmlResult {
  layer_name: string
  style_def: LayerStyleDef
  qml_size_bytes: number
}

export async function importQml(
  datasetId: string,
  layerName: string,
  file: File,
  geomType: GeomFamily | "polygon" | "point" | "line" = "polygon",
): Promise<ImportQmlResult> {
  const normalisedGeom = geomType === "mixed" ? "polygon" : geomType
  const form = new FormData()
  form.append("layer_name", layerName)
  form.append("geom_type", normalisedGeom)
  form.append("file", file)

  const res = await fetch(`${BASE}/datasets/${datasetId}/styles/import`, {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`QML import failed (${res.status}): ${detail}`)
  }
  return res.json()
}

export async function exportQml(
  datasetId: string,
  layerName: string,
  filename?: string,
): Promise<Blob> {
  const styles = await request<{ styles: Array<{ f_table_name: string; styleQML: string }> }>(
    `/datasets/${datasetId}/styles`,
  )
  const match = styles.styles.find((s) => s.f_table_name === layerName)
  if (!match || !match.styleQML) {
    throw new Error(`No QML style found for layer "${layerName}"`)
  }
  const blob = new Blob([match.styleQML], { type: "application/xml" })
  if (filename && typeof window !== "undefined") {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  return blob
}

const _CLASSIFY_TO_BREAKS: Partial<Record<ClassifyMethod, BreaksMethod>> = {
  equal_interval: "equal_interval",
  quantile: "quantile",
  natural_breaks: "jenks",
  std_dev: "std_dev",
}

/**
 * Map a UI ClassifyMethod to the backend `/breaks` endpoint method.
 *
 * Returns `null` for `"manual"`, which signals the caller that no server
 * request should be issued — the breaks were edited by hand.
 */
export function classifyMethodToBreaksMethod(m: ClassifyMethod): BreaksMethod | null {
  return _CLASSIFY_TO_BREAKS[m] ?? null
}

export { getDistinctValues, getFieldStats }
export type { DistinctValuesResult, FieldStatsResult } from "./datasets"
