/**
 * api/cocarteMaps.ts — Cocarte Map CRUD + restore + share-token rotation.
 *
 * Mirrors the backend router at `gispulse.adapters.http.routers.maps_router`.
 *
 * Issue imagodata/gispulse-portal#56 (Sprint 1.1 frontend half).
 */

import { request } from "./request"
import type {
  CocarteMap,
  CocarteMapCreateInput,
  CocarteMapUpdateInput,
} from "@/types/cocarteMap"

interface MapListEnvelope {
  items: CocarteMap[]
  total: number
  limit: number
  offset: number
}

export async function listMaps(opts?: {
  limit?: number
  offset?: number
  includeTrashed?: boolean
}): Promise<CocarteMap[]> {
  const params = new URLSearchParams()
  if (opts?.limit !== undefined) params.set("limit", String(opts.limit))
  if (opts?.offset !== undefined) params.set("offset", String(opts.offset))
  if (opts?.includeTrashed) params.set("include_trashed", "true")
  const qs = params.toString()
  const res = await request<MapListEnvelope>(
    `/maps${qs ? `?${qs}` : ""}`,
    undefined,
    "",
  )
  return Array.isArray(res?.items) ? res.items : []
}

export async function getMap(
  id: string,
  opts?: { includeTrashed?: boolean },
): Promise<CocarteMap> {
  const qs = opts?.includeTrashed ? "?include_trashed=true" : ""
  return request<CocarteMap>(`/maps/${id}${qs}`, undefined, "")
}

export async function createMap(
  input: CocarteMapCreateInput,
): Promise<CocarteMap> {
  return request<CocarteMap>(
    "/maps",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    "",
  )
}

export async function updateMap(
  id: string,
  patch: CocarteMapUpdateInput,
): Promise<CocarteMap> {
  return request<CocarteMap>(
    `/maps/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
    "",
  )
}

export async function deleteMap(id: string): Promise<void> {
  await request(`/maps/${id}`, { method: "DELETE" }, "")
}

export async function restoreMap(id: string): Promise<CocarteMap> {
  return request<CocarteMap>(`/maps/${id}/restore`, { method: "POST" }, "")
}

export async function rotateShareToken(id: string): Promise<CocarteMap> {
  return request<CocarteMap>(
    `/maps/${id}/rotate-token`,
    { method: "POST" },
    "",
  )
}
