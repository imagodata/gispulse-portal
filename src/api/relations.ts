/**
 * api/relations.ts — TableRelation CRUD, triggers, computed fields.
 *
 * Hybrid Schema (Phase 2): persisted relations between layers with
 * optional triggers and auto-computation fields.
 */

import { request } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComputedField {
  name: string
  expression: string
  target_field: string
  agg_function: string | null
  source_field: string | null
  refresh_mode: "on_change" | "on_schedule" | "manual"
  cron: string | null
}

export interface TableRelation {
  id: string
  source_layer_id: string | null
  target_layer_id: string | null
  source_layer_name: string
  target_layer_name: string
  relation_type: "fk" | "spatial" | "attribute" | "custom"
  source_field: string | null
  target_field: string | null
  spatial_op: string | null
  spatial_config: Record<string, unknown>
  confidence: number
  confirmed: boolean
  auto_detected: boolean
  label: string
  trigger_id: string | null
  computed_fields: ComputedField[]
  created_at: string
  updated_at: string
}

export interface RelationCreate {
  source_layer_id?: string | null
  target_layer_id?: string | null
  source_layer_name?: string
  target_layer_name?: string
  relation_type?: string
  source_field?: string | null
  target_field?: string | null
  spatial_op?: string | null
  spatial_config?: Record<string, unknown>
  confidence?: number
  confirmed?: boolean
  label?: string
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listRelations(params?: {
  layer_id?: string
  relation_type?: string
  has_trigger?: boolean
  confirmed?: boolean
}): Promise<TableRelation[]> {
  const qs = new URLSearchParams()
  if (params?.layer_id) qs.set("layer_id", params.layer_id)
  if (params?.relation_type) qs.set("relation_type", params.relation_type)
  if (params?.has_trigger !== undefined) qs.set("has_trigger", String(params.has_trigger))
  if (params?.confirmed !== undefined) qs.set("confirmed", String(params.confirmed))
  const query = qs.toString()
  return request<TableRelation[]>(`/relations${query ? `?${query}` : ""}`, undefined, "")
}

export async function getRelation(id: string): Promise<TableRelation> {
  return request<TableRelation>(`/relations/${id}`, undefined, "")
}

export async function createRelation(data: RelationCreate): Promise<TableRelation> {
  return request<TableRelation>("/relations", {
    method: "POST",
    body: JSON.stringify(data),
  }, "")
}

export async function updateRelation(
  id: string,
  data: Partial<RelationCreate>,
): Promise<TableRelation> {
  return request<TableRelation>(`/relations/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }, "")
}

export async function deleteRelation(id: string): Promise<void> {
  return request(`/relations/${id}`, { method: "DELETE" }, "")
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function confirmRelation(id: string): Promise<TableRelation> {
  return request<TableRelation>(`/relations/${id}/confirm`, { method: "POST" }, "")
}

export async function attachTrigger(id: string, triggerId: string): Promise<TableRelation> {
  return request<TableRelation>(`/relations/${id}/attach-trigger`, {
    method: "POST",
    body: JSON.stringify({ trigger_id: triggerId }),
  }, "")
}

export async function detachTrigger(id: string): Promise<TableRelation> {
  return request<TableRelation>(`/relations/${id}/detach-trigger`, { method: "POST" }, "")
}

export async function addComputation(
  id: string,
  data: {
    name: string
    expression: string
    target_field?: string
    agg_function?: string | null
    source_field?: string | null
    refresh_mode?: string
    cron?: string | null
  },
): Promise<TableRelation> {
  return request<TableRelation>(`/relations/${id}/add-computation`, {
    method: "POST",
    body: JSON.stringify(data),
  }, "")
}

export async function removeComputation(id: string, fieldName: string): Promise<TableRelation> {
  return request<TableRelation>(`/relations/${id}/computed/${fieldName}`, {
    method: "DELETE",
  }, "")
}

export async function previewSQL(id: string): Promise<{ relation_id: string; sql_statements: string[] }> {
  return request(`/relations/${id}/preview-sql`, undefined, "")
}

export async function detectRelationsApi(): Promise<TableRelation[]> {
  return request<TableRelation[]>("/relations/detect", { method: "POST" }, "")
}
