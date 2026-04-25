/**
 * ValidationNode — Data quality validation rules (BEFORE phase).
 * Geometry valid, not null, enum, range, etc.
 * Can block the DML or just warn.
 */

import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "../portTypes"
import { StatusBadge } from "../StatusBadge"
import { useEditorStore, type NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "../nodeStyles"
import { ShieldCheck, Plus, X } from "lucide-react"
import { VALIDATION_RULES, type ValidationData, type ValidationRuleType } from "./types"

const ON_FAIL_OPTIONS = ["block", "warn", "tag"] as const

export function ValidationNode({ id, data }: NodeProps) {
  const d = data as unknown as ValidationData & { status?: NodeExecStatus }
  const { setNodes } = useReactFlow()
  const setGraphDirty = useEditorStore((s) => s.setGraphDirty)

  const rules = d.rules || []

  const updateRules = (newRules: ValidationData["rules"]) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, rules: newRules } } : n)),
    )
    setGraphDirty(true)
  }

  const addRule = () => {
    updateRules([...rules, { type: "geometry_valid" as ValidationRuleType, config: {}, onFail: "block" }])
  }

  const removeRule = (idx: number) => {
    updateRules(rules.filter((_, i) => i !== idx))
  }

  const updateRule = (idx: number, key: string, value: unknown) => {
    const updated = rules.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    updateRules(updated)
  }

  return (
    <div className={nodeContainerClass("control")}>
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 ${PORT_COLORS.event} !border-2 !border-white dark:!border-gray-900`}
      />

      <div className={nodeHeaderClass("control")}>
        <ShieldCheck className="h-3 w-3 inline mr-1 -mt-0.5" />
        Validation · BEFORE
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {d.label || "Validation"}
      </div>

      <div className="mt-1.5 space-y-1.5 max-h-[200px] overflow-y-auto">
        {rules.map((rule, idx) => {
          const ruleDef = VALIDATION_RULES.find((v) => v.type === rule.type)
          return (
            <div key={idx} className="bg-background/50 rounded px-1 py-0.5 space-y-0.5">
              <div className="flex items-center gap-1">
                <select
                  value={rule.type}
                  onChange={(e) => { e.stopPropagation(); updateRule(idx, "type", e.target.value) }}
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag flex-1 text-label rounded border border-[var(--gp-node-control)]/30 bg-background px-1 py-0.5 outline-none"
                >
                  {VALIDATION_RULES.map((v) => (
                    <option key={v.type} value={v.type}>{v.label}</option>
                  ))}
                </select>
                <select
                  value={rule.onFail}
                  onChange={(e) => { e.stopPropagation(); updateRule(idx, "onFail", e.target.value) }}
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag w-14 text-label rounded border border-[var(--gp-node-control)]/30 bg-background px-0.5 py-0.5 outline-none"
                >
                  {ON_FAIL_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeRule(idx) }}
                  className="nodrag text-muted-foreground hover:text-red-500 p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              {/* Config fields for rules that require them */}
              {ruleDef && ruleDef.configFields.length > 0 && (
                <div className="pl-1 space-y-0.5">
                  {ruleDef.configFields.map((field) => (
                    <input
                      key={field}
                      type="text"
                      value={String(rule.config[field] ?? "")}
                      onChange={(e) => {
                        e.stopPropagation()
                        updateRule(idx, "config", { ...rule.config, [field]: e.target.value })
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={field}
                      className="nodrag w-full text-label-sm font-mono rounded border border-[var(--gp-node-control)]/30 bg-background px-1 py-0.5 outline-none"
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); addRule() }}
        className="nodrag mt-1 flex items-center gap-1 text-label text-[var(--gp-node-control)] hover:underline"
      >
        <Plus className="h-2.5 w-2.5" />
        Add rule
      </button>

      {d.order != null && (
        <div className="mt-0.5 text-label text-muted-foreground font-mono">
          order: {d.order}
        </div>
      )}

      <StatusBadge status={d.status} />
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3 !h-3 ${PORT_COLORS.event} !border-2 !border-white dark:!border-gray-900`}
      />
    </div>
  )
}
