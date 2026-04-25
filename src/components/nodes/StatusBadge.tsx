import type { NodeExecStatus } from "@/stores/editorStore"

interface StatusBadgeProps {
  status?: NodeExecStatus
  featureCount?: number
}

const DOT_CLASSES: Record<NodeExecStatus, string> = {
  pending: "bg-gray-400",
  running: "bg-yellow-500 animate-spin border border-yellow-300 border-t-transparent",
  success: "bg-emerald-500",
  failed: "bg-red-500",
}

const STATUS_LABELS: Record<NodeExecStatus, string | null> = {
  pending: "Pending",
  running: "Running...",
  success: null, // show featureCount instead
  failed: "Error",
}

export function StatusBadge({ status, featureCount }: StatusBadgeProps) {
  if (!status) return null

  return (
    <div className="mt-2 pt-2 border-t border-current/10">
      <div className="flex items-center gap-1.5 text-label">
        <span className={`inline-block w-2 h-2 rounded-full ${DOT_CLASSES[status]}`} />
        <span className="text-muted-foreground font-mono">
          {STATUS_LABELS[status] ?? `${featureCount ?? 0} features`}
        </span>
      </div>
    </div>
  )
}
