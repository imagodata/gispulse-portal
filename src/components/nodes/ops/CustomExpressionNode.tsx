/**
 * CustomExpressionNode — Free-form SQL expression with security validation.
 * Variables: $1 (NEW jsonb), $2 (OLD jsonb), $3 (row_id).
 * Validated against Forge security rules (no DROP, TRUNCATE, GRANT, etc.).
 */

import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "../portTypes"
import { StatusBadge } from "../StatusBadge"
import { useEditorStore, type NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "../nodeStyles"
import { Code, SkipForward, AlertTriangle, CheckCircle } from "lucide-react"
import { useState, useMemo } from "react"
import type { CustomExpressionData } from "./types"

// Forge security: block dangerous SQL patterns
const BLOCKED_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TABLE\b.*\bDROP\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bCREATE\s+ROLE\b/i,
  /\bCREATE\s+USER\b/i,
]

function validateExpression(expr: string): { valid: boolean; error?: string } {
  if (!expr.trim()) return { valid: false, error: "Expression is empty" }
  if (expr.length > 5000) return { valid: false, error: `Too long (${expr.length}/5000 chars)` }
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(expr)) return { valid: false, error: `Blocked pattern: ${pat.source}` }
  }
  return { valid: true }
}

export function CustomExpressionNode({ id, data }: NodeProps) {
  const d = data as unknown as CustomExpressionData & { status?: NodeExecStatus }
  const { setNodes } = useReactFlow()
  const setGraphDirty = useEditorStore((s) => s.setGraphDirty)
  const [expanded, setExpanded] = useState(false)

  const update = (key: string, value: unknown) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n)),
    )
    setGraphDirty(true)
  }

  const validation = useMemo(() => validateExpression(d.expression || ""), [d.expression])
  const previewLines = (d.expression || "").split("\n").slice(0, 3)

  return (
    <div className={nodeContainerClass("code")}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${PORT_COLORS.event} !border-2 !border-white dark:!border-gray-900`}
      />

      <div className={nodeHeaderClass("code")}>
        <Code className="h-3 w-3 inline mr-1 -mt-0.5" />
        Custom · {(d.phase || "before").toUpperCase()}
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {d.label || "Expression"}
      </div>

      <div className="mt-1.5 space-y-1">
        {/* Phase selector */}
        <select
          value={d.phase || "before"}
          onChange={(e) => { e.stopPropagation(); update("phase", e.target.value) }}
          onClick={(e) => e.stopPropagation()}
          className="nodrag w-full text-label rounded border border-[var(--gp-node-code)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-code)]"
        >
          <option value="before">BEFORE</option>
          <option value="after">AFTER</option>
        </select>

        {/* Target field */}
        <input
          type="text"
          value={d.field || ""}
          onChange={(e) => { e.stopPropagation(); update("field", e.target.value) }}
          onClick={(e) => e.stopPropagation()}
          placeholder="→ result field"
          className="nodrag w-full text-label rounded border border-[var(--gp-node-code)]/30 bg-background px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[var(--gp-node-code)] font-mono"
        />

        {/* SQL Expression preview/editor */}
        <div
          className="nodrag cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
        >
          {expanded ? (
            <textarea
              value={d.expression || ""}
              onChange={(e) => { e.stopPropagation(); update("expression", e.target.value) }}
              onClick={(e) => e.stopPropagation()}
              rows={6}
              placeholder="($1->>'length_m')::NUMERIC * 12.5"
              className="nodrag w-full text-label rounded border border-[var(--gp-node-code)]/30 bg-slate-900 text-green-400 px-1.5 py-1 outline-none focus:ring-1 focus:ring-[var(--gp-node-code)] font-mono resize-y"
            />
          ) : (
            <div className="w-full text-label rounded border border-[var(--gp-node-code)]/30 bg-slate-900/50 px-1.5 py-1 font-mono text-green-400/70 truncate min-h-[24px]">
              {previewLines.map((line, i) => (
                <div key={i} className="truncate">{line || "\u00A0"}</div>
              ))}
              {(d.expression || "").split("\n").length > 3 && (
                <div className="text-muted-foreground">...</div>
              )}
            </div>
          )}
        </div>

        {/* Validation indicator */}
        <div className="flex items-center gap-1 text-label">
          {validation.valid ? (
            <>
              <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
              <span className="text-emerald-600">{(d.expression || "").length}/5000</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-2.5 w-2.5 text-red-500" />
              <span className="text-red-500 truncate">{validation.error}</span>
            </>
          )}
        </div>
      </div>

      {/* Coalesce indicator */}
      {d.coalesce && (
        <div className="mt-1 flex items-center gap-1 text-label text-amber-600">
          <SkipForward className="h-2.5 w-2.5" />
          <span>coalesce</span>
        </div>
      )}

      {d.order != null && (
        <div className="mt-0.5 text-label text-muted-foreground font-mono">
          order: {d.order}
        </div>
      )}

      <StatusBadge status={d.status} />
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3 !h-3 ${PORT_COLORS.any} !border-2 !border-white dark:!border-gray-900`}
      />
    </div>
  )
}
