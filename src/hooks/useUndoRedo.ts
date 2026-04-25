/**
 * useUndoRedo — Undo/Redo history stack for the node editor.
 *
 * Sprint W2: tracks snapshots of nodes + edges. Ctrl+Z / Ctrl+Shift+Z.
 * Max 50 entries to limit memory usage.
 */

import { useCallback, useRef } from "react"
import type { Node, Edge } from "@xyflow/react"

const MAX_HISTORY = 50

interface Snapshot {
  nodes: Node[]
  edges: Edge[]
}

export function useUndoRedo() {
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])

  /** Take a snapshot of the current state (call BEFORE a mutation). */
  const takeSnapshot = useCallback((nodes: Node[], edges: Edge[]) => {
    undoStack.current.push({
      nodes: nodes.map((n) => ({ ...n, data: { ...n.data as object } })),
      edges: edges.map((e) => ({ ...e })),
    })
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift()
    }
    // Any new action clears the redo stack
    redoStack.current = []
  }, [])

  /** Undo: restore previous snapshot, push current to redo stack. */
  const undo = useCallback(
    (
      currentNodes: Node[],
      currentEdges: Edge[],
      setNodes: (nodes: Node[]) => void,
      setEdges: (edges: Edge[]) => void,
    ) => {
      const prev = undoStack.current.pop()
      if (!prev) return false

      // Push current state to redo stack
      redoStack.current.push({
        nodes: currentNodes.map((n) => ({ ...n, data: { ...n.data as object } })),
        edges: currentEdges.map((e) => ({ ...e })),
      })

      setNodes(prev.nodes)
      setEdges(prev.edges)
      return true
    },
    [],
  )

  /** Redo: restore next snapshot from redo stack, push current to undo stack. */
  const redo = useCallback(
    (
      currentNodes: Node[],
      currentEdges: Edge[],
      setNodes: (nodes: Node[]) => void,
      setEdges: (edges: Edge[]) => void,
    ) => {
      const next = redoStack.current.pop()
      if (!next) return false

      // Push current state to undo stack
      undoStack.current.push({
        nodes: currentNodes.map((n) => ({ ...n, data: { ...n.data as object } })),
        edges: currentEdges.map((e) => ({ ...e })),
      })

      setNodes(next.nodes)
      setEdges(next.edges)
      return true
    },
    [],
  )

  const canUndo = useCallback(() => undoStack.current.length > 0, [])
  const canRedo = useCallback(() => redoStack.current.length > 0, [])

  /** Clear all history (e.g. when loading a new workflow). */
  const clearHistory = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
  }, [])

  return { takeSnapshot, undo, redo, canUndo, canRedo, clearHistory }
}
