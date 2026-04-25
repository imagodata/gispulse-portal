/**
 * RenameDialog — Shared modal for renaming datasets (or any entity).
 *
 * Used by ExplorerWorkspace, DatasetsWorkspace, and LeftPanel.
 */

import { useState, useRef } from "react"
import { useFocusTrap } from "@/hooks/useFocusTrap"

interface RenameDialogProps {
  initialName: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function RenameDialog({ initialName, onConfirm, onCancel }: RenameDialogProps) {
  const [name, setName] = useState(initialName)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        className="relative z-10 w-full max-w-sm rounded-lg border bg-background p-5 shadow-xl"
      >
        <h2 id="rename-title" className="mb-3 text-sm font-semibold">Rename dataset</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onConfirm(name.trim())
            if (e.key === "Escape") onCancel()
          }}
          autoFocus
          className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(name.trim())}
            disabled={!name.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  )
}
