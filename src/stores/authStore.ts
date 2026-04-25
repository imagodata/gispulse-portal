/**
 * authStore — Zustand store for authentication state.
 *
 * Session is cookie-based (httpOnly). No tokens stored in localStorage.
 * On app start, checkAuth() probes GET /auth/me to rehydrate the session.
 *
 * RBAC gate: if rbacEnabled and not authenticated, the router redirects to /login.
 * rbacEnabled is determined by whether the backend returns any providers.
 */

import { create } from "zustand"
import type { User, AuthProvider } from "@/types/auth"
import {
  fetchMe,
  fetchProviders,
  logout as apiLogout,
  AuthError,
} from "@/api/auth"

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  /** Providers from GET /auth/providers — empty array means auth is disabled */
  providers: AuthProvider[]
  /** True once checkAuth() has completed (even if unauthenticated) */
  initialized: boolean
  error: string | null

  checkAuth: () => Promise<void>
  fetchMe: () => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  providers: [],
  initialized: false,
  error: null,

  /**
   * Called once at app startup. Fetches providers and current user in parallel.
   * Gracefully handles backends with no auth configured.
   */
  checkAuth: async () => {
    set({ isLoading: true, error: null })
    try {
      // Fetch providers to know if RBAC is active
      const providers = await fetchProviders().catch(() => [] as AuthProvider[])

      // Probe session
      const user = await fetchMe().catch((err) => {
        if (err instanceof AuthError && err.status === 401) return null
        // Backend unreachable or auth not configured — treat as unauthenticated
        return null
      })

      set({
        providers,
        user,
        isAuthenticated: user !== null,
        initialized: true,
        isLoading: false,
      })
    } catch {
      set({
        providers: [],
        user: null,
        isAuthenticated: false,
        initialized: true,
        isLoading: false,
      })
    }
  },

  /**
   * Re-fetch the current user (e.g. after OIDC callback completes).
   * Throws if not authenticated.
   */
  fetchMe: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = await fetchMe()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed"
      set({ user: null, isAuthenticated: false, isLoading: false, error: message })
      throw err
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await apiLogout()
    } catch {
      // Best-effort — clear local state regardless
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false })
      // Hard redirect to login page to clear any in-memory state
      window.location.href = "/login"
    }
  },

  clearError: () => set({ error: null }),
}))

// ---------------------------------------------------------------------------
// Helper selectors
// ---------------------------------------------------------------------------

/** True if at least one provider is configured (RBAC is active). */
export function selectRbacEnabled(state: AuthState): boolean {
  return state.providers.length > 0
}

/** True if the current user has at least the given role. */
const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
}

export function hasRole(
  user: User | null,
  required: "viewer" | "editor" | "admin" | "owner",
): boolean {
  if (!user) return false
  return (ROLE_RANK[user.role] ?? -1) >= (ROLE_RANK[required] ?? 0)
}

/** Tier rank for gate comparisons. */
export const TIER_RANK: Record<string, number> = {
  community: 0,
  pro: 1,
  team: 2,
  enterprise: 3,
}

export function hasTier(
  userTier: string | undefined,
  requiredTier: string,
): boolean {
  if (!userTier) return false
  return (TIER_RANK[userTier] ?? -1) >= (TIER_RANK[requiredTier] ?? 0)
}
