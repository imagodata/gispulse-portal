/**
 * api/schedules.ts — Scheduled pipelines endpoints.
 *
 * Backend mount: `/schedules` (root, NOT `/api/portal`). Routes:
 *   POST/GET/PATCH/DELETE /schedules
 *   POST /schedules/{id}/run-now
 *   GET  /schedules/{id}/runs
 *
 * Issue #108 (Realign 2.0): switched from `request()` (which would
 * prefix `/api/portal/`) to `originRequest()` so URLs match the actual
 * router mount and Mode 2 honours `settingsStore.backendUrl`.
 */

import { originRequest } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduleStatus = "active" | "disabled" | "running" | "error"

export interface ScheduledPipeline {
  id: string
  name: string
  cron: string
  enabled: boolean
  status: ScheduleStatus
  dataset_id: string | null
  dataset_name: string | null
  rules: string[]
  last_run_at: string | null
  last_run_duration_ms: number | null
  last_run_status: "success" | "error" | null
  next_run_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateSchedulePayload {
  name: string
  cron: string
  enabled: boolean
  dataset_id?: string
  rules?: string[]
}

export interface UpdateSchedulePayload {
  name?: string
  cron?: string
  enabled?: boolean
  dataset_id?: string | null
  rules?: string[]
}

export interface RunResult {
  job_id: string
  started_at: string
}

export interface ScheduleRun {
  id: string
  schedule_id: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  status: "success" | "running" | "error"
  result: Record<string, unknown> | null
  error: string | null
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function listSchedules(): Promise<ScheduledPipeline[]> {
  return originRequest<ScheduledPipeline[]>("/schedules")
}

export async function getSchedule(id: string): Promise<ScheduledPipeline> {
  return originRequest<ScheduledPipeline>(`/schedules/${id}`)
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<ScheduledPipeline> {
  return originRequest<ScheduledPipeline>("/schedules", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateSchedule(
  id: string,
  payload: UpdateSchedulePayload,
): Promise<ScheduledPipeline> {
  return originRequest<ScheduledPipeline>(`/schedules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export async function deleteSchedule(id: string): Promise<void> {
  return originRequest<void>(`/schedules/${id}`, { method: "DELETE" })
}

export async function runNow(id: string): Promise<RunResult> {
  return originRequest<RunResult>(`/schedules/${id}/run-now`, { method: "POST" })
}

export async function listScheduleRuns(id: string): Promise<ScheduleRun[]> {
  return originRequest<ScheduleRun[]>(`/schedules/${id}/runs`)
}
