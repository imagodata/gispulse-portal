import { createBrowserRouter, Navigate } from "react-router-dom"
import { RootLayout } from "@/layouts/RootLayout"
import { WorkspaceLayout } from "@/layouts/WorkspaceLayout"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { NotFound } from "@/components/NotFound"
import { AuthGuard } from "@/components/AuthGuard"
import { RouteFallback } from "@/components/LoadingScreen"

// Lazy-load workspace views
import React from "react"

/** Suspense wrapper to avoid repeating fallback markup on every lazy route */
function Lazy({ children }: { children: React.ReactNode }) {
  return <React.Suspense fallback={<RouteFallback />}>{children}</React.Suspense>
}

const ExplorerView = React.lazy(() =>
  import("@/views/ExplorerView").then((m) => ({ default: m.ExplorerView })),
)
const MapView = React.lazy(() =>
  import("@/components/MapView").then((m) => ({ default: m.MapView })),
)
const WorkflowsView = React.lazy(() =>
  import("@/views/WorkflowsView").then((m) => ({ default: m.WorkflowsView })),
)
const CatalogWorkspace = React.lazy(() =>
  import("@/components/CatalogWorkspace").then((m) => ({ default: m.CatalogWorkspace })),
)
const SchemaView = React.lazy(() =>
  import("@/components/SchemaView").then((m) => ({ default: m.SchemaView })),
)
const DatasetsView = React.lazy(() =>
  import("@/views/DatasetsView").then((m) => ({ default: m.DatasetsView })),
)

// Auth pages — lazy-loaded, public routes (libre = local login only)
const LoginPage = React.lazy(() =>
  import("@/pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })),
)

// Marketplace browse (read-only) stays in libre
const MarketplacePage = React.lazy(() =>
  import("@/pages/MarketplacePage").then((m) => ({ default: m.MarketplacePage })),
)

// NOTE: SSO callback, billing pages, admin/RBAC pages live in the private
// `gispulse-portal-pro` package. The libre portal-libre app does not import
// them — `gispulse-portal-pro` re-exports a `<ProRoutes />` element that is
// composed at the app level when the pro bundle is installed.

export type WorkspaceId = "explorer" | "map" | "workflows" | "catalog" | "schema" | "datasets"

/** Workspaces that use the full 3-panel layout (left + bottom + inspector) */
export const PANEL_WORKSPACES = new Set<WorkspaceId>(["map", "workflows", "schema"])

export const workspaces: { id: WorkspaceId; path: string; label: string }[] = [
  { id: "explorer", path: "/explorer", label: "Explorer" },
  { id: "map", path: "/map", label: "Map" },
  { id: "datasets", path: "/datasets", label: "Datasets" },
  { id: "workflows", path: "/workflows", label: "Workflows" },
  { id: "catalog", path: "/catalog", label: "Catalog" },
  { id: "schema", path: "/schema", label: "Schema" },
]

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ErrorBoundary>
        <RootLayout />
      </ErrorBoundary>
    ),
    children: [
      { index: true, element: <Navigate to="/explorer" replace /> },

      // Public routes — no auth guard (libre = local login only)
      { path: "login", element: <Lazy><LoginPage /></Lazy> },

      // Protected workspace routes
      {
        element: (
          <AuthGuard>
            <WorkspaceLayout />
          </AuthGuard>
        ),
        children: [
          { path: "explorer", element: <ExplorerView /> },
          { path: "map", element: <MapView /> },
          { path: "workflows", element: <WorkflowsView /> },
          { path: "datasets", element: <DatasetsView /> },
          { path: "catalog", element: <CatalogWorkspace /> },
          { path: "schema", element: <SchemaView /> },
          { path: "marketplace", element: <Lazy><MarketplacePage /></Lazy> },
        ],
      },

      // Pro routes (/billing, /admin/*, /auth/callback) live in the
      // private `gispulse-portal-pro` package. They are mounted at app
      // composition time when the pro bundle is installed.

      { path: "*", element: <NotFound /> },
    ],
  },
])

// ---------------------------------------------------------------------------
// Programmatic navigation helper �� usable from stores, callbacks, and non-React
// code. Maps WorkspaceId values to router paths.
// ---------------------------------------------------------------------------

const VIEW_TO_PATH: Record<string, string> = {
  explorer: "/explorer",
  map: "/map",
  schema: "/schema",
  editor: "/workflows",
  workflows: "/workflows",
  datasets: "/datasets",
  catalog: "/catalog",
}

/** Navigate to a workspace by WorkspaceId (also accepts legacy "editor" alias). */
export function navigateToView(view: string): void {
  const path = VIEW_TO_PATH[view]
  if (path) router.navigate(path)
}
