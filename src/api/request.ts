/**
 * api/request.ts — Base HTTP request helpers and backend health gate.
 *
 * Issue #194 (A7-S3): extracted from the monolithic client.ts.
 * Issue #41   (v1.5.1): wires `useSettingsStore.backendUrl` into the
 *                       request layer so Mode 2 "Connect your engine"
 *                       actually swaps origins instead of pretending to.
 *
 * Path scheme contract
 * --------------------
 * The backend mounts portal routes under `/api/portal/...` (same path
 * served by `demo.gispulse.dev` and by `gispulse engine` locally). We
 * keep that suffix invariant — the only thing that changes between
 * "Demo" and "My engine" is the origin prefix.
 *
 *   demo / sentinel  → request("/foo") → fetch("/api/portal/foo")
 *   custom URL       → request("/foo") → fetch("http://host:port/api/portal/foo")
 *
 * The store is intentionally read via `getState()` (Zustand's non-React
 * accessor) so the request layer stays free of React hooks. Reading at
 * call-time means a user can switch backends from the SettingsPanel and
 * the very next API call honors the new URL — no module reload needed.
 *
 * Legacy `BASE` export
 * --------------------
 * Pre-#41, modules imported a `const BASE = "/api/portal"` and used it
 * inside their own template literals (`${BASE}/datasets/upload`). To
 * preserve backwards-compat without a sweeping refactor, `BASE` is now
 * a getter-backed string-coercible Proxy: any template literal or
 * concatenation will see the live, store-driven value. New code should
 * prefer `getBase()`.
 */

import { useSettingsStore } from "@/stores/settingsStore"

/** Suffix appended to the active origin for portal API routes. */
export const API_PATH_PREFIX = "/api/portal"

/**
 * Resolve the active API base URL by reading `backendUrl` from the
 * settings store. Empty / sentinel falls back to a same-origin path so
 * the dev proxy and the bundled `gispulse portal` static mount keep
 * working without any user configuration.
 *
 * Exposed as a function (not a const) because the value must be read at
 * each call — the user can switch backends at runtime via the
 * SettingsPanel and we want the very next request to honor the change.
 */
export function getBase(): string {
  // Defensive: in non-DOM contexts (early SSR-shaped boot, edge cases
  // during module init) the store may not have hydrated yet. The store
  // module itself tolerates missing window globals, but calling
  // `getState()` before the create() factory ran would throw.
  let backendUrl = ""
  try {
    backendUrl = useSettingsStore.getState().backendUrl ?? ""
  } catch {
    backendUrl = ""
  }
  if (!backendUrl) return API_PATH_PREFIX
  // `normalizeBackendUrl` already strips trailing slashes when the URL
  // entered the store, but be defensive against direct setState calls
  // in tests that bypass the validator.
  const trimmed = backendUrl.replace(/\/+$/, "")
  return `${trimmed}${API_PATH_PREFIX}`
}

/**
 * Backwards-compat string-coercible proxy. Existing modules import
 * `BASE` and inline it inside template literals or concatenations:
 *
 *   import { BASE } from "./request"
 *   fetch(`${BASE}/datasets/upload`)
 *
 * Migrating those to `getBase()` would be a >10-file diff outside the
 * scope of #41 (a wiring fix, not a refactor). Instead, `BASE` is a
 * Proxy whose `Symbol.toPrimitive` / `toString` / `valueOf` traps all
 * return the live `getBase()` value. Standard string methods like
 * `.length` / `.startsWith` are forwarded onto the resolved string.
 *
 * Caveat: `typeof BASE === "object"` (it's a Proxy), but no consumer
 * we ship inspects that — they only stringify it.
 */
export const BASE: string = new Proxy(
  Object.create(null) as object,
  {
    get(_t, prop) {
      const live = getBase()
      if (prop === Symbol.toPrimitive) return () => live
      if (prop === "toString" || prop === "valueOf") return () => live
      const target = live as unknown as Record<string | symbol, unknown>
      const v = target[prop as string]
      return typeof v === "function" ? (v as (...args: unknown[]) => unknown).bind(live) : v
    },
  },
) as unknown as string

// ---------------------------------------------------------------------------
// Backend availability gate — avoids network 404 noise when backend is down
// ---------------------------------------------------------------------------

let _backendAlive: boolean | null = null
let _healthPromise: Promise<boolean> | null = null
/** Last URL probed by `isBackendAlive`; used to invalidate the cache when the user switches backends. */
let _lastProbedUrl: string | null = null

/**
 * Compose the /health URL from the active backend URL. Empty /
 * sentinel hits the same-origin `/health` path served by the dev proxy
 * or the bundled engine. Custom URL hits `${url}/health` so the
 * healthcheck reflects the actual target the request layer will use.
 */
function getHealthUrl(): string {
  let backendUrl = ""
  try {
    backendUrl = useSettingsStore.getState().backendUrl ?? ""
  } catch {
    backendUrl = ""
  }
  if (!backendUrl) return "/health"
  return `${backendUrl.replace(/\/+$/, "")}/health`
}

async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch(getHealthUrl(), { method: "GET" })
    return res.ok
  } catch {
    return false
  }
}

/** Returns true if backend is reachable. Caches with retry on failure. */
export function isBackendAlive(): Promise<boolean> {
  // Invalidate the cache when the user swapped backends so the next
  // call probes the new origin instead of trusting a stale "alive".
  const targetUrl = getHealthUrl()
  if (_lastProbedUrl !== null && _lastProbedUrl !== targetUrl) {
    _backendAlive = null
    _healthPromise = null
  }
  _lastProbedUrl = targetUrl

  if (_backendAlive !== null) return Promise.resolve(_backendAlive)
  if (!_healthPromise) {
    _healthPromise = checkBackend().then((alive) => {
      _backendAlive = alive
      // Retry after 30s on failure, OR after 5min on success (re-validate periodically)
      const retryMs = alive ? 300_000 : 30_000
      setTimeout(() => { _backendAlive = null; _healthPromise = null }, retryMs)
      return alive
    })
  }
  return _healthPromise
}

/**
 * Reset the cached backend-alive state. Exposed for tests and for the
 * SettingsPanel "Switch backend" flow that wants the next call to
 * actually probe the new origin instead of trusting a stale result.
 */
export function _resetBackendAliveCache(): void {
  _backendAlive = null
  _healthPromise = null
  _lastProbedUrl = null
}

export async function request<T>(path: string, init?: RequestInit, base?: string): Promise<T> {
  if (!(await isBackendAlive())) throw new Error("Backend unavailable")
  const activeBase = base ?? getBase()
  const res = await fetch(`${activeBase}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
