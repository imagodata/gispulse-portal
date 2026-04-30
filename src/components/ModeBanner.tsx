/**
 * ModeBanner — Top-of-app strip telling the user which engine the
 * portal is talking to.
 *
 * Issue #31 (sprint v1.5.1, Mode 2 portal). Three states drive the
 * colour + copy:
 *
 *   demo                — backend = "" or demo.gispulse.dev   → blue
 *   connected           — custom backend, healthcheck ok      → green
 *   disconnected        — custom backend, healthcheck fail    → red
 *
 * Banner ships its own one-click "switch" affordance:
 *   - In demo mode  → "Use my engine" opens SettingsPanel.
 *   - In custom mode → "Back to demo" calls reset() (no modal,
 *     because the action is reversible and we want minimum friction).
 *
 * A11y: `role="status"` + `aria-live="polite"`. The disconnected
 * variant escalates to `role="alert"` because it implies an error
 * the user must act on (per WAI-ARIA 1.2 banner guidance).
 *
 * The banner does NOT itself probe `/health`; it consumes the latest
 * `healthStatus` from `settingsStore` (set by the SettingsPanel
 * healthcheck button or, future story, by an automatic poller). For
 * the demo case we trust the existing `BackendStatusBanner` —
 * keeping concerns separate.
 */

import { useEffect, useMemo } from "react"
import { Server, Globe, AlertTriangle } from "lucide-react"
import { useT } from "@/i18n/useT"
import { useSettingsStore } from "@/stores/settingsStore"
import { backendHostLabel, getBannerMode } from "@/utils/backendUrl"

interface Props {
  /** Click handler for the "Use my engine" CTA in demo mode. */
  onOpenSettings: () => void
}

export function ModeBanner({ onOpenSettings }: Props) {
  const t = useT()
  const backendUrl = useSettingsStore((s) => s.backendUrl)
  const healthStatus = useSettingsStore((s) => s.healthStatus)
  const runHealthcheck = useSettingsStore((s) => s.runHealthcheck)
  const reset = useSettingsStore((s) => s.reset)

  const mode = getBannerMode(backendUrl, healthStatus)
  const host = useMemo(() => backendHostLabel(backendUrl), [backendUrl])

  // First-mount probe when the user is on a custom engine — gives the
  // banner a real green/red state without forcing them to open
  // SettingsPanel. Only runs once per URL change.
  useEffect(() => {
    if (mode !== "demo" && healthStatus === "idle") {
      runHealthcheck()
    }
  }, [mode, healthStatus, runHealthcheck])

  let label: string
  let cls: string
  let Icon: typeof Globe
  let role: "status" | "alert" = "status"

  switch (mode) {
    case "demo":
      label = t("mode.banner.demo")
      cls = "bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300"
      Icon = Globe
      break
    case "connected":
      label = t("mode.banner.connected").replace("{host}", host)
      cls = "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
      Icon = Server
      break
    case "disconnected":
      label = t("mode.banner.disconnected").replace("{host}", host)
      cls = "bg-destructive/10 border-destructive/30 text-destructive"
      Icon = AlertTriangle
      role = "alert"
      break
  }

  const action =
    mode === "demo" ? (
      <button
        onClick={onOpenSettings}
        className="ml-2 rounded px-2 py-0.5 text-[11px] font-medium bg-background/40 hover:bg-background/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        {t("mode.banner.switch_to_engine")}
      </button>
    ) : (
      <button
        onClick={reset}
        className="ml-2 rounded px-2 py-0.5 text-[11px] font-medium bg-background/40 hover:bg-background/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        {t("mode.banner.switch_to_demo")}
      </button>
    )

  return (
    <div
      role={role}
      aria-live={role === "status" ? "polite" : "assertive"}
      data-testid="mode-banner"
      data-mode={mode}
      className={`flex items-center justify-center gap-2 border-b px-3 py-1 text-xs shrink-0 ${cls}`}
    >
      <Icon size={12} aria-hidden="true" />
      <span className="font-medium">{label}</span>
      {action}
    </div>
  )
}
