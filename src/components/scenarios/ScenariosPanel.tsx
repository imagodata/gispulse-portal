/**
 * ScenariosPanel — Sprint R-4, issue #134
 *
 * Bottom panel in the Workflows workspace with four tabs:
 *   - Scenarios: list + create/duplicate/delete, switch with dirty check
 *   - Rules: compact list of project rules with status
 *   - Triggers: compact list of project triggers with status
 *   - History: last run results per scenario
 *
 * Features:
 *   - Dirty indicator (unsaved changes in current graph)
 *   - Confirmation dialog before switching scenario when graph is dirty
 *   - Create, duplicate and delete scenarios
 */

import { useState, useCallback, useEffect } from "react"
import {
  Plus,
  Copy,
  Trash2,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  BookOpen,
  History,
  ChevronRight,
  Code,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEditorStore } from "@/stores/editorStore"
import { useProjectStore } from "@/stores/projectStore"
import { useWorkflowStore } from "@/stores/workflowStore"
import { SQLPreviewPanel } from "@/components/SQLPreviewPanel"
import { createScenario as createScenarioApi } from "@/api/scenarios"
import type { Scenario } from "@/types/project"

// ---------------------------------------------------------------------------
// Backend-wired scenario hook (Sprint W3 — replaces useLocalScenarios)
// ---------------------------------------------------------------------------

function useBackendScenarios() {
  const workflows = useWorkflowStore((s) => s.workflows)
  const fetchWorkflows = useWorkflowStore((s) => s.fetchWorkflows)
  const deleteWorkflow = useWorkflowStore((s) => s.deleteWorkflow)
  const activeScenarioId = useEditorStore((s) => s.activeScenarioId)
  const setActiveScenarioId = useEditorStore((s) => s.setActiveScenarioId)
  const isGraphDirty = useEditorStore((s) => s.isGraphDirty)
  const setGraphDirty = useEditorStore((s) => s.setGraphDirty)

  // Fetch on mount
  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  // Map WorkflowSummary → Scenario shape for ScenarioRow compatibility
  const scenarios: Scenario[] = workflows.map((w) => ({
    id: w.id,
    project_id: "",
    name: w.name,
    status: "active" as const,
    node_count: w.node_count,
    edge_count: 0,
    created_at: w.created_at,
    updated_at: w.created_at,
  }))

  const createScenario = useCallback(async (name: string) => {
    try {
      const res = await createScenarioApi({ name, nodes: [], edges: [] })
      setActiveScenarioId(res.id)
      setGraphDirty(false)
      fetchWorkflows()
    } catch (err) {
      toast.error(`Create failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [setActiveScenarioId, setGraphDirty, fetchWorkflows])

  const duplicateScenario = useCallback(async (id: string) => {
    const source = workflows.find((w) => w.id === id)
    if (!source) return
    try {
      await createScenarioApi({ name: `${source.name} (copy)`, nodes: [], edges: [] })
      fetchWorkflows()
      toast.success(`Duplicated "${source.name}"`)
    } catch (err) {
      toast.error(`Duplicate failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [workflows, fetchWorkflows])

  const deleteScenario = useCallback(async (id: string) => {
    try {
      await deleteWorkflow(id)
      if (activeScenarioId === id) {
        setActiveScenarioId(null)
        setGraphDirty(false)
      }
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [deleteWorkflow, activeScenarioId, setActiveScenarioId, setGraphDirty])

  const switchScenario = useCallback((id: string) => {
    setActiveScenarioId(id)
    setGraphDirty(false)
  }, [setActiveScenarioId, setGraphDirty])

  return {
    scenarios,
    activeScenarioId,
    isGraphDirty,
    createScenario,
    duplicateScenario,
    deleteScenario,
    switchScenario,
  }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type PanelTab = "scenarios" | "rules" | "triggers" | "history" | "sql"

// ---------------------------------------------------------------------------
// ScenarioRow
// ---------------------------------------------------------------------------

function ScenarioRow({
  scenario,
  isActive,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  scenario: Scenario
  isActive: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const StatusIcon =
    scenario.last_run?.status === "success"
      ? CheckCircle
      : scenario.last_run?.status === "failed"
        ? AlertCircle
        : Clock
  const statusColor =
    scenario.last_run?.status === "success"
      ? "text-green-500"
      : scenario.last_run?.status === "failed"
        ? "text-red-500"
        : "text-muted-foreground"

  return (
    <div
      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
        isActive
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-accent border border-transparent"
      }`}
      onClick={onSelect}
    >
      <ChevronRight
        size={10}
        className={`shrink-0 transition-transform ${isActive ? "rotate-90 text-primary" : "text-muted-foreground"}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{scenario.name}</span>
          <Badge
            variant="secondary"
            className={`text-label-xs capitalize shrink-0 ${
              scenario.status === "active"
                ? "bg-green-500/10 text-green-600"
                : scenario.status === "archived"
                  ? "bg-muted text-muted-foreground"
                  : ""
            }`}
          >
            {scenario.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-label text-muted-foreground">
            {scenario.node_count} nodes · {scenario.edge_count} edges
          </span>
          {scenario.last_run && (
            <div className={`flex items-center gap-1 text-label ${statusColor}`}>
              <StatusIcon size={10} />
              <span>{(scenario.last_run.duration_ms / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDuplicate() }}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Duplicate"
        >
          <Copy size={10} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DirtyConfirmDialog
// ---------------------------------------------------------------------------

function DirtyConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="bg-background border rounded-lg shadow-xl p-4 w-72 space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm font-semibold">Unsaved changes</p>
        </div>
        <p className="text-xs text-muted-foreground">
          The current graph has unsaved changes. Switch anyway?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" className="h-7 text-xs" onClick={onConfirm}>
            Switch anyway
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ScenariosTab
// ---------------------------------------------------------------------------

function ScenariosTab() {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null)

  const {
    scenarios,
    activeScenarioId,
    isGraphDirty,
    createScenario,
    duplicateScenario,
    deleteScenario,
    switchScenario,
  } = useBackendScenarios()

  const handleCreate = async () => {
    if (newName.trim()) {
      await createScenario(newName.trim())
      setNewName("")
      setCreating(false)
    }
  }

  const handleSelect = (id: string) => {
    if (id === activeScenarioId) return
    if (isGraphDirty) {
      setPendingSwitchId(id)
    } else {
      switchScenario(id)
    }
  }

  const handleConfirmSwitch = () => {
    if (pendingSwitchId) {
      switchScenario(pendingSwitchId)
      setPendingSwitchId(null)
    }
  }

  return (
    <div className="relative flex flex-col gap-1 p-2">
      {/* Dirty confirm overlay */}
      {pendingSwitchId && (
        <DirtyConfirmDialog
          onConfirm={handleConfirmSwitch}
          onCancel={() => setPendingSwitchId(null)}
        />
      )}

      {scenarios.length === 0 && !creating && (
        <p className="text-label-lg text-muted-foreground px-2 py-1">
          No flows yet. Create one to start building a pipeline.
        </p>
      )}

      {scenarios.map((s) => (
        <ScenarioRow
          key={s.id}
          scenario={s}
          isActive={activeScenarioId === s.id}
          onSelect={() => handleSelect(s.id)}
          onDuplicate={() => duplicateScenario(s.id)}
          onDelete={() => {
            deleteScenario(s.id)
            toast.success(`Flow "${s.name}" deleted`)
          }}
        />
      ))}

      {creating ? (
        <div className="flex items-center gap-1.5 px-1 mt-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Flow name"
            className="text-xs h-7 flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate()
              if (e.key === "Escape") setCreating(false)
            }}
          />
          <Button size="sm" className="h-7 text-xs shrink-0" onClick={handleCreate}>Add</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-label-lg mt-1 w-full"
          onClick={() => setCreating(true)}
        >
          <Plus size={11} className="mr-1" />
          New flow
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RulesTab
// ---------------------------------------------------------------------------

function RulesTab() {
  const rules = useProjectStore((s) => s.rules)

  if (rules.length === 0) {
    return (
      <p className="text-label-lg text-muted-foreground p-3">
        No rules in this project. Create a rule in the Rules section.
      </p>
    )
  }

  return (
    <div className="p-2 space-y-0.5">
      {rules.map((r) => (
        <div key={r.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent group">
          <div className={`h-2 w-2 rounded-full shrink-0 ${r.enabled ? "bg-green-500" : "bg-muted-foreground/40"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{r.name}</p>
            <p className="text-label text-muted-foreground truncate">{r.capability}</p>
          </div>
          <Badge variant="secondary" className="text-label-sm shrink-0">
            {r.enabled ? "on" : "off"}
          </Badge>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TriggersTab
// ---------------------------------------------------------------------------

function TriggersTab() {
  const triggers = useProjectStore((s) => s.triggers)

  if (triggers.length === 0) {
    return (
      <p className="text-label-lg text-muted-foreground p-3">
        No triggers in this project. Create triggers via the Triggers section.
      </p>
    )
  }

  return (
    <div className="p-2 space-y-0.5">
      {triggers.map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
          <Zap size={11} className={`shrink-0 ${t.enabled ? "text-[var(--gp-node-trigger)]" : "text-muted-foreground/40"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{t.name}</p>
            <p className="text-label text-muted-foreground truncate">{t.trigger_type} · {t.event}</p>
          </div>
          <Badge variant="secondary" className="text-label-sm shrink-0">
            {t.enabled ? "on" : "off"}
          </Badge>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HistoryTab
// ---------------------------------------------------------------------------

function HistoryTab() {
  const nodeExecStates = useEditorStore((s) => s.nodeExecStates)
  const entries = Object.entries(nodeExecStates)

  if (entries.length === 0) {
    return (
      <p className="text-label-lg text-muted-foreground p-3">
        No run history. Execute a flow to see results here.
      </p>
    )
  }

  return (
    <div className="p-2 space-y-0.5">
      {entries.map(([nodeId, state]) => (
        <div key={nodeId} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
          {state.status === "success" ? (
            <CheckCircle size={11} className="text-green-500 shrink-0" />
          ) : state.status === "failed" ? (
            <AlertCircle size={11} className="text-red-500 shrink-0" />
          ) : (
            <Clock size={11} className="text-muted-foreground shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono truncate">{nodeId}</p>
            {state.error && (
              <p className="text-label text-red-500 truncate">{state.error}</p>
            )}
          </div>
          {state.duration_ms != null && (
            <span className="text-label text-muted-foreground shrink-0">{state.duration_ms}ms</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ScenariosPanel
// ---------------------------------------------------------------------------

const TABS: { id: PanelTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "scenarios", label: "Flows", icon: Play },
  { id: "rules", label: "Rules", icon: BookOpen },
  { id: "triggers", label: "Triggers", icon: Zap },
  { id: "sql", label: "SQL Preview", icon: Code },
  { id: "history", label: "History", icon: History },
]

export function ScenariosPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>("scenarios")
  const rules = useProjectStore((s) => s.rules)
  const triggers = useProjectStore((s) => s.triggers)
  const nodeExecStates = useEditorStore((s) => s.nodeExecStates)

  const badges: Partial<Record<PanelTab, number>> = {
    rules: rules.length,
    triggers: triggers.filter((t) => t.enabled).length,
    history: Object.keys(nodeExecStates).length,
  }

  return (
    <div className="border-t bg-background shrink-0" style={{ maxHeight: "220px" }}>
      {/* Tab bar */}
      <div className="flex items-center border-b px-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = badges[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1 px-3 py-1.5 text-label-lg font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={11} />
              {label}
              {count != null && count > 0 && (
                <span className="ml-0.5 rounded-full bg-muted px-1 text-label-sm font-mono">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <ScrollArea className="h-[calc(220px-33px)]">
        {activeTab === "scenarios" && <ScenariosTab />}
        {activeTab === "rules" && <RulesTab />}
        {activeTab === "triggers" && <TriggersTab />}
        {activeTab === "sql" && <SQLPreviewPanel />}
        {activeTab === "history" && <HistoryTab />}
      </ScrollArea>
    </div>
  )
}
