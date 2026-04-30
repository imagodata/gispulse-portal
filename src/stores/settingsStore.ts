/**
 * settingsStore — Single source of truth for the user-side backend URL
 * used by Mode 2 portal (issues #30 + #31).
 *
 * Bootstrap priority (highest first):
 *   1. `?backend=URL` query param  — set by `gispulse portal --backend=URL`
 *   2. `localStorage["gispulse.backend.url"]` — persisted across reloads
 *   3. empty string  — sentinel for "demo / built-in proxy"
 *
 * Healthcheck contract: the panel hits `${backendUrl || ""}/health` with
 * a 3 s timeout via AbortController. We deliberately do NOT cache here
 * — `useHealthCheck` already does that for the default proxy. The
 * SettingsPanel needs a *user-triggered* probe of the candidate URL
 * before commit.
 *
 * NOTE: this store is intentionally decoupled from `api/request.ts`.
 * Wiring of dynamic base URL into the request layer is a follow-up
 * (full Mode 2 connect-to-engine flow). For #30/#31 we only own the
 * settings UI + banner state.
 */

import { create } from "zustand"
import { parseQueryBackend, validateBackendUrl, normalizeBackendUrl } from "@/utils/backendUrl"

export const STORAGE_KEY = "gispulse.backend.url"

export type HealthStatus = "idle" | "checking" | "ok" | "fail"

interface SettingsState {
  /** Active backend URL. Empty string = demo / proxy default. */
  backendUrl: string
  /** Result of the most recent healthcheck (user-triggered). */
  healthStatus: HealthStatus
  /** Latency in ms from the last successful healthcheck (UI hint). */
  healthLatencyMs: number | null
  /** Last error string from a failed healthcheck (debugging copy). */
  healthError: string | null
  /** Whether the SettingsPanel modal is currently open. */
  panelOpen: boolean
  /** Whether the read-only demo gate dialog is currently open. */
  readOnlyDialogOpen: boolean

  /** Persist a validated URL. Empty string clears localStorage. */
  setBackendUrl: (url: string) => void
  /** Clear localStorage and revert to default. */
  reset: () => void
  /** Probe `${url}/health` with a 3 s timeout. Updates healthStatus. */
  runHealthcheck: (url?: string) => Promise<HealthStatus>
  /** Open / close the SettingsPanel. */
  setPanelOpen: (v: boolean) => void
  /** Open / close the read-only gate dialog. */
  setReadOnlyDialogOpen: (v: boolean) => void
}

/**
 * Loads the initial URL respecting the priority chain. Safe to call
 * during module init in jsdom/happy-dom — it tolerates missing
 * `window` / `localStorage` (SSR-shaped fallback).
 */
function loadInitialUrl(): string {
  if (typeof window === "undefined") return ""

  // 1. Query param wins
  const fromQuery = parseQueryBackend(window.location.search)
  if (fromQuery !== null) {
    // Query param is sticky: persist it so a refresh keeps the choice.
    try {
      window.localStorage.setItem(STORAGE_KEY, fromQuery)
    } catch {
      // localStorage may be disabled in private mode — non-fatal.
    }
    return fromQuery
  }

  // 2. localStorage
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      const v = validateBackendUrl(stored)
      if (v.ok) return normalizeBackendUrl(stored)
      // Garbage in storage — clean up so we don't re-warn.
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // private mode / blocked storage
  }

  // 3. default
  return ""
}

const HEALTHCHECK_TIMEOUT_MS = 3_000

/**
 * Probe a backend's /health endpoint. Returns ("ok"|"fail", latencyMs, errorMessage).
 * Pure-ish: does not mutate the store — `runHealthcheck` is the
 * thin wrapper that does. Easier to unit-test in isolation.
 */
export async function probeHealth(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: "ok" | "fail"; latencyMs: number; error: string | null }> {
  const target = url === "" ? "/health" : `${url}/health`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS)
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now()

  try {
    const res = await fetchImpl(target, { method: "GET", signal: controller.signal })
    const latencyMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
    )
    if (!res.ok) {
      return { status: "fail", latencyMs, error: `HTTP ${res.status}` }
    }
    return { status: "ok", latencyMs, error: null }
  } catch (err) {
    const latencyMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
    )
    const msg =
      err instanceof DOMException && err.name === "AbortError"
        ? "timeout"
        : err instanceof Error
          ? err.message
          : "network"
    return { status: "fail", latencyMs, error: msg }
  } finally {
    clearTimeout(timer)
  }
}

const initialUrl = loadInitialUrl()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  backendUrl: initialUrl,
  healthStatus: "idle",
  healthLatencyMs: null,
  healthError: null,
  panelOpen: false,
  readOnlyDialogOpen: false,
  setPanelOpen: (v) => set({ panelOpen: v }),
  setReadOnlyDialogOpen: (v) => set({ readOnlyDialogOpen: v }),

  setBackendUrl: (url: string) => {
    const v = validateBackendUrl(url)
    if (!v.ok) return // Caller is expected to gate via validateBackendUrl first
    const normalized = normalizeBackendUrl(url)
    if (typeof window !== "undefined") {
      try {
        if (normalized === "") window.localStorage.removeItem(STORAGE_KEY)
        else window.localStorage.setItem(STORAGE_KEY, normalized)
      } catch {
        // private mode — accept in-memory only
      }
    }
    set({ backendUrl: normalized, healthStatus: "idle", healthLatencyMs: null, healthError: null })
  },

  reset: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* noop */
      }
    }
    set({ backendUrl: "", healthStatus: "idle", healthLatencyMs: null, healthError: null })
  },

  runHealthcheck: async (urlOverride?: string) => {
    const target = urlOverride !== undefined ? urlOverride : get().backendUrl
    set({ healthStatus: "checking", healthLatencyMs: null, healthError: null })
    const r = await probeHealth(target)
    set({
      healthStatus: r.status,
      healthLatencyMs: r.latencyMs,
      healthError: r.error,
    })
    return r.status
  },
}))
