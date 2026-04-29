/**
 * api/datasets.ts — Dataset, feature, and SQL API functions.
 *
 * Issue #194 (A7-S3): extracted from the monolithic client.ts.
 */

import { request, isBackendAlive, BASE } from "./request"
import { useJobStore } from "@/stores/jobStore"
import type { DatasetMeta, CapabilitySchema, StyleMeta } from "@/types/dataset"

/** Thrown when an uploaded file matches an already-imported dataset (HTTP 409). */
export class DuplicateDatasetError extends Error {
  readonly existingId: string
  readonly existingName: string
  readonly hash: string

  constructor(existingId: string, existingName: string, hash: string) {
    super(`Duplicate: "${existingName}" already imported`)
    this.name = "DuplicateDatasetError"
    this.existingId = existingId
    this.existingName = existingName
    this.hash = hash
  }
}

/** Generic GeoJSON FeatureCollection shape (avoids @types/geojson dep). */
export interface FeatureCollection {
  type: "FeatureCollection"
  features: Array<Record<string, unknown>>
  total_count?: number
}

// ---------------------------------------------------------------------------
// Dataset source type helpers (#159)
// ---------------------------------------------------------------------------

export function isProjectDataset(ds: DatasetMeta): boolean {
  return ds.source_type === "project" || !ds.source_type
}

export function isSessionDataset(ds: DatasetMeta): boolean {
  return ds.source_type === "session"
}

/** Upload a spatial file and get dataset metadata back. */
export async function uploadDataset(file: File, force = false): Promise<DatasetMeta> {
  const jobId = `upload-${Date.now()}`
  const { addJob, updateJob, removeJob } = useJobStore.getState()
  addJob({ id: jobId, title: file.name, status: "running" })

  const form = new FormData()
  form.append("file", file)
  const url = force ? `${BASE}/datasets/upload?force=true` : `${BASE}/datasets/upload`
  try {
    const res = await fetch(url, {
      method: "POST",
      body: form,
    })
    if (res.status === 409) {
      removeJob(jobId)
      const body = await res.json().catch(() => ({}))
      throw new DuplicateDatasetError(
        body.existing_id ?? "",
        body.existing_name ?? file.name,
        body.hash ?? "",
      )
    }
    if (!res.ok) {
      const text = await res.text()
      updateJob(jobId, { status: "error", errorMessage: `Upload failed ${res.status}: ${text}` })
      throw new Error(`Upload failed ${res.status}: ${text}`)
    }
    const data = await res.json() as DatasetMeta
    updateJob(jobId, { status: "done" })
    setTimeout(() => removeJob(jobId), 3000)
    return data
  } catch (err) {
    if (useJobStore.getState().jobs.find((j) => j.id === jobId)?.status === "running") {
      updateJob(jobId, { status: "error", errorMessage: String(err) })
    }
    throw err
  }
}

/** List all loaded datasets (with full layer metadata). */
export async function listDatasets(): Promise<DatasetMeta[]> {
  const res = await request<{ items: DatasetMeta[] }>("/datasets")
  return res.items
}

/** Delete a dataset and its files. */
export async function deleteDatasetApi(id: string): Promise<void> {
  await request(`/datasets/${id}`, { method: "DELETE" })
}

/** Rename a dataset. */
export async function renameDatasetApi(id: string, name: string): Promise<void> {
  await request(`/datasets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  })
}

/** Fetch parsed styles (color, opacity) from a GPKG dataset. */
export async function getDatasetStyles(id: string): Promise<StyleMeta[]> {
  const res = await request<{ styles: StyleMeta[] }>(`/datasets/${id}/styles`)
  return res.styles
}

/** Export selected layers as a multi-layer GPKG with styles. */
export async function exportGpkg(
  layers: { datasetId: string; layerName: string; color?: string; opacity?: number; styleDef?: Record<string, unknown>; geomType?: string }[],
  filename?: string,
): Promise<void> {
  if (!(await isBackendAlive())) throw new Error("Backend unavailable")
  const res = await fetch(`${BASE}/datasets/export-gpkg`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layers, filename }),
  })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename || "export.gpkg"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Export selected layers in any supported format. */
export async function exportLayers(
  layers: { datasetId: string; layerName: string; color?: string; opacity?: number }[],
  format: string = "gpkg",
  filename?: string,
): Promise<void> {
  if (!(await isBackendAlive())) throw new Error("Backend unavailable")
  const res = await fetch(`${BASE}/datasets/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layers, format, filename }),
  })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const ext = format === "geojson" ? ".geojson" : format === "parquet" ? ".parquet" : `.${format}`
  a.download = filename || `export${ext}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Import a remote dataset from a URL (catalog download). */
export async function importDatasetFromUrl(
  url: string,
  name?: string,
): Promise<DatasetMeta> {
  const jobId = `import-${Date.now()}`
  const label = name ?? url.split("/").pop() ?? url
  const { addJob, updateJob, removeJob } = useJobStore.getState()
  addJob({ id: jobId, title: label, status: "running" })

  try {
    const res = await fetch(`${BASE}/datasets/import-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, name }),
    })
    if (!res.ok) {
      const text = await res.text()
      updateJob(jobId, { status: "error", errorMessage: `Import failed ${res.status}: ${text}` })
      throw new Error(`Import failed ${res.status}: ${text}`)
    }
    const data = await res.json() as DatasetMeta
    updateJob(jobId, { status: "done" })
    setTimeout(() => removeJob(jobId), 3000)
    return data
  } catch (err) {
    if (useJobStore.getState().jobs.find((j) => j.id === jobId)?.status === "running") {
      updateJob(jobId, { status: "error", errorMessage: String(err) })
    }
    throw err
  }
}

/** Get GeoJSON features for a dataset layer. */
export async function getFeatures(
  datasetId: string,
  layerName: string,
  opts?: { bbox?: string; limit?: number; offset?: number; simplify?: number },
): Promise<FeatureCollection> {
  const params = new URLSearchParams()
  if (opts?.bbox) params.set("bbox", opts.bbox)
  if (opts?.limit) params.set("limit", String(opts.limit))
  if (opts?.offset) params.set("offset", String(opts.offset))
  if (opts?.simplify) params.set("simplify", String(opts.simplify))
  const qs = params.toString() ? `?${params}` : ""
  return request<FeatureCollection>(
    `/datasets/${datasetId}/layers/${layerName}/features${qs}`,
  )
}

/** List available capabilities with their JSON schemas. */
export async function listCapabilities(): Promise<CapabilitySchema[]> {
  return request<CapabilitySchema[]>("/capabilities")
}

// ---------------------------------------------------------------------------
// Feature editing
// ---------------------------------------------------------------------------

interface GeoJSONGeometry {
  type: string
  coordinates: number[] | number[][] | number[][][] | number[][][][]
}

/** Create a new feature on a dataset layer. */
export async function createFeature(
  layerName: string,
  geometry: GeoJSONGeometry,
  properties: Record<string, unknown> = {},
): Promise<{ fid: number; status: string }> {
  if (!(await isBackendAlive())) throw new Error("Backend unavailable")
  const res = await fetch(`${BASE}/features/${encodeURIComponent(layerName)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "Feature", geometry, properties }),
  })
  if (!res.ok) throw new Error(`Create failed: ${res.status}`)
  return res.json()
}

/** Delete a feature by layer name and fid. */
export async function deleteFeature(
  layerName: string,
  fid: number,
): Promise<{ fid: number; status: string }> {
  if (!(await isBackendAlive())) throw new Error("Backend unavailable")
  const res = await fetch(
    `${BASE}/features/${encodeURIComponent(layerName)}/${fid}`,
    { method: "DELETE" },
  )
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
  return res.json()
}

/** Update a feature's properties and/or geometry. */
export async function updateFeatureApi(
  datasetId: string,
  layerName: string,
  fid: number,
  body: { properties?: Record<string, unknown>; geometry?: Record<string, unknown> },
): Promise<{ updated: boolean; feature: Record<string, unknown> }> {
  return request(`/datasets/${datasetId}/layers/${encodeURIComponent(layerName)}/features/${fid}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

/** Execute a SQL query with full paginated results. */
export async function sqlExecute(body: {
  sql: string
  params?: Record<string, string>
  limit?: number
  offset?: number
  dsn?: string
}): Promise<{
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  error?: string
}> {
  return request("/sql/execute", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/** Export SQL query results as a downloadable file. */
export async function sqlExport(body: {
  sql: string
  params?: Record<string, string>
  format?: "geojson" | "csv" | "gpkg"
  filename?: string
  dsn?: string
}): Promise<void> {
  if (!(await isBackendAlive())) throw new Error("Backend unavailable")
  const res = await fetch(`${BASE}/sql/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`SQL export failed: ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const ext = body.format ?? "geojson"
  a.download = (body.filename ?? "export") + "." + ext
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 5000)
}

/** Execute a SQL preview query. */
export interface SQLPreviewResult {
  columns: string[]
  rows: Record<string, unknown>[]
  error: string | null
}

export async function previewSQL(
  sql: string,
  params: Record<string, string> = {},
  limit = 10,
  dsn?: string,
): Promise<SQLPreviewResult> {
  return request<SQLPreviewResult>("/capabilities/sql-preview", {
    method: "POST",
    body: JSON.stringify({ sql, params, limit, dsn }),
  })
}

// ---------------------------------------------------------------------------
// Style classification helpers (for categorized / graduated editors)
// ---------------------------------------------------------------------------

export interface DistinctValuesResult {
  field: string
  count: number
  values: (string | number)[]
}

export async function getDistinctValues(
  datasetId: string,
  layerName: string,
  field: string,
  limit = 500,
): Promise<DistinctValuesResult> {
  return request<DistinctValuesResult>(
    `/datasets/${datasetId}/layers/${layerName}/distinct/${field}?limit=${limit}`,
  )
}

export interface FieldStatsResult {
  field: string
  count: number
  min: number
  max: number
  mean: number
  std: number
  quantiles: Record<string, number>
}

export async function getFieldStats(
  datasetId: string,
  layerName: string,
  field: string,
): Promise<FieldStatsResult> {
  return request<FieldStatsResult>(
    `/datasets/${datasetId}/layers/${layerName}/stats/${field}`,
  )
}
