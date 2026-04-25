import { Suspense, useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Panel, Group, Separator } from "react-resizable-panels"
import { LoadingScreen } from "@/components/LoadingScreen"
import { MapSkeleton, TableSkeleton, GridSkeleton, EditorSkeleton } from "@/components/WorkspaceSkeleton"
import { TopNav } from "@/components/TopNav"
import { Breadcrumb } from "@/components/Breadcrumb"
import { LeftPanel } from "@/components/LeftPanel"
import { BottomPanel } from "@/components/BottomPanel"
import { InspectorPanel } from "@/components/InspectorPanel"
import { DragDropOverlay } from "@/components/DragDropOverlay"
import { DuplicateImportDialog } from "@/components/DuplicateImportDialog"
import { WorkspaceErrorBoundary } from "@/components/WorkspaceErrorBoundary"
import { useUIStore } from "@/stores/uiStore"
import { useDatasetImport } from "@/hooks/useDatasetImport"
import { useLiveEvents } from "@/hooks/useLiveEvents"
import { useIsCompact } from "@/hooks/use-mobile"
import { PANEL_WORKSPACES, type WorkspaceId } from "@/router"

function ResizeHandle({ orientation = "horizontal" }: { orientation?: "horizontal" | "vertical" }) {
  const isH = orientation === "horizontal"
  return (
    <Separator
      className={`group relative flex items-center justify-center transition-colors ${
        isH
          ? "w-1 hover:w-1.5 bg-border/40 hover:bg-primary/30 cursor-col-resize"
          : "h-1 hover:h-1.5 bg-border/40 hover:bg-primary/30 cursor-row-resize"
      }`}
    />
  )
}

const WORKSPACE_SKELETONS: Partial<Record<WorkspaceId, React.FC>> = {
  map: MapSkeleton,
  schema: MapSkeleton,
  datasets: TableSkeleton,
  explorer: GridSkeleton,
  catalog: GridSkeleton,
  workflows: EditorSkeleton,
}

function ViewFallback({ workspace }: { workspace?: WorkspaceId }) {
  const Skeleton = workspace ? WORKSPACE_SKELETONS[workspace] : undefined
  if (Skeleton) return <Skeleton />
  return <LoadingScreen message="Loading workspace..." />
}

/** Map URL paths to WorkspaceId so we can keep uiStore in sync */
const PATH_TO_WORKSPACE: Record<string, WorkspaceId> = {
  "/explorer": "explorer",
  "/map": "map",
  "/workflows": "workflows",
  "/datasets": "datasets",
  "/catalog": "catalog",
  "/schema": "schema",
}

export function WorkspaceLayout() {
  const { leftPanelOpen, inspectorOpen, bottomPanelOpen } = useUIStore()
  const setWorkspaceId = useUIStore((s) => s.setWorkspaceId)
  const setLeftPanelOpen = useUIStore((s) => s.setLeftPanelOpen)
  const setInspectorOpen = useUIStore((s) => s.setInspectorOpen)
  const location = useLocation()
  const isCompact = useIsCompact()
  useLiveEvents()

  // Sync uiStore.workspaceId with the current route
  const currentWorkspace = PATH_TO_WORKSPACE[location.pathname] as WorkspaceId | undefined
  const showPanels = currentWorkspace ? PANEL_WORKSPACES.has(currentWorkspace) : false

  useEffect(() => {
    if (currentWorkspace) setWorkspaceId(currentWorkspace)
  }, [currentWorkspace, setWorkspaceId])

  // Auto-collapse side panels on compact viewports (<1024px)
  useEffect(() => {
    if (isCompact) {
      setLeftPanelOpen(false)
      setInspectorOpen(false)
    }
  }, [isCompact, setLeftPanelOpen, setInspectorOpen])

  // Shared drag-and-drop import
  const {
    isDragOver,
    pendingDuplicate,
    clearPendingDuplicate,
    confirmDuplicate,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useDatasetImport()

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* Top Navigation */}
      <TopNav />
      <Breadcrumb />

      {/* Main resizable layout */}
      <div
        className="flex flex-1 min-h-0 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && <DragDropOverlay />}

        {pendingDuplicate && (
          <DuplicateImportDialog
            pending={pendingDuplicate}
            onCancel={clearPendingDuplicate}
            onConfirm={confirmDuplicate}
          />
        )}

        <Group orientation="horizontal" className="flex-1" id={`main-${showPanels && leftPanelOpen ? "L" : ""}${showPanels && inspectorOpen ? "R" : ""}`}>
          {/* Left Panel — only for map/workflows/schema */}
          {showPanels && leftPanelOpen && (
            <>
              <Panel
                id="left-panel"
                defaultSize="18%"
                minSize="240px"
                maxSize="35%"
                className="overflow-hidden"
              >
                <LeftPanel />
              </Panel>
              <ResizeHandle orientation="horizontal" />
            </>
          )}

          {/* Center: View + Bottom */}
          <Panel id="center" minSize="30%" className="overflow-hidden">
            <Group orientation="vertical" id={`center-${showPanels && bottomPanelOpen ? "B" : ""}`}>
              <Panel id="workspace" defaultSize={showPanels && bottomPanelOpen ? "70%" : "100%"} minSize="30%" className="overflow-hidden">
                <div className="h-full relative">
                  <WorkspaceErrorBoundary name={currentWorkspace}>
                    <Suspense fallback={<ViewFallback workspace={currentWorkspace} />}>
                      <Outlet />
                    </Suspense>
                  </WorkspaceErrorBoundary>
                </div>
              </Panel>

              {showPanels && bottomPanelOpen && (
                <>
                  <ResizeHandle orientation="vertical" />
                  <Panel
                    id="bottom-panel"
                    defaultSize="30%"
                    minSize="120px"
                    maxSize="60%"
                    collapsible
                    className="overflow-hidden"
                  >
                    <BottomPanel />
                  </Panel>
                </>
              )}
            </Group>
          </Panel>

          {/* Right Inspector — only for map/workflows/schema */}
          {showPanels && inspectorOpen && (
            <>
              <ResizeHandle orientation="horizontal" />
              <Panel
                id="inspector"
                defaultSize="20%"
                minSize="260px"
                maxSize="35%"
                className="overflow-hidden"
              >
                <InspectorPanel />
              </Panel>
            </>
          )}
        </Group>
      </div>
    </div>
  )
}
