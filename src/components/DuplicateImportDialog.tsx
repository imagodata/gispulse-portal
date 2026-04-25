import type { PendingDuplicate } from "@/hooks/useDatasetImport"

interface Props {
  pending: PendingDuplicate
  onCancel: () => void
  onConfirm: () => void
}

export function DuplicateImportDialog({ pending, onCancel, onConfirm }: Props) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="bg-background border rounded-lg shadow-xl p-5 w-80 flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold mb-1">File already imported</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">"{pending.existingName}"</span>{" "}
            is already in the project. Import anyway?
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            className="text-xs px-3 py-1.5 rounded border hover:bg-accent transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={onConfirm}
          >
            Import anyway
          </button>
        </div>
      </div>
    </div>
  )
}
