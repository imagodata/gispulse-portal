/**
 * api/request.ts — Base HTTP request helpers and backend health gate.
 *
 * Issue #194 (A7-S3): extracted from the monolithic client.ts.
 * All domain modules import `request` and `isBackendAlive` from here.
 */

export const BASE = "/api/portal"

// ---------------------------------------------------------------------------
// Backend availability gate — avoids network 404 noise when backend is down
// ---------------------------------------------------------------------------

let _backendAlive: boolean | null = null
let _healthPromise: Promise<boolean> | null = null

async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch("/health", { method: "GET" })
    return res.ok
  } catch {
    return false
  }
}

/** Returns true if backend is reachable. Caches with retry on failure. */
export function isBackendAlive(): Promise<boolean> {
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

export async function request<T>(path: string, init?: RequestInit, base = BASE): Promise<T> {
  if (!(await isBackendAlive())) throw new Error("Backend unavailable")
  const res = await fetch(`${base}${path}`, {
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
