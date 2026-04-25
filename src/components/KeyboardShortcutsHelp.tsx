import { useEffect, useRef } from "react"
import { KEYBOARD_SHORTCUTS } from "@/hooks/useKeyboardShortcuts"
import { useFocusTrap } from "@/hooks/useFocusTrap"

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

function KeyBadge({ children }: { children: string }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 rounded border border-border bg-muted text-label-lg font-mono font-medium text-foreground shadow-sm"
    >
      {children}
    </kbd>
  )
}

function ShortcutRow({ shortcut }: { shortcut: typeof KEYBOARD_SHORTCUTS[number] }) {
  const keys: string[] = []
  if (shortcut.modifiers.includes("ctrl")) keys.push("Ctrl")
  if (shortcut.modifiers.includes("shift")) keys.push("Shift")
  if (shortcut.modifiers.includes("alt")) keys.push("Alt")
  keys.push(shortcut.key === "?" ? "?" : shortcut.key.toUpperCase())

  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-xs text-muted-foreground">{shortcut.description}</span>
      <div className="flex items-center gap-1 shrink-0">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/50 text-label">+</span>}
            <KeyBadge>{k}</KeyBadge>
          </span>
        ))}
      </div>
    </div>
  )
}

export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  // Group shortcuts by their group
  const groups = KEYBOARD_SHORTCUTS.reduce<Record<string, typeof KEYBOARD_SHORTCUTS>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = []
    acc[s.group].push(s)
    return acc
  }, {})

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-[480px] mx-4 max-h-[80vh] overflow-y-auto rounded-xl border bg-popover shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <span aria-hidden="true">&#x2715;</span>
          </button>
        </div>

        {/* Groups */}
        <div className="px-5 py-4 flex flex-col gap-5">
          {Object.entries(groups).map(([group, shortcuts]) => (
            <div key={group}>
              <p className="text-label font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                {group}
              </p>
              <div className="divide-y divide-border/50">
                {shortcuts.map((s, i) => (
                  <ShortcutRow key={i} shortcut={s} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t text-label text-muted-foreground">
          Press <KeyBadge>Ctrl</KeyBadge> + <KeyBadge>?</KeyBadge> to toggle this panel
        </div>
      </div>
    </div>
  )
}
