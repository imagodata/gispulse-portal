import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { useFocusTrap } from "@/hooks/useFocusTrap"
import { useUIStore } from "@/stores/uiStore"
import { useMapViewStore } from "@/stores/mapViewStore"
import { navigateToView } from "@/router"
import { useDatasetStore } from "@/stores/datasetStore"
import { useProjectStore } from "@/stores/projectStore"
import {
  Map, Table2, Workflow, Database, LayoutDashboard,
  Layers, SlidersHorizontal, Zap, HardDrive,
  Eye, EyeOff, PanelRight, PanelBottom,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaletteCommand {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  group: string
  action: () => void
  keywords?: string[]
}

// ---------------------------------------------------------------------------
// Fuzzy scoring — simple substring match with position bonus
// ---------------------------------------------------------------------------

function fuzzyScore(query: string, text: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const idx = t.indexOf(q)
  if (idx === -1) {
    // Try character-by-character matching
    let qi = 0
    let score = 0
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        score += 1 - i / t.length
        qi++
      }
    }
    return qi === q.length ? score / q.length : 0
  }
  // Substring match — bonus for starting match
  return 1 + (idx === 0 ? 0.5 : 0)
}

// ---------------------------------------------------------------------------
// Recent commands persistence
// ---------------------------------------------------------------------------

const RECENT_KEY = "gispulse:palette:recent"
const MAX_RECENT = 5

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
  } catch {
    return []
  }
}

function saveRecent(ids: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)))
}

function pushRecent(id: string) {
  const prev = loadRecent().filter((r) => r !== id)
  saveRecent([id, ...prev])
}

// ---------------------------------------------------------------------------
// Command palette component
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

const WORKSPACE_COMMANDS: PaletteCommand[] = [
  {
    id: "workspace:explorer",
    label: "Explorer",
    description: "Go to Explorer workspace",
    icon: <LayoutDashboard size={14} />,
    group: "Workspaces",
    action: () => navigateToView("explorer"),
    keywords: ["dashboard", "overview"],
  },
  {
    id: "workspace:map",
    label: "Map",
    description: "Go to Map workspace",
    icon: <Map size={14} />,
    group: "Workspaces",
    action: () => navigateToView("map"),
    keywords: ["carte", "geo", "maplibre"],
  },
  {
    id: "workspace:schema",
    label: "Schema",
    description: "Go to Schema workspace",
    icon: <Table2 size={14} />,
    group: "Workspaces",
    action: () => navigateToView("schema"),
    keywords: ["table", "columns", "fields"],
  },
  {
    id: "workspace:workflows",
    label: "Workflows",
    description: "Go to Workflows workspace",
    icon: <Workflow size={14} />,
    group: "Workspaces",
    action: () => navigateToView("workflows"),
    keywords: ["nodes", "pipeline", "flow", "editor"],
  },
  {
    id: "workspace:catalog",
    label: "Catalog",
    description: "Go to Catalog workspace",
    icon: <Database size={14} />,
    group: "Workspaces",
    action: () => navigateToView("catalog"),
    keywords: ["wms", "wfs", "basemap", "projection"],
  },
]

const PANEL_COMMANDS: PaletteCommand[] = [
  {
    id: "panel:toggle-inspector",
    label: "Toggle Inspector",
    description: "Show/hide the right inspector panel",
    icon: <PanelRight size={14} />,
    group: "Panels",
    action: () => useUIStore.getState().toggleInspector(),
    keywords: ["right", "inspector", "ctrl+i"],
  },
  {
    id: "panel:toggle-sidebar",
    label: "Toggle Sidebar",
    description: "Show/hide the left sidebar",
    icon: <Layers size={14} />,
    group: "Panels",
    action: () => useUIStore.getState().toggleLeftPanel(),
    keywords: ["left", "panel", "ctrl+b"],
  },
  {
    id: "panel:toggle-bottom",
    label: "Toggle Bottom Panel",
    description: "Show/hide the bottom panel (table, logs, SQL…)",
    icon: <PanelBottom size={14} />,
    group: "Panels",
    action: () => useUIStore.getState().toggleBottomPanel(),
    keywords: ["table", "logs", "sql", "bottom"],
  },
  {
    id: "panel:show-all-layers",
    label: "Show All Layers",
    description: "Make all map layers visible",
    icon: <Eye size={14} />,
    group: "Layers",
    action: () => useMapViewStore.getState().showAllLayers(),
  },
  {
    id: "panel:hide-all-layers",
    label: "Hide All Layers",
    description: "Hide all map layers",
    icon: <EyeOff size={14} />,
    group: "Layers",
    action: () => useMapViewStore.getState().hideAllLayers(),
  },
  {
    id: "section:layers",
    label: "Layers Panel",
    description: "Open Layers section in sidebar",
    icon: <Layers size={14} />,
    group: "Panels",
    action: () => useUIStore.getState().setActiveSection("layers"),
  },
  {
    id: "section:datasets",
    label: "Datasets Panel",
    description: "Open Datasets section in sidebar",
    icon: <HardDrive size={14} />,
    group: "Panels",
    action: () => useUIStore.getState().setActiveSection("datasets"),
  },
  {
    id: "section:rules",
    label: "Rules Panel",
    description: "Open Rules section in sidebar",
    icon: <SlidersHorizontal size={14} />,
    group: "Panels",
    action: () => useUIStore.getState().setActiveSection("rules"),
  },
  {
    id: "section:triggers",
    label: "Triggers Panel",
    description: "Open Triggers section in sidebar",
    icon: <Zap size={14} />,
    group: "Panels",
    action: () => useUIStore.getState().setActiveSection("triggers"),
  },
]

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentIds, setRecentIds] = useState<string[]>(loadRecent)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)

  const datasets = useDatasetStore((s) => s.datasets)
  const rules = useProjectStore((s) => s.rules)
  const triggers = useProjectStore((s) => s.triggers)

  // Build dynamic commands from store data
  const dynamicCommands = useMemo<PaletteCommand[]>(() => {
    const cmds: PaletteCommand[] = []

    for (const ds of datasets) {
      cmds.push({
        id: `dataset:${ds.id}`,
        label: ds.name,
        description: `Dataset — ${ds.layers?.length ?? 0} layer(s)`,
        icon: <HardDrive size={14} />,
        group: "Datasets",
        action: () => {
          useDatasetStore.getState().selectDataset(ds.id)
          navigateToView("map")
        },
        keywords: ["layer", "geo", ds.id],
      })
    }

    for (const rule of rules) {
      cmds.push({
        id: `rule:${rule.id}`,
        label: rule.name,
        description: `Rule${rule.enabled ? "" : " (disabled)"}`,
        icon: <SlidersHorizontal size={14} />,
        group: "Rules",
        action: () => {
          useUIStore.getState().setContextSelection({ type: "rule", ruleId: rule.id })
          useUIStore.getState().setActiveSection("rules")
        },
        keywords: ["rule", "filter"],
      })
    }

    for (const trigger of triggers) {
      cmds.push({
        id: `trigger:${trigger.id}`,
        label: trigger.name,
        description: `Trigger${trigger.enabled ? "" : " (disabled)"}`,
        icon: <Zap size={14} />,
        group: "Triggers",
        action: () => {
          useUIStore.getState().setContextSelection({ type: "trigger", triggerId: trigger.id })
          useUIStore.getState().setActiveSection("triggers")
        },
        keywords: ["trigger", "event"],
      })
    }

    return cmds
  }, [datasets, rules, triggers])

  const allCommands = useMemo(
    () => [...WORKSPACE_COMMANDS, ...PANEL_COMMANDS, ...dynamicCommands],
    [dynamicCommands],
  )

  // Filtered + scored results
  const results = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands first, then static commands
      const recentCmds = recentIds
        .map((id) => allCommands.find((c) => c.id === id))
        .filter(Boolean) as PaletteCommand[]

      const nonRecent = allCommands.filter((c) => !recentIds.includes(c.id)).slice(0, 10)

      if (recentCmds.length > 0) {
        return [
          ...recentCmds.map((c) => ({ ...c, group: "Recent" })),
          ...nonRecent,
        ]
      }
      return nonRecent
    }

    return allCommands
      .map((cmd) => {
        const labelScore = fuzzyScore(query, cmd.label)
        const descScore = fuzzyScore(query, cmd.description ?? "") * 0.5
        const kwScore = Math.max(
          ...(cmd.keywords ?? []).map((kw) => fuzzyScore(query, kw) * 0.7),
          0,
        )
        return { cmd, score: Math.max(labelScore, descScore, kwScore) }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd)
      .slice(0, 12)
  }, [query, allCommands, recentIds])

  // Reset index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [results.length, query])

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQuery("")
      setActiveIndex(0)
      setRecentIds(loadRecent())
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const active = listRef.current.children[activeIndex] as HTMLElement | undefined
    active?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const executeCommand = useCallback(
    (cmd: PaletteCommand) => {
      pushRecent(cmd.id)
      setRecentIds(loadRecent())
      cmd.action()
      onClose()
    },
    [onClose],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % Math.max(1, results.length))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + Math.max(1, results.length)) % Math.max(1, results.length))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const cmd = results[activeIndex]
        if (cmd) executeCommand(cmd)
      } else if (e.key === "Escape") {
        onClose()
      }
    },
    [results, activeIndex, executeCommand, onClose],
  )

  if (!open) return null

  // Group headers for display
  const groupedResults: { group: string; items: PaletteCommand[] }[] = []
  for (const cmd of results) {
    const last = groupedResults[groupedResults.length - 1]
    if (!last || last.group !== cmd.group) {
      groupedResults.push({ group: cmd.group, items: [cmd] })
    } else {
      last.items.push(cmd)
    }
  }

  // Flat index mapping for keyboard navigation
  let flatIdx = 0

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-[560px] max-h-[60vh] mx-4 flex flex-col rounded-xl border bg-popover shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <svg
            className="shrink-0 text-muted-foreground"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="palette-results"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, datasets, rules…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="text-label text-muted-foreground border border-border/60 rounded px-1 py-0.5 font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          id="palette-results"
          ref={listRef}
          role="listbox"
          className="flex-1 overflow-y-auto py-2"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No results for "{query}"
            </div>
          ) : (
            groupedResults.map(({ group, items }) => (
              <div key={group}>
                <div className="px-4 py-1.5">
                  <span className="text-label font-semibold uppercase tracking-widest text-muted-foreground">
                    {group}
                  </span>
                </div>
                {items.map((cmd) => {
                  const idx = flatIdx++
                  const isActive = idx === activeIndex
                  return (
                    <div
                      key={cmd.id}
                      role="option"
                      aria-selected={isActive}
                      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      }`}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <span className="shrink-0 text-muted-foreground">{cmd.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t text-label text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="border border-border/60 rounded px-1 font-mono">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border border-border/60 rounded px-1 font-mono">↵</kbd> select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="border border-border/60 rounded px-1 font-mono">Esc</kbd> close
          </span>
          {query && (
            <span className="ml-auto">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
