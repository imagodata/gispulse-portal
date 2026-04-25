/**
 * HybridRelationEdge — 3-level visual edge for the Hybrid Schema.
 *
 * Level 1 (passive):  Dashed, thin — relation only, no trigger
 * Level 2 (reactive): Solid, medium — relation + attached trigger
 * Level 3 (active):   Solid thick, animated — relation + trigger + computed fields
 */

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react"
import { Zap, Activity, Link2 } from "lucide-react"

// ---------------------------------------------------------------------------
// Edge data contract (injected by SchemaView)
// ---------------------------------------------------------------------------

export interface HybridEdgeData {
  /** Relation type: fk, spatial, attribute, custom */
  relationType: string
  /** User-facing label */
  label: string
  /** Detection confidence 0-1 */
  confidence: number
  /** Spatial predicate (intersects, within, etc.) */
  spatialOp?: string | null
  /** Whether the relation is confirmed */
  confirmed?: boolean
  /** Attached trigger ID (null = passive) */
  triggerId?: string | null
  /** Whether the trigger is enabled */
  triggerEnabled?: boolean
  /** Number of computed fields (0 = no active computations) */
  computedFieldCount?: number
  /** Relation backend ID (for selection) */
  relationId?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  fk: "#a78bfa",         // violet-400
  attribute: "#8b5cf6",  // violet-500
  spatial: "#06b6d4",    // cyan-500
  topological: "#f59e0b",// amber-500
  custom: "#6b7280",     // gray-500
}

type EdgeLevel = "passive" | "reactive" | "active"

function getLevel(d: HybridEdgeData): EdgeLevel {
  if (d.computedFieldCount && d.computedFieldCount > 0 && d.triggerEnabled !== false) return "active"
  if (d.triggerId && d.triggerEnabled !== false) return "reactive"
  return "passive"
}

function getLevelIcon(level: EdgeLevel) {
  switch (level) {
    case "active": return <Zap size={10} className="text-emerald-500" />
    case "reactive": return <Activity size={10} className="text-cyan-400" />
    case "passive": return <Link2 size={10} className="text-gray-400" />
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HybridRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const d = (data ?? {}) as unknown as HybridEdgeData
  const relType = d.relationType ?? "attribute"
  const label = d.label ?? ""
  const confidence = d.confidence ?? 0
  const baseColor = TYPE_COLORS[relType] ?? TYPE_COLORS.custom
  const level = getLevel(d)

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  })

  // Visual style per level
  const strokeWidth = level === "active" ? 3 : level === "reactive" ? 2 : 1.5
  const strokeDasharray = level === "passive" ? "6 3" : undefined
  const edgeColor = level === "active" ? "#10b981" : level === "reactive" ? "#06b6d4" : baseColor
  const animate = level === "active"

  return (
    <>
      {/* Glow for active edges */}
      {animate && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            stroke: "#10b981",
            strokeWidth: 6,
            strokeOpacity: 0.15,
            filter: "blur(3px)",
          }}
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: edgeColor,
          strokeWidth,
          strokeDasharray,
          transition: "stroke 0.3s, stroke-width 0.3s",
          ...(animate ? { animation: "edgePulse 2s ease-in-out infinite" } : {}),
        }}
      />

      {/* Selection ring */}
      {selected && (
        <BaseEdge
          id={`${id}-sel`}
          path={edgePath}
          style={{
            stroke: edgeColor,
            strokeWidth: strokeWidth + 4,
            strokeOpacity: 0.2,
          }}
        />
      )}

      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan pointer-events-auto absolute flex items-center gap-1.5 rounded-full border bg-background/95 px-2.5 py-1 shadow-sm backdrop-blur transition-all cursor-pointer
            ${selected ? "ring-2 ring-offset-1" : ""}
          `}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            borderColor: edgeColor,
            ...(selected ? { ringColor: edgeColor } : {}),
          }}
        >
          {/* Level icon */}
          {getLevelIcon(level)}

          {/* Type badge */}
          <span
            className="text-label-sm font-semibold uppercase"
            style={{ color: edgeColor }}
          >
            {d.spatialOp ?? relType}
          </span>

          {/* Label */}
          {label && (
            <span className="text-label text-foreground font-mono truncate max-w-[120px]">
              {label}
            </span>
          )}

          {/* Confidence pill */}
          <span
            className="text-label-sm font-semibold rounded-full px-1.5 py-px"
            style={{
              backgroundColor: `${edgeColor}20`,
              color: edgeColor,
            }}
          >
            {Math.round(confidence * 100)}%
          </span>

          {/* Computed fields count */}
          {d.computedFieldCount && d.computedFieldCount > 0 && (
            <span className="text-label-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <Zap size={8} />
              {d.computedFieldCount}
            </span>
          )}

          {/* Trigger indicator */}
          {d.triggerId && !d.computedFieldCount && d.triggerEnabled !== false && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500" />
            </span>
          )}
          {/* Disabled trigger indicator */}
          {d.triggerId && d.triggerEnabled === false && (
            <span className="text-label-sm text-muted-foreground line-through opacity-50" title="Trigger disabled">
              <Activity size={8} />
            </span>
          )}
        </div>
      </EdgeLabelRenderer>

      {/* CSS animation for active edges (injected once) */}
      <style>{`
        @keyframes edgePulse {
          0%, 100% { stroke-opacity: 1; }
          50% { stroke-opacity: 0.6; }
        }
      `}</style>
    </>
  )
}
