/**
 * Content-aware skeleton loading states for workspace transitions.
 * Shows a shape that roughly matches the target workspace layout.
 */

function Pulse({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

/** Skeleton for map-like workspaces (Map, Schema) */
export function MapSkeleton() {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Pulse className="h-7 w-24" />
        <Pulse className="h-7 w-16" />
        <div className="flex-1" />
        <Pulse className="h-7 w-7" />
        <Pulse className="h-7 w-7" />
      </div>
      {/* Map area */}
      <Pulse className="flex-1" />
    </div>
  )
}

/** Skeleton for table-like workspaces (Datasets) */
export function TableSkeleton() {
  return (
    <div className="flex h-full">
      {/* Left list */}
      <div className="w-60 shrink-0 border-r p-3 space-y-2">
        <Pulse className="h-5 w-full" />
        <Pulse className="h-4 w-3/4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Pulse key={i} className="h-8 w-full" />
        ))}
      </div>
      {/* Center table */}
      <div className="flex-1 p-3 space-y-2">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Pulse key={i} className="h-6 flex-1" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            {Array.from({ length: 5 }).map((_, j) => (
              <Pulse key={j} className="h-5 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for grid-like workspaces (Explorer, Catalog) */
export function GridSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Pulse className="h-6 w-40" />
        <Pulse className="h-7 w-20" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Pulse key={i} className="h-16" />
        ))}
      </div>
      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Pulse key={i} className="h-28" />
        ))}
      </div>
    </div>
  )
}

/** Skeleton for node editor workspaces (Workflows) */
export function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Pulse className="h-6 w-32" />
        <div className="flex-1" />
        <Pulse className="h-6 w-20" />
        <Pulse className="h-6 w-6" />
      </div>
      {/* Canvas with floating nodes */}
      <div className="flex-1 relative p-8">
        <Pulse className="absolute top-12 left-16 h-20 w-40" />
        <Pulse className="absolute top-20 left-72 h-20 w-36" />
        <Pulse className="absolute top-48 left-44 h-20 w-44" />
      </div>
    </div>
  )
}
