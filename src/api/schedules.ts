/**
 * api/schedules.ts — Scheduled pipelines endpoints.
 *
 * Routes: POST/GET/PATCH/DELETE /schedules, POST /schedules/{id}/run-now
 */

import { getOriginBase, request } from "./request"

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

//
// `schedules_router` is mounted at the application root with its own
// `/schedules` prefix — NOT under `/api/portal`. Every call passes
// `getOriginBase()` to bypass the `/api/portal` suffix while still
// honoring a Mode 2 custom backend URL.

export async function listSchedules(): Promise<ScheduledPipeline[]> {
  return request<ScheduledPipeline[]>("/schedules", undefined, getOriginBase())
}

export async function getSchedule(id: string): Promise<ScheduledPipeline> {
  return request<ScheduledPipeline>(`/schedules/${id}`, undefined, getOriginBase())
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<ScheduledPipeline> {
  return request<ScheduledPipeline>(
    "/schedules",
    { method: "POST", body: JSON.stringify(payload) },
    getOriginBase(),
  )
}

export async function updateSchedule(
  id: string,
  payload: UpdateSchedulePayload,
): Promise<ScheduledPipeline> {
  return request<ScheduledPipeline>(
    `/schedules/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    getOriginBase(),
  )
}

export async function deleteSchedule(id: string): Promise<void> {
  return request<void>(`/schedules/${id}`, { method: "DELETE" }, getOriginBase())
}

export async function runNow(id: string): Promise<RunResult> {
  return request<RunResult>(`/schedules/${id}/run-now`, { method: "POST" }, getOriginBase())
}

export async function listScheduleRuns(id: string): Promise<ScheduleRun[]> {
  return request<ScheduleRun[]>(`/schedules/${id}/runs`, undefined, getOriginBase())
}
