/**
 * api/marketplace.ts — Plugin marketplace endpoints.
 *
 * Connects to the backend marketplace router:
 *   GET  /marketplace/plugins                  — list installed plugins
 *   GET  /marketplace/catalog                  — browse available plugins
 *   POST /marketplace/plugins/:id/install      — install a plugin
 *   DELETE /marketplace/plugins/:id/uninstall  — uninstall a plugin
 */

import { request } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PluginCategory =
  | "geometry"
  | "analysis"
  | "export"
  | "import"
  | "visualization"
  | "integration"
  | "utilities"

export interface Plugin {
  id: string
  name: string
  description: string
  author: string
  version: string
  category: PluginCategory
  verified: boolean
  requires_pro: boolean
  tags: string[]
  homepage_url: string | null
  install_count: number
}

export interface InstalledPlugin extends Plugin {
  installed_at: string | null
  enabled: boolean
}

interface PluginActionResponse {
  ok: boolean
  package: string
  message: string
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function listInstalled(): Promise<InstalledPlugin[]> {
  return request<InstalledPlugin[]>("/marketplace/plugins")
}

export async function searchPlugins(query?: string, category?: PluginCategory): Promise<Plugin[]> {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (category) params.set("category", category)
  const qs = params.toString()
  return request<Plugin[]>(`/marketplace/catalog${qs ? `?${qs}` : ""}`)
}

export async function installPlugin(id: string): Promise<PluginActionResponse> {
  return request<PluginActionResponse>(`/marketplace/plugins/${encodeURIComponent(id)}/install`, {
    method: "POST",
  })
}

export async function uninstallPlugin(id: string): Promise<PluginActionResponse> {
  return request<PluginActionResponse>(`/marketplace/plugins/${encodeURIComponent(id)}/uninstall`, {
    method: "DELETE",
  })
}
