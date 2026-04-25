/**
 * HOC that wraps a ReactFlow node component and adds a colored ring
 * reflecting the execution status from editorStore.nodeExecStates.
 *
 * Status rings:
 *   idle    — no ring
 *   pending — grey ring
 *   running — blue pulsing ring (animate-pulse)
 *   success — green ring
 *   failed  — red ring + error text below
 */

import type { ComponentType } from "react"
import type { NodeProps } from "@xyflow/react"
import { useEditorStore, type NodeExecStatus } from "@/stores/editorStore"

const RING_CLASSES: Record<NodeExecStatus, string> = {
  pending: "ring-2 ring-gray-400 ring-offset-1",
  running: "ring-2 ring-blue-500 ring-offset-1 animate-pulse",
  success: "ring-2 ring-emerald-500 ring-offset-1",
  failed: "ring-2 ring-red-500 ring-offset-1",
}

export function withExecStatus<P extends NodeProps>(
  WrappedComponent: ComponentType<P>,
): ComponentType<P> {
  function WithExecStatusWrapper(props: P) {
    const nodeId = props.id
    const execState = useEditorStore((s) => s.nodeExecStates[nodeId])

    const ringClass = execState ? RING_CLASSES[execState.status] ?? "" : ""

    return (
      <div className={`rounded-lg ${ringClass}`}>
        <WrappedComponent {...props} />
        {execState?.status === "failed" && execState.error && (
          <div
            className="mt-1 px-1 text-label-sm text-red-600 dark:text-red-400 truncate max-w-[200px]"
            title={execState.error}
          >
            {execState.error}
          </div>
        )}
        {execState?.duration_ms != null && execState.status === "success" && (
          <div className="mt-0.5 px-1 text-label-sm text-muted-foreground">
            {execState.duration_ms}ms
          </div>
        )}
      </div>
    )
  }

  WithExecStatusWrapper.displayName = `withExecStatus(${
    WrappedComponent.displayName ?? WrappedComponent.name ?? "Component"
  })`

  return WithExecStatusWrapper
}
