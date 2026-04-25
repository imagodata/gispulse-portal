/**
 * AuthGuard — Protects routes when RBAC is active.
 *
 * Behavior:
 *  - If auth not yet initialized: shows a full-page spinner
 *  - If RBAC not enabled (no providers): renders children directly
 *  - If RBAC enabled and authenticated: renders children
 *  - If RBAC enabled and NOT authenticated: redirects to /login
 *
 * Usage in router:
 *   element: <AuthGuard><WorkspaceLayout /></AuthGuard>
 */

import { Navigate, useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuthStore, selectRbacEnabled } from "@/stores/authStore"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation()
  const { initialized, isAuthenticated, isLoading } = useAuthStore()
  const rbacEnabled = useAuthStore(selectRbacEnabled)

  // Initialization in progress — keep the user on screen, don't flash login
  if (!initialized || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Auth not required — pass through
  if (!rbacEnabled) {
    return <>{children}</>
  }

  // Auth required but not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  return <>{children}</>
}
