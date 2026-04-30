/**
 * SettingsPanel — Modal panel surfacing user-side configuration.
 *
 * Issue #30 (sprint v1.5.1, Mode 2 portal). For the Community release
 * the only setting we expose is the backend engine URL. Future tabs
 * (theme overrides, telemetry opt-in, etc.) will hang off the same
 * dialog scaffold — keep the section pattern.
 *
 * Pattern :
 *  - Triggered by a gear icon in `TopNav`.
 *  - Modal, focus-trapped (`useFocusTrap`), Escape closes.
 *  - Form is uncontrolled-ish: local `draftUrl` + live validation; the
 *    store is only mutated on Save (or Reset).
 *  - Healthcheck probes `${draftUrl}/health` with 3 s timeout via the
 *    store's `runHealthcheck`. Visible green/red dot.
 */

import { useEffect, useRef, useState } from "react"
import { Settings, RefreshCw, Check, X } from "lucide-react"
import { useFocusTrap } from "@/hooks/useFocusTrap"
import { useT } from "@/i18n/useT"
import { useSettingsStore, type HealthStatus } from "@/stores/settingsStore"
import {
  validateBackendUrl,
  normalizeBackendUrl,
  type ValidationResult,
} from "@/utils/backendUrl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Outer wrapper handles the open/close gate so the inner stateful
 * panel remounts each time it opens — that's how we sync the draft
 * URL from the store without violating react-hooks/set-state-in-effect.
 */
export function SettingsPanel(props: Props) {
  if (!props.open) return null
  return <SettingsPanelInner {...props} />
}

function HealthDot({ status }: { status: HealthStatus }) {
  const cls =
    status === "ok"
      ? "bg-gp-success"
      : status === "fail"
        ? "bg-destructive"
        : status === "checking"
          ? "bg-amber-400 animate-pulse"
          : "bg-muted-foreground/40"
  return (
    <span
      data-testid="health-dot"
      data-status={status}
      aria-hidden="true"
      className={`inline-block h-2 w-2 rounded-full ${cls}`}
    />
  )
}

function SettingsPanelInner({ onClose }: Props) {
  const t = useT()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  const backendUrl = useSettingsStore((s) => s.backendUrl)
  const healthStatus = useSettingsStore((s) => s.healthStatus)
  const healthLatencyMs = useSettingsStore((s) => s.healthLatencyMs)
  const setBackendUrl = useSettingsStore((s) => s.setBackendUrl)
  const reset = useSettingsStore((s) => s.reset)
  const runHealthcheck = useSettingsStore((s) => s.runHealthcheck)

  // Initial draft is whatever the store holds at mount. Because the
  // outer wrapper only renders this component when `open=true`, the
  // initial value is always fresh — no useEffect sync needed.
  const [draftUrl, setDraftUrl] = useState(backendUrl)
  const [validation, setValidation] = useState<ValidationResult>({ ok: true })

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose])

  const handleDraftChange = (v: string) => {
    setDraftUrl(v)
    // Live validation, but don't display error until user blurs / submits
    setValidation(validateBackendUrl(v))
  }

  const handleHealthcheck = () => {
    const v = validateBackendUrl(draftUrl)
    setValidation(v)
    if (!v.ok) return
    runHealthcheck(normalizeBackendUrl(draftUrl))
  }

  const handleSave = () => {
    const v = validateBackendUrl(draftUrl)
    setValidation(v)
    if (!v.ok) return
    setBackendUrl(draftUrl)
    onClose()
  }

  const handleReset = () => {
    reset()
    setDraftUrl("")
    setValidation({ ok: true })
  }

  const errorKey =
    !validation.ok && validation.reason ? (`error.backend_url.${validation.reason}` as const) : null

  const healthLabel =
    healthStatus === "checking"
      ? t("settings.backend.checking")
      : healthStatus === "ok"
        ? t("settings.backend.health_ok").replace("{ms}", String(healthLatencyMs ?? 0))
        : healthStatus === "fail"
          ? t("settings.backend.health_fail")
          : ""

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        aria-describedby="settings-desc"
        className="relative z-10 w-full max-w-md rounded-lg border bg-background p-5 shadow-xl"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="settings-title" className="text-sm font-semibold flex items-center gap-1.5">
              <Settings size={14} aria-hidden="true" />
              {t("settings.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-md p-1 hover:bg-accent transition-colors text-muted-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <section aria-labelledby="settings-section-backend">
          <h3 id="settings-section-backend" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {t("settings.section.backend")}
          </h3>
          <p id="settings-desc" className="text-xs text-muted-foreground mb-3">
            {t("settings.backend.description")}
          </p>

          <label htmlFor="settings-backend-url" className="block text-xs font-medium mb-1">
            {t("settings.backend.url_label")}
          </label>
          <Input
            id="settings-backend-url"
            type="url"
            inputMode="url"
            spellCheck={false}
            autoComplete="off"
            value={draftUrl}
            placeholder={t("settings.backend.url_placeholder")}
            onChange={(e) => handleDraftChange(e.target.value)}
            aria-invalid={errorKey !== null}
            aria-describedby={errorKey ? "settings-backend-error" : "settings-backend-hint"}
          />
          {errorKey ? (
            <p
              id="settings-backend-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {t(errorKey)}
            </p>
          ) : (
            <p id="settings-backend-hint" className="mt-1 text-xs text-muted-foreground">
              {t("settings.backend.url_hint")}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleHealthcheck}
              disabled={healthStatus === "checking" || !validation.ok}
              aria-label={t("settings.backend.healthcheck")}
            >
              <RefreshCw
                size={12}
                className={healthStatus === "checking" ? "animate-spin" : ""}
                aria-hidden="true"
              />
              {t("settings.backend.healthcheck")}
            </Button>
            {healthStatus !== "idle" && (
              <span
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <HealthDot status={healthStatus} />
                {healthLabel}
              </span>
            )}
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-2 border-t pt-4">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            {t("settings.backend.reset")}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={!validation.ok}
            >
              <Check size={12} aria-hidden="true" />
              {t("settings.backend.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
