/**
 * api/pipelines.ts — Pipeline v2 API client.
 *
 * Issue #403/#406: Endpoints for executing, validating, and listing
 * PipelineSpec v2 definitions.
 */

import { request } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepSpecIn {
  id: string
  type: string
  capability?: string | null
  params: Record<string, unknown>
  input?: string | string[] | null
  enabled?: boolean
  order?: number
}

export interface PipelineExecuteRequest {
  name: string
  description?: string
  steps: StepSpecIn[]
  ref_layers?: Record<string, string>
  dataset_id?: string | null
  input_path?: string | null
  layer?: string | null
}

export interface StepResultOut {
  step_id: string
  features_count: number
  columns: string[]
}

export interface PipelineExecuteResponse {
  pipeline_name: string
  steps_executed: number
  step_results: StepResultOut[]
  total_features_out: number
  is_dag: boolean
}

export interface ValidationIssue {
  step_id: string
  level: "error" | "warning"
  message: string
}

export interface PipelineValidateResponse {
  valid: boolean
  issues: ValidationIssue[]
}

export interface PipelineExample {
  name: string
  description: string
  spec: PipelineSpecV2
}

export interface PipelineSpecV2 {
  version: 2
  name: string
  description?: string
  steps: StepSpecIn[]
  triggers?: Array<{ on: string; then: string; then_config?: Record<string, unknown> }>
  ref_layers?: Record<string, string>
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

const PREFIX = "/pipelines"

/** Execute a PipelineSpec v2 against a dataset. */
export async function executePipeline(
  payload: PipelineExecuteRequest,
): Promise<PipelineExecuteResponse> {
  return request<PipelineExecuteResponse>(`${PREFIX}/execute`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/** Validate a PipelineSpec without executing. */
export async function validatePipeline(
  steps: StepSpecIn[],
  refLayers?: Record<string, string>,
): Promise<PipelineValidateResponse> {
  return request<PipelineValidateResponse>(`${PREFIX}/validate`, {
    method: "POST",
    body: JSON.stringify({ steps, ref_layers: refLayers ?? {} }),
  })
}

/** List built-in pipeline examples. */
export async function listPipelineExamples(): Promise<PipelineExample[]> {
  return request<PipelineExample[]>(`${PREFIX}/examples`)
}
