/**
 * ReadOnlyDemoDialog — "Connect your engine to save" modal.
 *
 * Issue #31 (Mode 2 portal). Triggered when the user attempts a
 * write action while the portal is bound to the public demo
 * backend. We do NOT actually wire write-action gating in this
 * sprint — the dialog is shipped as a reusable surface so that
 * future PRs (mutating endpoints) can call `<ReadOnlyDemoDialog />`
 * with a single state hook.
 */

import { useEffect, useRef } from "react"
import { Lock, ExternalLink } from "lucide-react"
import { useFocusTrap } from "@/hooks/useFocusTrap"
import { useT } from "@/i18n/useT"
import { Button } from "@/components/ui/button"

interface Props {
  open: boolean
  onClose: () => void
  /** Called when the user clicks "Open settings". */
  onOpenSettings: () => void
  /** Optional override for the docs link. Default = engine guide. */
  docsHref?: string
}

const DEFAULT_DOCS = "https://imagodata.github.io/gispulse/cli/portal.html"

export function ReadOnlyDemoDialog({ open, onClose, onOpenSettings, docsHref = DEFAULT_DOCS }: Props) {
  const t = useT()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="readonly-title"
        aria-describedby="readonly-desc"
        className="relative z-10 w-full max-w-sm rounded-lg border bg-background p-5 shadow-xl"
      >
        <div className="flex items-center gap-2 mb-2">
          <Lock size={16} className="text-amber-500" aria-hidden="true" />
          <h2 id="readonly-title" className="text-sm font-semibold">
            {t("mode.readonly.title")}
          </h2>
        </div>
        <p id="readonly-desc" className="text-xs text-muted-foreground mb-4">
          {t("mode.readonly.body")}
        </p>
        <div className="flex justify-end gap-2">
          <a
            href={docsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-accent transition-colors"
          >
            <ExternalLink size={12} aria-hidden="true" />
            {t("mode.readonly.cta_docs")}
          </a>
          <Button variant="default" size="sm" onClick={onOpenSettings}>
            {t("mode.readonly.cta_settings")}
          </Button>
        </div>
      </div>
    </div>
  )
}
