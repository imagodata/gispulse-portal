/**
 * WorkflowList — Grid view of all saved workflows with search, CRUD, export/import.
 *
 * Sprint W1: first screen shown when entering Workflows workspace.
 * Replaces the immediate empty canvas with a proper workflow manager.
 */

import { useEffect, useRef, useState, useCallback } from "react"
import {
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  MoreVertical,
  GitBranch,
  Clock,
  Loader2,
  AlertCircle,
  FileJson,
  Copy,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  useWorkflowStore,
  type WorkflowSummary,
} from "@/stores/workflowStore"
import { useEditorStore } from "@/stores/editorStore"
import { createScenario } from "@/api/scenarios"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

const DOMAIN_COLORS: Record<string, string> = {
  ftth: "bg-blue-500/10 text-blue-600",
  urbanisme: "bg-amber-500/10 text-amber-600",
  environnement: "bg-green-500/10 text-green-600",
  transport: "bg-orange-500/10 text-orange-600",
  hydrologie: "bg-cyan-500/10 text-cyan-600",
  generic: "bg-muted text-muted-foreground",
  custom: "bg-purple-500/10 text-purple-600",
}

// ---------------------------------------------------------------------------
// WorkflowCard
// ---------------------------------------------------------------------------

function WorkflowCard({
  workflow,
  onOpen,
  onDuplicate,
  onExport,
  onDelete,
}: {
  workflow: WorkflowSummary
  onOpen: () => void
  onDuplicate: () => void
  onExport: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  const domain = workflow.domain || "generic"
  const domainColor = DOMAIN_COLORS[domain] || DOMAIN_COLORS.generic

  return (
    <div
      className="group relative rounded-lg border border-border bg-background hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
      onClick={onOpen}
    >
      {/* Card header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold text-foreground truncate">
              {workflow.name}
            </h3>
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(!menuOpen)
              }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-md border border-border bg-background shadow-lg py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicate()
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  <Copy className="h-3 w-3" /> Duplicate
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onExport()
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  <Download className="h-3 w-3" /> Export JSON
                </button>
                <hr className="my-1 border-border" />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{workflow.node_count} nodes</span>
          <span>v{workflow.version}</span>
        </div>
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/30 rounded-b-lg">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{timeAgo(workflow.created_at)}</span>
        </div>
        {domain !== "generic" && (
          <Badge variant="secondary" className={`text-label-xs ${domainColor}`}>
            {domain}
          </Badge>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WorkflowList
// ---------------------------------------------------------------------------

export function WorkflowList() {
  const {
    workflows,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    fetchWorkflows,
    deleteWorkflow,
    openWorkflow,
    setView,
    setActiveWorkflow,
    parseImport,
  } = useWorkflowStore()

  const setPendingGraph = useEditorStore((s) => s.setPendingGraph)
  const setActiveScenarioId = useEditorStore((s) => s.setActiveScenarioId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch on mount
  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  // Filter by search
  const filtered = searchQuery
    ? workflows.filter(
        (w) =>
          w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (w.domain && w.domain.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : workflows

  // Open workflow in editor
  const handleOpen = useCallback(
    async (id: string) => {
      const result = await openWorkflow(id)
      if (result) {
        setPendingGraph(result)
        setActiveScenarioId(id)
      } else {
        // No graph stored yet — open empty editor for this workflow
        setActiveWorkflow(id, workflows.find((w) => w.id === id)?.name ?? null)
        setView("editor")
        setActiveScenarioId(id)
      }
    },
    [openWorkflow, setPendingGraph, setActiveScenarioId, setActiveWorkflow, setView, workflows],
  )

  // Create new workflow
  const handleNew = useCallback(async () => {
    try {
      const res = await createScenario({
        name: "Untitled Workflow",
        nodes: [],
        edges: [],
      })
      setActiveWorkflow(res.id, res.name)
      setActiveScenarioId(res.id)
      setView("editor")
    } catch (err) {
      toast.error(`Failed to create workflow: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [setActiveWorkflow, setActiveScenarioId, setView])

  // Delete workflow
  const handleDelete = useCallback(
    async (w: WorkflowSummary) => {
      if (!confirm(`Delete "${w.name}"? This cannot be undone.`)) return
      try {
        await deleteWorkflow(w.id)
        toast.success(`Deleted "${w.name}"`)
      } catch (err) {
        toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [deleteWorkflow],
  )

  // Duplicate
  const handleDuplicate = useCallback(
    async (w: WorkflowSummary) => {
      try {
        const res = await createScenario({
          name: `${w.name} (copy)`,
          nodes: [],
          edges: [],
        })
        toast.success(`Duplicated as "${res.name}"`)
        fetchWorkflows()
      } catch (err) {
        toast.error(`Duplicate failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [fetchWorkflows],
  )

  // Export workflow as JSON
  const handleExport = useCallback(
    async (w: WorkflowSummary) => {
      try {
        const result = await openWorkflow(w.id)
        if (!result) {
          toast.error("No graph data to export")
          return
        }
        const { exportWorkflow } = useWorkflowStore.getState()
        const exported = exportWorkflow(
          result.nodes,
          result.edges,
          w.name,
          "",
          w.domain,
        )
        const blob = new Blob([JSON.stringify(exported, null, 2)], {
          type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${w.name.replace(/\s+/g, "_").toLowerCase()}.workflow.json`
        a.click()
        URL.revokeObjectURL(url)
        // Reset view back to list since openWorkflow switches to editor
        setView("list")
        toast.success(`Exported "${w.name}"`)
      } catch (err) {
        toast.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
    [openWorkflow, setView],
  )

  // Import workflow from JSON file
  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const parsed = parseImport(text)
        if (!parsed) {
          toast.error("Invalid workflow file format")
          return
        }
        await createScenario(parsed.graph)
        toast.success(`Imported "${parsed.name}" as workflow`)
        fetchWorkflows()
      } catch (err) {
        toast.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    [parseImport, fetchWorkflows],
  )

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Workflows</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filtered.length} workflow{filtered.length !== 1 ? "s" : ""}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => fetchWorkflows()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-1.5" />
            Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.workflow.json"
            className="hidden"
            onChange={handleImport}
          />
          <Button size="sm" className="h-8 text-xs" onClick={handleNew}>
            <Plus className="h-3 w-3 mr-1.5" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && workflows.length === 0 && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading workflows...</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-xl border-2 border-dashed border-border p-8">
              <FileJson className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery
                  ? "No workflows match your search"
                  : "No workflows yet"}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
                {searchQuery
                  ? "Try a different search term"
                  : "Create your first workflow or import one from JSON"}
              </p>
              {!searchQuery && (
                <div className="flex items-center gap-2 justify-center">
                  <Button size="sm" className="text-xs" onClick={handleNew}>
                    <Plus className="h-3 w-3 mr-1" /> New Workflow
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1" /> Import JSON
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((w) => (
              <WorkflowCard
                key={w.id}
                workflow={w}
                onOpen={() => handleOpen(w.id)}
                onDuplicate={() => handleDuplicate(w)}
                onExport={() => handleExport(w)}
                onDelete={() => handleDelete(w)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
