/**
 * api/projects.ts — Projects, rules, triggers, jobs, stats, and activity API.
 *
 * Issue #194 (A7-S3): extracted from the monolithic client.ts.
 */

import { request } from "./request"
import type { Project, Rule, Trigger } from "@/types/project"

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
  const res = await request<{ items: Project[]; total: number }>("/projects", undefined, "")
  return Array.isArray(res?.items) ? res.items : []
}

export async function createProject(
  name: string,
  description = "",
): Promise<Project> {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  }, "")
}

export async function deleteProjectApi(id: string): Promise<void> {
  await request(`/projects/${id}`, { method: "DELETE" }, "")
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
  return request<ProjectStats>(`/projects/${projectId}/stats`, undefined, "")
}

export async function getProjectActivity(
  projectId: string,
  limit = 20,
  offset = 0,
): Promise<ActivityResponse> {
  return request<ActivityResponse>(
    `/projects/${projectId}/activity?limit=${limit}&offset=${offset}`,
    undefined,
    "",
  )
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export async function listRules(): Promise<Rule[]> {
  const res = await request<{ items: Rule[] }>("/rules", undefined, "")
  return res.items
}

export async function createRuleApi(rule: Omit<Rule, "id">): Promise<Rule> {
  return request<Rule>("/rules", {
    method: "POST",
    body: JSON.stringify(rule),
  }, "")
}

export async function updateRuleApi(id: string, rule: Omit<Rule, "id">): Promise<Rule> {
  return request<Rule>(`/rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(rule),
  }, "")
}

export async function deleteRuleApi(id: string): Promise<void> {
  await request(`/rules/${id}`, { method: "DELETE" }, "")
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
  return request<NodeDefinition>(`/rules/${ruleId}/to-node`, undefined, "")
}

export async function createRuleFromNode(payload: {
  capability: string
  label: string
  params: Record<string, unknown>
  description?: string
  scope?: string
}): Promise<Rule> {
  return request<Rule>("/rules/from-node", {
    method: "POST",
    body: JSON.stringify(payload),
  }, "")
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

export async function listTriggers(): Promise<Trigger[]> {
  const res = await request<{ items: Trigger[] }>("/triggers", undefined, "")
  return res.items
}

export async function createTriggerApi(trigger: Omit<Trigger, "id">): Promise<Trigger> {
  return request<Trigger>("/triggers", {
    method: "POST",
    body: JSON.stringify(trigger),
  }, "")
}

export async function updateTriggerApi(id: string, trigger: Omit<Trigger, "id">): Promise<Trigger> {
  return request<Trigger>(`/triggers/${id}`, {
    method: "PUT",
    body: JSON.stringify(trigger),
  }, "")
}

export async function deleteTriggerApi(id: string): Promise<void> {
  await request(`/triggers/${id}`, { method: "DELETE" }, "")
}

export async function toggleTriggerApi(id: string): Promise<Trigger> {
  return request<Trigger>(`/triggers/${id}/toggle`, { method: "POST" }, "")
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
  return request(`/triggers/${triggerId}/evaluate`, {
    method: "POST",
    body: JSON.stringify({ records }),
  }, "")
}

export function openEvalStream(
  triggerId: string,
  onEvent: (result: import("@/types/project").FiredTriggerResult) => void,
): EventSource {
  const url = `/triggers/eval-stream?trigger_id=${triggerId}`
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
  return request<JobResponse>("/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  }, "")
}

export async function getJob(id: string): Promise<JobResponse> {
  return request<JobResponse>(`/jobs/${id}`, undefined, "")
}
