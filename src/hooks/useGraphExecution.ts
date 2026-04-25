/**
 * Hook that orchestrates graph save + execution against the backend.
 *
 * Flow: save-if-dirty -> POST /scenarios/{id}/run -> update nodeExecStates
 */

import { useCallback, useRef } from "react"
import type { Node, Edge } from "@xyflow/react"

import {
  createScenario,
  updateScenario,
  runScenario,
  type ScenarioRunResult,
} from "@/api/client"
import { serializeGraph } from "@/lib/graphSerializer"
import { useEditorStore, type NodeExecState } from "@/stores/editorStore"
import { useResultsStore } from "@/stores/resultsStore"
import { useUIStore } from "@/stores/uiStore"

export function useGraphExecution() {
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(
    async (nodes: Node[], edges: Edge[], name: string) => {
      const {
        activeScenarioId,
        isGraphDirty,
        setActiveScenarioId,
        setGraphDirty,
        setGraphRunning,
        setNodeExecStates,
        clearNodeExecStates,
      } = useEditorStore.getState()

      // Abort any previous run
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      clearNodeExecStates()
      setGraphRunning(true)

      const resultId = `scenario-${Date.now()}`
      const { addResult, updateResult } = useResultsStore.getState()
      addResult({
        id: resultId,
        type: "scenario",
        name: name || "Untitled pipeline",
        status: "running",
        createdAt: new Date().toISOString(),
      })
      useUIStore.getState().setBottomTab("results")

      try {
        // ------ Save if needed ------
        let scenarioId = activeScenarioId
        const graph = serializeGraph(nodes, edges, name)

        if (!scenarioId) {
          // First save — create
          const res = await createScenario(graph)
          scenarioId = res.id
          setActiveScenarioId(scenarioId)
          setGraphDirty(false)
        } else if (isGraphDirty) {
          // Subsequent save — update
          await updateScenario(scenarioId, graph)
          setGraphDirty(false)
        }

        if (controller.signal.aborted) return

        // ------ Mark all non-group nodes as pending ------
        const pendingStates: Record<string, NodeExecState> = {}
        for (const n of nodes) {
          if (n.type !== "group") {
            pendingStates[n.id] = { status: "pending" }
          }
        }
        setNodeExecStates(pendingStates)

        // ------ Execute ------
        const result: ScenarioRunResult = await runScenario(scenarioId)

        if (controller.signal.aborted) return

        // ------ Map results to node states ------
        const execStates: Record<string, NodeExecState> = {}
        for (const nr of result.node_results) {
          execStates[nr.node_id] = {
            status: nr.status === "success" ? "success" : "failed",
            error: nr.error,
            duration_ms: nr.duration_ms,
          }
        }
        // Mark nodes not in results as success (e.g. pass-through nodes)
        for (const n of nodes) {
          if (n.type !== "group" && !execStates[n.id]) {
            execStates[n.id] = { status: "success" }
          }
        }
        setNodeExecStates(execStates)

        // Push to results store
        const successCount = result.node_results.filter((r) => r.status === "success").length
        const totalOutput = result.node_results.reduce((acc, r) => acc + (r.output_count ?? 0), 0)
        updateResult(resultId, {
          status: result.status === "success" ? "completed" : "failed",
          durationMs: result.duration_ms,
          featureCount: totalOutput || undefined,
          capability: `${successCount}/${result.node_results.length} nodes`,
        })
      } catch (err) {
        // Ignore abort errors
        if (controller.signal.aborted) return

        // On error, mark all pending/running nodes as failed
        const current = useEditorStore.getState().nodeExecStates
        const failedStates: Record<string, NodeExecState> = {}
        for (const [id, state] of Object.entries(current)) {
          if (state.status === "pending" || state.status === "running") {
            failedStates[id] = {
              status: "failed",
              error: err instanceof Error ? err.message : String(err),
            }
          } else {
            failedStates[id] = state
          }
        }
        setNodeExecStates(failedStates)
        updateResult(resultId, {
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        })
        throw err
      } finally {
        useEditorStore.getState().setGraphRunning(false)
      }
    },
    [],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  return { run, abort }
}
