/**
 * RuleBasedEditor — Define filter-based rendering rules.
 *
 * Each rule has: name, filter expression, symbol, enabled toggle.
 * Filter format: "field op value" (e.g. "status = 'active'", "population > 10000")
 */

import { useCallback } from "react"
import { Plus, Trash2, Eye, EyeOff, X } from "lucide-react"
import type { RuleEntry, GeomFamily } from "@/types/layerStyle"
import type { LayerField } from "@/types/dataset"
import { defaultSymbol } from "@/types/layerStyle"
import { QUALITATIVE_RAMPS, pickQualitative } from "@/lib/colorRamps"
import { SwatchPicker, StyleSection } from "./shared"

interface Props {
  geom: GeomFamily
  fields: LayerField[]
  rules: RuleEntry[]
  onRulesChange: (rules: RuleEntry[]) => void
}

export function RuleBasedEditor({ geom, fields, rules, onRulesChange }: Props) {
  const addRule = useCallback(() => {
    const colors = pickQualitative(QUALITATIVE_RAMPS[0], rules.length + 1)
    const newRule: RuleEntry = {
      name: `Rule ${rules.length + 1}`,
      filter: "",
      symbol: defaultSymbol(geom, colors[rules.length] ?? "#888888"),
      enabled: true,
    }
    onRulesChange([...rules, newRule])
  }, [rules, geom, onRulesChange])

  const updateRule = useCallback(
    (idx: number, patch: Partial<RuleEntry>) => {
      const next = [...rules]
      next[idx] = { ...next[idx], ...patch }
      onRulesChange(next)
    },
    [rules, onRulesChange],
  )

  const removeRule = useCallback(
    (idx: number) => onRulesChange(rules.filter((_, i) => i !== idx)),
    [rules, onRulesChange],
  )

  const updateRuleColor = useCallback(
    (idx: number, color: string) => {
      const sym = { ...rules[idx].symbol } as any
      sym.color = color
      if (sym.kind === "fill") sym.strokeColor = color
      updateRule(idx, { symbol: sym })
    },
    [rules, updateRule],
  )

  return (
    <StyleSection title="Rule-Based">
      {/* Field hint */}
      {fields.length > 0 && (
        <div className="text-label-sm text-muted-foreground bg-muted/50 rounded px-2 py-1">
          Available fields: {fields.slice(0, 6).map((f) => (
            <code key={f.name} className="font-mono text-foreground/70">{f.name}</code>
          )).reduce((acc: React.ReactNode[], el, i) => i === 0 ? [el] : [...acc, ", ", el], [])}
          {fields.length > 6 && <span> +{fields.length - 6} more</span>}
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-1.5">
        {rules.map((rule, i) => (
          <div key={i} className="rounded border border-border p-1.5 space-y-1 group">
            {/* Rule header */}
            <div className="flex items-center gap-1.5">
              <SwatchPicker
                color={(rule.symbol as any).color ?? "#888888"}
                onChange={(c) => updateRuleColor(i, c)}
              />
              <input
                type="text"
                value={rule.name}
                onChange={(e) => updateRule(i, { name: e.target.value })}
                className="flex-1 text-xs bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none px-0.5 min-w-0"
                placeholder="Rule name"
              />
              <button
                onClick={() => updateRule(i, { enabled: !rule.enabled })}
                className={`shrink-0 p-0.5 rounded transition-colors ${
                  rule.enabled ? "text-primary" : "text-muted-foreground/40"
                }`}
                title={rule.enabled ? "Disable" : "Enable"}
              >
                {rule.enabled ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>
              <button
                onClick={() => removeRule(i)}
                className="shrink-0 p-0.5 rounded text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
            </div>

            {/* Filter expression */}
            <input
              type="text"
              value={rule.filter}
              onChange={(e) => updateRule(i, { filter: e.target.value })}
              className="w-full text-xs font-mono bg-muted/50 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-ring border border-transparent focus:border-primary"
              placeholder="e.g. status = 'active' or population > 10000"
              spellCheck={false}
            />
          </div>
        ))}
      </div>

      {/* Add rule */}
      <button
        onClick={addRule}
        className="flex items-center justify-center gap-1.5 w-full h-7 rounded border border-dashed border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <Plus size={12} />
        Add rule
      </button>

      {rules.length === 0 && (
        <p className="text-label-sm text-muted-foreground text-center py-2">
          Add rules with filter expressions to style features conditionally.
        </p>
      )}
    </StyleSection>
  )
}
