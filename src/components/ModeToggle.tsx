/**
 * ModeToggle — Compact segmented control in the TopNav (#31).
 *
 * Two segments: "Try it" (= demo / built-in proxy backend) and
 * "My engine" (= user-configured backend). Active segment is decided
 * from `settingsStore.backendUrl`:
 *   - empty string → "demo" segment is active
 *   - any other value → "engine" segment is active
 *
 * Behaviour:
 *   - Click "Try it" while on engine: `reset()` (returns to empty
 *     backend, no modal — symmetric to `ModeBanner.switch_to_demo`).
 *   - Click "My engine" while on demo: open SettingsPanel so the user
 *     can paste their backend URL.
 *
 * Read-only signal: when on demo, the segment carries a tooltip
 * (`title=mode.toggle.readonly_tooltip`) so users hovering over the
 * "Try it" pill discover that demo write-actions are blocked.
 *
 * The wider `ModeBanner` (above content) remains the primary visual
 * confirmation; this toggle is the discoverable header affordance
 * users from QGIS/desktop expect.
 */

import { useT } from "@/i18n/useT"
import { useSettingsStore } from "@/stores/settingsStore"

interface Props {
  onOpenSettings: () => void
}

export function ModeToggle({ onOpenSettings }: Props) {
  const t = useT()
  const backendUrl = useSettingsStore((s) => s.backendUrl)
  const reset = useSettingsStore((s) => s.reset)

  const isDemo = backendUrl === ""

  const baseCls =
    "px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
  const activeCls = "bg-foreground text-background"
  const idleCls = "text-muted-foreground hover:text-foreground"

  return (
    <div
      role="group"
      aria-label={t("mode.toggle.try_it") + " / " + t("mode.toggle.my_engine")}
      data-testid="mode-toggle"
      className="inline-flex items-center gap-0.5 rounded border bg-background/40 p-0.5 mr-1"
    >
      <button
        type="button"
        onClick={() => {
          if (!isDemo) reset()
        }}
        aria-pressed={isDemo}
        title={isDemo ? t("mode.toggle.readonly_tooltip") : undefined}
        className={`${baseCls} ${isDemo ? activeCls : idleCls}`}
        data-testid="mode-toggle-demo"
      >
        {t("mode.toggle.try_it")}
      </button>
      <button
        type="button"
        onClick={() => {
          if (isDemo) onOpenSettings()
        }}
        aria-pressed={!isDemo}
        className={`${baseCls} ${!isDemo ? activeCls : idleCls}`}
        data-testid="mode-toggle-engine"
      >
        {t("mode.toggle.my_engine")}
      </button>
    </div>
  )
}
