/**
 * backendUrl.ts — Pure helpers for parsing & validating the user-side
 * backend URL used by the "My engine" mode (Mode 2 portal).
 *
 * Decisions (memory `sprint_plan_v15x_2026_04_30`, two-package architecture):
 * - Only `http://` and `https://` are accepted. `file://` / `ws://` /
 *   relative paths are rejected — the SettingsPanel needs a fully
 *   qualified URL to do a same-origin healthcheck.
 * - Trailing slashes are stripped on normalization. The runtime always
 *   appends `/health`, `/api/portal/...`, etc., so a trailing slash
 *   would produce double-slash URLs that some reverse proxies reject.
 * - Empty string is the sentinel for "demo / proxy default" — the SPA
 *   then falls back to its built-in `/api/portal` path which the dev
 *   server proxy or the same-origin `gispulse engine` mounts.
 *
 * Kept dependency-free so it stays cheap to unit test (no React, no
 * Zustand, no DOM globals).
 */

export const DEMO_BACKEND_HOST = "demo.gispulse.dev"

export interface ValidationResult {
  ok: boolean
  /** Reason key for i18n lookup (`error.backend_url.<reason>`). Set when ok=false. */
  reason?: "empty" | "scheme" | "format" | "trailing_path"
}

/**
 * Validates a raw user input. Empty string is *valid* — it means "use
 * the default proxy" (demo mode). Non-empty must parse as http/https
 * with a host and no extra path beyond `/`.
 */
export function validateBackendUrl(raw: string): ValidationResult {
  const trimmed = raw.trim()
  if (trimmed === "") return { ok: true } // empty = demo

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: "format" }
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "scheme" }
  }

  // We accept "/" or no path at all. Anything deeper would conflict
  // with how the SPA composes API paths (`${url}/health`, etc.).
  const path = parsed.pathname.replace(/\/+$/, "")
  if (path !== "") return { ok: false, reason: "trailing_path" }

  return { ok: true }
}

/**
 * Normalizes a validated URL: strips trailing slashes, lowercases the
 * host, removes any default port. Pre-condition: `validateBackendUrl`
 * returned ok. Returns the input unchanged on parse failure (defensive
 * — callers should validate first).
 */
export function normalizeBackendUrl(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === "") return ""
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed
  }
  // URL.toString() preserves trailing slash on root; we strip it.
  const out = `${parsed.protocol}//${parsed.host}`
  return out
}

/**
 * Reads `?backend=...` from a query string. Returns the validated +
 * normalized URL, or `null` if absent / invalid. Used on first mount
 * to honor `gispulse portal --backend=URL` deep-links from the CLI.
 *
 * `search` is the raw `window.location.search` (with or without `?`).
 */
export function parseQueryBackend(search: string): string | null {
  if (!search) return null
  const qs = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(qs)
  const raw = params.get("backend")
  if (raw === null) return null
  const v = validateBackendUrl(raw)
  if (!v.ok) return null
  return normalizeBackendUrl(raw)
}

/**
 * Returns true when the active backend URL points at the public demo
 * host. Used by the ModeBanner to flip the "Demo (read-only)" copy.
 *
 * Empty string also means demo (the SPA falls back to its bundled
 * proxy, which on GH Pages targets demo.gispulse.dev).
 */
export function isDemoBackend(url: string): boolean {
  if (url === "") return true
  try {
    const parsed = new URL(url)
    return parsed.host.toLowerCase() === DEMO_BACKEND_HOST
  } catch {
    return false
  }
}

/** Best-effort host extraction for status banner ("Connected to {host}"). */
export function backendHostLabel(url: string): string {
  if (url === "") return DEMO_BACKEND_HOST
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * Derives the active mode from the current backend URL + last health
 * probe result. Pure helper so tests can exercise the matrix without
 * mounting React.
 *
 *   demo          — proxy default or canonical demo host
 *   connected     — custom backend, healthcheck idle / checking / ok
 *   disconnected  — custom backend, healthcheck failed
 */
export type BannerMode = "demo" | "connected" | "disconnected"
export function getBannerMode(
  backendUrl: string,
  healthStatus: "idle" | "checking" | "ok" | "fail",
): BannerMode {
  if (isDemoBackend(backendUrl)) return "demo"
  return healthStatus === "fail" ? "disconnected" : "connected"
}
