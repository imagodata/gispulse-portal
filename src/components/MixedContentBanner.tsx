/**
 * MixedContentBanner — Issue #42.
 *
 * The portal can be served from a HTTPS origin (gispulse.dev GH Pages,
 * a Pro tenant under Pro TLS, …) while the user keeps a plain `http://`
 * backend in `settingsStore.backendUrl` (typically `http://localhost:8001`
 * pointing at a developer's `gispulse portal`). Browsers refuse such
 * cross-protocol requests as "active mixed content" and the failure is
 * silent in DevTools network → users get a blank UI with no feedback.
 *
 * This banner detects the combination at runtime and tells the user
 * how to recover (use `gispulse portal` for same-origin mounting, or
 * serve their backend over HTTPS).
 *
 * Render conditions (all must be true):
 *   - we are in a browser (`window` defined)
 *   - `window.location.protocol === "https:"`
 *   - `settingsStore.backendUrl` starts with `http://` (case-insensitive)
 *
 * The banner is intentionally non-dismissable: the failure mode is
 * silent in the network panel, so a "X" close button would let users
 * forget about a real blocker. They escape by changing the backend or
 * the portal origin instead.
 */

import { useMemo } from "react"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { useT } from "@/i18n/useT"
import { useSettingsStore } from "@/stores/settingsStore"

const DOCS_HREF = "https://imagodata.github.io/gispulse/cli/portal.html"

export function MixedContentBanner() {
  const t = useT()
  const backendUrl = useSettingsStore((s) => s.backendUrl)

  const shouldRender = useMemo(() => {
    if (typeof window === "undefined") return false
    if (window.location.protocol !== "https:") return false
    if (!backendUrl) return false
    return backendUrl.toLowerCase().startsWith("http://")
  }, [backendUrl])

  if (!shouldRender) return null

  return (
    <div
      role="alert"
      data-testid="mixed-content-banner"
      className="flex items-start gap-2 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200 shrink-0"
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="leading-snug">
        {t("mixed_content.banner")}{" "}
        <a
          href={DOCS_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:no-underline"
        >
          {t("mixed_content.learn_more")}
          <ExternalLink size={10} aria-hidden="true" />
        </a>
      </span>
    </div>
  )
}
