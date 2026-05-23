import { useState } from "react"
import { Search, X, Pencil } from "lucide-react"

import { IconButton } from "@/components/ui/icon-button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

import { useUIStore } from "@/stores/uiStore"
import { useProjectStore } from "@/stores/projectStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { useEditorStore } from "@/stores/editorStore"

import { SectionHeader } from "@/components/panels/SectionHeader"
import { GeomIcon } from "@/components/layers"
import { NodePalette } from "@/components/nodes/NodePalette"
import { navigateToView } from "@/router"

import type { Rule, Trigger } from "@/types/project"

// ---------- Rules Section ----------

export function RulesSection() {
  const { rules, toggleRule, deleteRule } = useProjectStore()
  const openRuleEditor = useEditorStore((s) => s.openRuleEditor)
  const setContextSelection = useUIStore((s) => s.setContextSelection)

  return (
    <>
      <SectionHeader title="Rules" count={rules.length} onAdd={() => openRuleEditor()} />
      <ScrollArea className="flex-1">
        {rules.length > 0 ? (
          <div className="p-2 space-y-1">
            {rules.map((rule: Rule) => (
              <div
                key={rule.id}
                onClick={() => setContextSelection({ type: "rule", ruleId: rule.id })}
                className="group flex items-center gap-2 rounded-md px-2.5 py-2 text-xs cursor-pointer hover:bg-accent transition-colors"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleRule(rule.id, !rule.enabled)
                  }}
                  className={`shrink-0 text-label ${rule.enabled ? "text-green-500" : "text-muted-foreground/40"}`}
                >
                  {rule.enabled ? "\u25C9" : "\u25CB"}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{rule.name}</div>
                  <div className="text-label text-muted-foreground truncate">{rule.capability}</div>
                </div>
                <IconButton
                  label="Delete"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteRule(rule.id)
                  }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </IconButton>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-3">No rules configured</p>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => openRuleEditor()}>
              Create first rule
            </Button>
          </div>
        )}
      </ScrollArea>
    </>
  )
}

// ---------- Triggers Section ----------

export function TriggersSection() {
  const { triggers, toggleTrigger, deleteTrigger } = useProjectStore()
  const openTriggerBuilder = useEditorStore((s) => s.openTriggerBuilder)
  const setContextSelection = useUIStore((s) => s.setContextSelection)

  return (
    <>
      <SectionHeader title="Triggers" count={triggers.length} onAdd={() => openTriggerBuilder()} />
      <ScrollArea className="flex-1">
        {triggers.length > 0 ? (
          <div className="p-2 space-y-1">
            {triggers.map((trigger: Trigger) => (
              <div
                key={trigger.id}
                onClick={() => setContextSelection({ type: "trigger", triggerId: trigger.id })}
                className="group flex items-center gap-2 rounded-md px-2.5 py-2 text-xs cursor-pointer hover:bg-accent transition-colors"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleTrigger(trigger.id)
                  }}
                  className={`shrink-0 text-label ${trigger.enabled ? "text-green-500" : "text-muted-foreground/40"}`}
                >
                  {trigger.enabled ? "\u25C9" : "\u25CB"}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{trigger.name}</div>
                  <div className="text-label text-muted-foreground truncate">
                    {trigger.trigger_type} / {trigger.event}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <IconButton
                    label="Edit"
                    onClick={(e) => {
                      e.stopPropagation()
                      openTriggerBuilder(trigger.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Pencil size={12} />
                  </IconButton>
                  <IconButton
                    label="Delete"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteTrigger(trigger.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-3">No triggers configured</p>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => openTriggerBuilder()}>
              Create first trigger
            </Button>
          </div>
        )}
      </ScrollArea>
    </>
  )
}

// ---------- Catalog Section ----------

export function CatalogSection() {
  return (
    <>
      <SectionHeader title="Catalog" />
      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Browse available data sources and catalog entries.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 mt-3"
            onClick={() => navigateToView("catalog")}
          >
            Open Catalog View
          </Button>
        </div>
      </ScrollArea>
    </>
  )
}

// ---------- Search Section ----------

export function SearchSection() {
  const [query, setQuery] = useState("")
  const datasets = useDatasetStore((s) => s.datasets)
  const rules = useProjectStore((s) => s.rules)
  const triggers = useProjectStore((s) => s.triggers)
  const selectLayer = useDatasetStore((s) => s.selectLayer)
  const setContextSelection = useUIStore((s) => s.setContextSelection)
  const openRuleEditor = useEditorStore((s) => s.openRuleEditor)
  const openTriggerBuilder = useEditorStore((s) => s.openTriggerBuilder)

  const q = query.toLowerCase().trim()

  const matchedLayers = q
    ? datasets.flatMap((ds) =>
        (ds.layers ?? [])
          .filter((l) => l.name.toLowerCase().includes(q) || ds.name.toLowerCase().includes(q))
          .map((l) => ({ type: "layer" as const, ds, layer: l }))
      )
    : []

  const matchedRules = q
    ? rules.filter((r) => r.name.toLowerCase().includes(q) || r.capability.toLowerCase().includes(q))
    : []

  const matchedTriggers = q
    ? triggers.filter((t) => t.name.toLowerCase().includes(q) || t.trigger_type.toLowerCase().includes(q))
    : []

  const totalResults = matchedLayers.length + matchedRules.length + matchedTriggers.length

  return (
    <>
      <SectionHeader title="Search" />
      <div className="p-3">
        <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search layers, rules, triggers..."
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground/60 hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>
        {q && (
          <p className="text-label text-muted-foreground mt-1 px-1">{totalResults} result{totalResults !== 1 ? "s" : ""}</p>
        )}
      </div>
      <ScrollArea className="flex-1">
        {!q ? (
          <p className="px-4 py-6 text-center text-label-lg text-muted-foreground">
            Type to search across all project items.
          </p>
        ) : totalResults === 0 ? (
          <p className="px-4 py-6 text-center text-label-lg text-muted-foreground">
            No results for &quot;{query}&quot;
          </p>
        ) : (
          <div className="px-3 pb-3 space-y-3">
            {matchedLayers.length > 0 && (
              <div>
                <p className="text-label-sm font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Layers ({matchedLayers.length})</p>
                <div className="space-y-0.5">
                  {matchedLayers.map(({ ds, layer }) => (
                    <button
                      key={`${ds.id}::${layer.name}`}
                      onClick={() => {
                        selectLayer(ds.id, layer.name)
                        setContextSelection({ type: "layer", datasetId: ds.id, layerName: layer.name })
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent transition-colors text-left"
                    >
                      <GeomIcon type={layer.geometry_type} />
                      <span className="truncate flex-1">{layer.name}</span>
                      <span className="text-label text-muted-foreground/60 shrink-0">{ds.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {matchedRules.length > 0 && (
              <div>
                <p className="text-label-sm font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Rules ({matchedRules.length})</p>
                <div className="space-y-0.5">
                  {matchedRules.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setContextSelection({ type: "rule", ruleId: r.id })
                        openRuleEditor(r.id)
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent transition-colors text-left"
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${r.enabled ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                      <span className="truncate flex-1">{r.name}</span>
                      <span className="text-label text-muted-foreground/60 shrink-0">{r.capability}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {matchedTriggers.length > 0 && (
              <div>
                <p className="text-label-sm font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Triggers ({matchedTriggers.length})</p>
                <div className="space-y-0.5">
                  {matchedTriggers.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setContextSelection({ type: "trigger", triggerId: t.id })
                        openTriggerBuilder(t.id)
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-accent transition-colors text-left"
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${t.enabled ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                      <span className="truncate flex-1">{t.name}</span>
                      <span className="text-label text-muted-foreground/60 shrink-0">{t.trigger_type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </>
  )
}

// ---------- Node Palette (context-aware) ----------

export function NodePaletteSection() {
  return (
    <>
      <SectionHeader title="Node Palette" />
      <div className="flex-1 overflow-hidden">
        <NodePaletteInline />
      </div>
    </>
  )
}

function NodePaletteInline() {
  // Re-use the existing NodePalette but fill the full LeftPanel width
  return (
    <div className="h-full overflow-y-auto">
      <NodePalette className="w-full bg-background flex flex-col" />
    </div>
  )
}
