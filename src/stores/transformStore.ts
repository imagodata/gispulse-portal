/**
 * transformStore — Job submission and real-time status tracking.
 *
 * Issue #409: Replaced polling setInterval with WebSocket listener.
 * Falls back to polling only when WebSocket is unavailable.
 */

import { create } from "zustand"
import * as api from "@/api/client"

export type PipelineStatus = "idle" | "submitting" | "running" | "completed" | "failed"

export interface LogEntry {
  timestamp: string
  message: string
  level: "info" | "error" | "success"
}

interface TransformState {
  selectedRuleIds: string[]
  datasetId: string | null
  pipelineName: string

  status: PipelineStatus
  jobId: string | null
  logs: LogEntry[]
  error: string | null
  result: api.JobResponse | null

  // Actions
  setSelectedRuleIds: (ids: string[]) => void
  toggleRuleId: (id: string) => void
  setDatasetId: (id: string | null) => void
  setPipelineName: (name: string) => void
  runPipeline: () => Promise<void>
  reset: () => void
}

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 100 // ~5 minutes

function now(): string {
  return new Date().toISOString()
}

function addLog(
  set: (fn: (s: TransformState) => Partial<TransformState>) => void,
  message: string,
  level: LogEntry["level"] = "info",
) {
  set((s) => ({ logs: [...s.logs, { timestamp: now(), message, level }] }))
}

// Cleanup ref for active watchers (WS listener or poll interval)
let cleanupFn: (() => void) | null = null

function cleanup() {
  if (cleanupFn) {
    cleanupFn()
    cleanupFn = null
  }
}

/**
 * Watch job status via WebSocket events.
 * Returns true if WebSocket is available, false to fall back to polling.
 */
function watchViaWebSocket(
  jobId: string,
  set: (fn: (s: TransformState) => Partial<TransformState>) => void,
  resolve: () => void,
): boolean {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:"
  const wsUrl = `${protocol}//${location.host}/ws/events`

  let ws: WebSocket
  try {
    ws = new WebSocket(wsUrl)
  } catch {
    return false
  }

  let resolved = false
  const done = () => {
    if (!resolved) {
      resolved = true
      resolve()
    }
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      const data = msg.data ?? {}
      if (data.job_id !== jobId) return

      if (msg.type === "job_completed") {
        addLog(set, `Job completed (via WebSocket)`, "success")
        // Fetch full job result
        api.getJob(jobId).then((updated) => {
          set(() => ({ status: "completed", result: updated }))
          addLog(set, `Duration: ${updated.duration_seconds?.toFixed(1) ?? "?"}s`, "success")
        }).catch(() => {
          set(() => ({ status: "completed" }))
        }).finally(done)
        ws.close()
      } else if (msg.type === "job_failed") {
        const errMsg = data.error ?? "Job failed without details."
        set(() => ({ status: "failed", error: String(errMsg) }))
        addLog(set, `Job failed: ${errMsg}`, "error")
        ws.close()
        done()
      } else if (msg.type === "job_started") {
        addLog(set, `Job started (via WebSocket)`)
      }
    } catch {
      // Ignore malformed messages
    }
  }

  ws.onerror = () => {
    // WebSocket failed — caller should fall back to polling
    ws.close()
    if (!resolved) {
      // Signal that WS failed so caller can start polling
      cleanupFn = null
      fallbackPoll(jobId, set, resolve)
    }
  }

  ws.onclose = () => {
    // If job is still running and WS closed unexpectedly, fall back to polling
    if (!resolved) {
      fallbackPoll(jobId, set, resolve)
    }
  }

  // Register cleanup
  cleanupFn = () => {
    resolved = true
    ws.close()
  }

  return true
}

/**
 * Fallback: poll job status via REST API.
 */
function fallbackPoll(
  jobId: string,
  set: (fn: (s: TransformState) => Partial<TransformState>) => void,
  resolve: () => void,
) {
  let attempts = 0
  const interval = setInterval(async () => {
    attempts++
    if (attempts > MAX_POLL_ATTEMPTS) {
      clearInterval(interval)
      set(() => ({ status: "failed", error: "Polling timed out." }))
      addLog(set, "Polling timed out after 5 minutes", "error")
      resolve()
      return
    }
    try {
      const updated = await api.getJob(jobId)

      if (updated.status === "completed") {
        clearInterval(interval)
        set(() => ({ status: "completed", result: updated }))
        addLog(set, `Job completed in ${updated.duration_seconds?.toFixed(1) ?? "?"}s`, "success")
        resolve()
      } else if (updated.status === "failed") {
        clearInterval(interval)
        const errMsg = updated.error_message ?? "Job failed without details."
        set(() => ({ status: "failed", error: errMsg, result: updated }))
        addLog(set, `Job failed: ${errMsg}`, "error")
        resolve()
      }
    } catch (err) {
      clearInterval(interval)
      const msg = err instanceof Error ? err.message : "Polling error"
      set(() => ({ status: "failed", error: msg }))
      addLog(set, `Polling error: ${msg}`, "error")
      resolve()
    }
  }, POLL_INTERVAL_MS)

  cleanupFn = () => clearInterval(interval)
}

export const useTransformStore = create<TransformState>((set, get) => ({
  selectedRuleIds: [],
  datasetId: null,
  pipelineName: "transform-pipeline",

  status: "idle",
  jobId: null,
  logs: [],
  error: null,
  result: null,

  setSelectedRuleIds: (ids) => set({ selectedRuleIds: ids }),

  toggleRuleId: (id) =>
    set((s) => ({
      selectedRuleIds: s.selectedRuleIds.includes(id)
        ? s.selectedRuleIds.filter((r) => r !== id)
        : [...s.selectedRuleIds, id],
    })),

  setDatasetId: (id) => set({ datasetId: id }),
  setPipelineName: (name) => set({ pipelineName: name }),

  runPipeline: async () => {
    const { selectedRuleIds, datasetId, pipelineName } = get()

    if (selectedRuleIds.length === 0) {
      set({ error: "Select at least one rule to run." })
      return
    }

    // Cancel any in-flight watcher
    cleanup()

    set({ status: "submitting", logs: [], error: null, result: null, jobId: null })
    addLog(set, `Submitting job "${pipelineName}" with ${selectedRuleIds.length} rule(s)...`)

    try {
      const job = await api.createJob({
        name: pipelineName,
        dataset_id: datasetId,
        parameters: { rule_ids: selectedRuleIds },
      })

      set({ jobId: job.id, status: "running" })
      addLog(set, `Job created: ${job.id} (status: ${job.status})`)

      // Watch via WebSocket, fall back to polling if WS unavailable
      await new Promise<void>((resolve) => {
        const wsOk = watchViaWebSocket(job.id, set, resolve)
        if (!wsOk) {
          addLog(set, "WebSocket unavailable, falling back to polling")
          fallbackPoll(job.id, set, resolve)
        }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit job"
      set({ status: "failed", error: msg })
      addLog(set, `Submission error: ${msg}`, "error")
    }
  },

  reset: () => {
    cleanup()
    set({
      status: "idle",
      jobId: null,
      logs: [],
      error: null,
      result: null,
    })
  },
}))
