/**
 * api/projects.ts — Projects, rules, triggers, jobs, stats, and activity API.
 *
 * Issue #194 (A7-S3): extracted from the monolithic client.ts.
 * Issue #108 (Realign 2.0): switched from `request(..., "")` to
 *   `originRequest()` so the five sibling routers mounted at the
 *   origin root (`/projects`, `/rules`, `/triggers`, `/jobs`) honour
 *   `settingsStore.backendUrl` in Mode 2.
 */

import { getOriginBase, originRequest } from "./request"
import type { Project, Rule, Trigger } from "@/types/project"

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
  const res = await originRequest<{ items: Project[]; total: number }>("/projects")
  return Array.isArray(res?.items) ? res.items : []
}

export async function createProject(
  name: string,
  description = "",
): Promise<Project> {
  return originRequest<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  })
}

export async function deleteProjectApi(id: string): Promise<void> {
  await originRequest(`/projects/${id}`, { method: "DELETE" })
}

// ---------------------------------------------------------------------------
// Project stats & activity
// ---------------------------------------------------------------------------

export interface ProjectStats {
  project_id: string
  dataset_count: number
  layer_count: number
  rule_count: number
  trigger_count: number
  scenario_count: number
  total_feature_count: number
  last_activity: string | null
}

export interface ActivityEventItem {
  id: string
  event_type: "dataset_import" | "rule_applied" | "trigger_fired" | "job_completed" | "project_created" | string
  title: string
  description: string | null
  status: "success" | "error" | "running" | "info"
  timestamp: string
  metadata: Record<string, unknown>
}

export interface ActivityResponse {
  project_id: string
  items: ActivityEventItem[]
  total: number
}

export async function getProjectStats(projectId: string): Promise<ProjectStats> {
  return originRequest<ProjectStats>(`/projects/${projectId}/stats`)
}

export async function getProjectActivity(
  projectId: string,
  limit = 20,
  offset = 0,
): Promise<ActivityResponse> {
  return originRequest<ActivityResponse>(
    `/projects/${projectId}/activity?limit=${limit}&offset=${offset}`,
  )
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export async function listRules(): Promise<Rule[]> {
  const res = await originRequest<{ items: Rule[] }>("/rules")
  return res.items
}

export async function createRuleApi(rule: Omit<Rule, "id">): Promise<Rule> {
  return originRequest<Rule>("/rules", {
    method: "POST",
    body: JSON.stringify(rule),
  })
}

export async function updateRuleApi(id: string, rule: Omit<Rule, "id">): Promise<Rule> {
  return originRequest<Rule>(`/rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(rule),
  })
}

export async function deleteRuleApi(id: string): Promise<void> {
  await originRequest(`/rules/${id}`, { method: "DELETE" })
}

export interface NodeDefinition {
  node_type: string
  capability: string
  label: string
  params: Record<string, unknown>
  rule_id: string | null
  rule_name: string | null
  description: string | null
}

export async function getRuleAsNode(ruleId: string): Promise<NodeDefinition> {
  return originRequest<NodeDefinition>(`/rules/${ruleId}/to-node`)
}

export async function createRuleFromNode(payload: {
  capability: string
  label: string
  params: Record<string, unknown>
  description?: string
  scope?: string
}): Promise<Rule> {
  return originRequest<Rule>("/rules/from-node", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

export async function listTriggers(): Promise<Trigger[]> {
  const res = await originRequest<{ items: Trigger[] }>("/triggers")
  return res.items
}

export async function createTriggerApi(trigger: Omit<Trigger, "id">): Promise<Trigger> {
  return originRequest<Trigger>("/triggers", {
    method: "POST",
    body: JSON.stringify(trigger),
  })
}

export async function updateTriggerApi(id: string, trigger: Omit<Trigger, "id">): Promise<Trigger> {
  return originRequest<Trigger>(`/triggers/${id}`, {
    method: "PUT",
    body: JSON.stringify(trigger),
  })
}

export async function deleteTriggerApi(id: string): Promise<void> {
  await originRequest(`/triggers/${id}`, { method: "DELETE" })
}

export async function toggleTriggerApi(id: string): Promise<Trigger> {
  return originRequest<Trigger>(`/triggers/${id}/toggle`, { method: "POST" })
}

export interface EvaluateChangeRecord {
  session_id?: string
  table_name: string
  feature_id?: string | null
  operation: "INSERT" | "UPDATE" | "DELETE"
  old_values?: Record<string, unknown>
  new_values?: Record<string, unknown>
}

export async function evaluateTriggerApi(
  triggerId: string,
  records: EvaluateChangeRecord[],
): Promise<import("@/types/project").FiredTriggerResult[]> {
  return originRequest(`/triggers/${triggerId}/evaluate`, {
    method: "POST",
    body: JSON.stringify({ records }),
  })
}

export function openEvalStream(
  triggerId: string,
  onEvent: (result: import("@/types/project").FiredTriggerResult) => void,
): EventSource {
  // EventSource is a separate transport — compose the origin manually
  // so Mode 2 routes to the external engine instead of same-origin.
  // We rely on `getOriginBase()` rather than `originRequest()` because
  // the EventSource constructor takes a URL, not a fetch wrapper.
  const url = `${getOriginBase()}/triggers/eval-stream?trigger_id=${triggerId}`
  const es = new EventSource(url)
  es.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === "trigger_fired") onEvent(msg.data)
    } catch {
      // ignore malformed
    }
  }
  return es
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export interface JobResponse {
  id: string
  name: string
  status: string
  dataset_id: string | null
  parameters: Record<string, unknown>
  created_at: string
  started_at: string | null
  completed_at: string | null
  result_path: string | null
  error_message: string | null
  duration_seconds: number | null
}

export async function createJob(payload: {
  name: string
  dataset_id?: string | null
  parameters?: Record<string, unknown>
}): Promise<JobResponse> {
  return originRequest<JobResponse>("/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function getJob(id: string): Promise<JobResponse> {
  return originRequest<JobResponse>(`/jobs/${id}`)
}
