/**
 * ActivityTimeline — Sprint R-3, issue #129
 *
 * Displays a chronological list of project events (imports, jobs, triggers,
 * rule evaluations).  Fetches from GET /projects/{id}/activity and also
 * merges local in-progress jobs from jobStore.
 */

import { useEffect, useState, useCallback } from "react"
import {
  HardDrive,
  Play,
  Zap,
  SlidersHorizontal,
  FolderPlus,
  CheckCircle2,
  XCircle,
  Loader2,
  Info,
  RefreshCw,
} from "lucide-react"
import { getProjectActivity, type ActivityEventItem } from "@/api/client"
import { useJobStore } from "@/stores/jobStore"
import { useActiveProject } from "@/stores/projectStore"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const s = Math.floor(diff / 1000)
    if (s < 60) return "just now"
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  } catch {
    return ""
  }
}

function eventIcon(type: string) {
  const cls = "shrink-0 mt-0.5"
  switch (type) {
    case "dataset_import":
      return <HardDrive size={13} className={`${cls} text-blue-500`} />
    case "job_completed":
      return <Play size={13} className={`${cls} text-emerald-500`} />
    case "trigger_fired":
      return <Zap size={13} className={`${cls} text-amber-500`} />
    case "rule_applied":
      return <SlidersHorizontal size={13} className={`${cls} text-violet-500`} />
    case "project_created":
      return <FolderPlus size={13} className={`${cls} text-muted-foreground`} />
    default:
      return <Info size={13} className={`${cls} text-muted-foreground`} />
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 size={11} className="shrink-0 text-emerald-500" />
    case "error":
      return <XCircle size={11} className="shrink-0 text-destructive" />
    case "running":
      return <Loader2 size={11} className="shrink-0 text-blue-500 animate-spin" />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// ActivityTimeline
// ---------------------------------------------------------------------------

interface ActivityTimelineProps {
  /** Max items to display */
  limit?: number
  /** Show refresh button */
  showRefresh?: boolean
  /** Extra CSS classes */
  className?: string
}

export function ActivityTimeline({
  limit = 20,
  showRefresh = true,
  className = "",
}: ActivityTimelineProps) {
  const project = useActiveProject()
  const jobs = useJobStore((s) => s.jobs)

  const [items, setItems] = useState<ActivityEventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!project) return
    setLoading(true)
    setError(null)
    try {
      const res = await getProjectActivity(project.id, limit)
      setItems(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity")
    } finally {
      setLoading(false)
    }
  }, [project, limit])

  useEffect(() => {
    load()
  }, [load])

  // Merge local in-progress jobs on top of backend items
  const localJobItems: ActivityEventItem[] = jobs.map((j) => ({
    id: j.id,
    event_type: "job_completed",
    title: j.title,
    description: j.status === "error" ? j.errorMessage ?? null : null,
    status: j.status === "done" ? "success" : j.status === "error" ? "error" : "running",
    timestamp: new Date().toISOString(),
    metadata: {},
  }))

  // Combine: local jobs first (top), then backend items
  const allItems: ActivityEventItem[] = [
    ...localJobItems.filter((lj) => !items.some((i) => i.id === lj.id)),
    ...items,
  ]

  if (!project) {
    return (
      <div className={`flex items-center justify-center py-8 text-xs text-muted-foreground ${className}`}>
        No active project
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Header row */}
      <div className="flex items-center justify-between px-1 py-0.5">
        <span className="text-label font-semibold uppercase tracking-wider text-muted-foreground">
          Recent activity
        </span>
        {showRefresh && (
          <button
            onClick={load}
            disabled={loading}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
            title="Refresh"
            aria-label="Refresh activity"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && allItems.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <Info size={20} className="text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">No activity yet</p>
          <p className="text-label text-muted-foreground/60">
            Import a dataset or run a job to see events here
          </p>
        </div>
      )}

      {/* Items */}
      <div className="space-y-0 divide-y divide-border/40">
        {allItems.map((item) => (
          <ActivityItem key={item.id} item={item} />
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && items.length === 0 && (
        <div className="space-y-2 px-1 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-2 animate-pulse">
              <div className="mt-1 h-3 w-3 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-2/3 rounded bg-muted" />
                <div className="h-2 w-1/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActivityItem
// ---------------------------------------------------------------------------

function ActivityItem({ item }: { item: ActivityEventItem }) {
  return (
    <div className="flex items-start gap-2 py-2 px-1">
      {/* Event type icon */}
      {eventIcon(item.event_type)}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium leading-tight truncate">{item.title}</span>
          {statusIcon(item.status)}
        </div>
        {item.description && (
          <p className="mt-0.5 truncate text-label text-muted-foreground">
            {item.description}
          </p>
        )}
        {/* Metadata hints */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0">
          {item.metadata?.format ? (
            <span className="text-label-sm text-muted-foreground/70">
              {String(item.metadata.format).toUpperCase()}
            </span>
          ) : null}
          {typeof item.metadata?.duration_ms === "number" && (
            <span className="text-label-sm text-muted-foreground/70">
              {item.metadata.duration_ms}ms
            </span>
          )}
          {typeof item.metadata?.layer_count === "number" && item.metadata.layer_count > 0 && (
            <span className="text-label-sm text-muted-foreground/70">
              {item.metadata.layer_count} layer{item.metadata.layer_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <span className="shrink-0 text-label-sm text-muted-foreground/60 tabular-nums">
        {relativeTime(item.timestamp)}
      </span>
    </div>
  )
}
