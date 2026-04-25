/**
 * WorkflowsView — Main entry point for the Workflows workspace.
 *
 * Sprint W1: split into two modes:
 *   - "list": WorkflowList — browse, search, CRUD, import/export
 *   - "editor": NodeEditor + bottom panel — build & run workflows
 *
 * The active mode is driven by workflowStore.view.
 */

import React, { Suspense } from "react"
import { useWorkflowStore } from "@/stores/workflowStore"

const WorkflowList = React.lazy(() =>
  import("@/components/WorkflowList").then((m) => ({ default: m.WorkflowList })),
)

const NodeEditor = React.lazy(() =>
  import("@/components/NodeEditor").then((m) => ({ default: m.NodeEditor })),
)

const WorkflowEditorHeader = React.lazy(() =>
  import("@/components/WorkflowEditorHeader").then((m) => ({
    default: m.WorkflowEditorHeader,
  })),
)

const ScenariosPanel = React.lazy(() =>
  import("@/components/scenarios/ScenariosPanel").then((m) => ({
    default: m.ScenariosPanel,
  })),
)

function LoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading...
    </div>
  )
}

export function WorkflowsView() {
  const view = useWorkflowStore((s) => s.view)

  return (
    <div className="flex flex-col h-full">
      <Suspense fallback={<LoadingFallback />}>
        {view === "list" ? (
          <WorkflowList />
        ) : (
          <>
            <WorkflowEditorHeader />
            <div className="flex-1 min-h-0 relative">
              <NodeEditor />
            </div>
            <ScenariosPanel />
          </>
        )}
      </Suspense>
    </div>
  )
}
