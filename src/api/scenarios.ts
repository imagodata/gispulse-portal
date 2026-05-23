/**
 * api/scenarios.ts — Scenarios (Workflows) API.
 *
 * Issue #194 (A7-S3): extracted from the monolithic client.ts.
 * Sprint W1: added listScenarios, deleteScenario for Workflow Manager.
 * Issue #108 (Realign 2.0): switched to `originRequest` — backend
 *   mounts the router at `/scenarios` (root, NOT `/api/portal`). Now
 *   honours `settingsStore.backendUrl` for Mode 2.
 */

import { originRequest } from "./request"
import type { ScenarioGraph } from "@/lib/graphSerializer"

export interface ScenarioResponse {
  id: string
  name: string
  dataset_id: string | null
  jobs: string[]
  rules: string[]
  metadata: Record<string, unknown>
  created_at: string
  version: number
}

export interface ScenarioListResponse {
  items: ScenarioResponse[]
  total: number
  limit: number
  offset: number
}

export interface NodeResult {
  node_id: string
  status: string
  duration_ms: number
  output_count?: number
  error?: string
}

export interface ScenarioRunResult {
  scenario_id: string
  status: string
  node_results: NodeResult[]
  duration_ms: number
}

export interface RunNodeResult {
  node_id: string
  scenario_id: string
  status: "success" | "failed"
  duration_ms: number
  output_count: number | null
  error: string | null
}

export async function listScenarios(
  limit = 50,
  offset = 0,
): Promise<ScenarioListResponse> {
  return originRequest<ScenarioListResponse>(
    `/scenarios?limit=${limit}&offset=${offset}`,
  )
}

export async function createScenario(graph: ScenarioGraph): Promise<ScenarioResponse> {
  return originRequest<ScenarioResponse>("/scenarios", {
    method: "POST",
    body: JSON.stringify(graph),
  })
}

export async function getScenario(id: string): Promise<ScenarioResponse> {
  return originRequest<ScenarioResponse>(`/scenarios/${id}`)
}

export async function updateScenario(
  id: string,
  graph: ScenarioGraph,
): Promise<ScenarioResponse> {
  return originRequest<ScenarioResponse>(`/scenarios/${id}`, {
    method: "PUT",
    body: JSON.stringify(graph),
  })
}

export async function deleteScenario(id: string): Promise<void> {
  return originRequest<void>(`/scenarios/${id}`, {
    method: "DELETE",
  })
}

export async function runScenario(id: string): Promise<ScenarioRunResult> {
  return originRequest<ScenarioRunResult>(`/scenarios/${id}/run`, {
    method: "POST",
  })
}

export async function runScenarioNode(
  scenarioId: string,
  nodeId: string,
  overrideParams: Record<string, unknown> = {},
): Promise<RunNodeResult> {
  return originRequest<RunNodeResult>(`/scenarios/${scenarioId}/run-node`, {
    method: "POST",
    body: JSON.stringify({ node_id: nodeId, override_params: overrideParams }),
  })
}
