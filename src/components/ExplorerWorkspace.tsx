/**
 * ExplorerWorkspace — Project dashboard / recap
 *
 * Full-page workspace showing:
 * - Project header with stats (datasets, layers, rules, triggers, workflows)
 * - Datasets grid with DatasetCard components
 * - Rules & Triggers summary cards
 * - Workflows (scenarios) summary
 * - Activity timeline sidebar
 * - Quick-import drop zone
 */

import { useState, useCallback, useEffect } from "react"
import {
  LayoutGrid,
  List,
  Upload,
  HardDrive,
  SlidersHorizontal,
  Zap,
  Layers,
  BarChart2,
  Search,
  Workflow,
  ChevronRight,
  GitBranch,
  ArrowRight,
  Play,
  Share2,
  Activity,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { DatasetContextMenu } from "@/components/DatasetContextMenu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DatasetCard } from "@/components/DatasetCard"
import { ActivityTimeline } from "@/components/ActivityTimeline"
import { DatasetSchemaGraph } from "@/components/DatasetSchemaGraph"
import { DragDropOverlay } from "@/components/DragDropOverlay"
import { DuplicateImportDialog } from "@/components/DuplicateImportDialog"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { RenameDialog } from "@/components/RenameDialog"
import { useActiveProject } from "@/stores/projectStore"
import { useProjectStore } from "@/stores/projectStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { useUIStore } from "@/stores/uiStore"
import { useMapViewStore, layerKey } from "@/stores/mapViewStore"
import { useDatasetImport } from "@/hooks/useDatasetImport"
import {
  exportGpkg,
  deleteDatasetApi,
  renameDatasetApi,
  getProjectStats,
  type ProjectStats,
} from "@/api/client"
import type { DatasetMeta } from "@/types/dataset"
import type { Rule, Trigger } from "@/types/project"
import { navigateToView } from "@/router"

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  accent,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  accent?: string
  onClick?: () => void
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-background p-3 ${onClick ? "cursor-pointer hover:border-primary/30 transition-colors" : ""}`}
      onClick={onClick}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${accent ?? "bg-muted"}`}>
        {icon}
      </div>
      <div>
        <div className="text-lg font-semibold leading-tight tabular-nums">{value}</div>
        <div className="text-label text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({
  icon,
  title,
  count,
  action,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
        {count !== undefined && (
          <Badge variant="secondary" className="text-label px-1.5 py-0">
            {count}
          </Badge>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1 text-label-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          {action.label}
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RuleCard (compact)
// ---------------------------------------------------------------------------

function RuleCard({ rule }: { rule: Rule }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border px-3 py-2 bg-background hover:border-gp-node-transform/30 transition-colors">
      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${rule.enabled ? "bg-gp-success" : "bg-muted-foreground/30"}`} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{rule.name}</div>
        <div className="text-label text-muted-foreground truncate">
          {rule.scope} / {rule.capability}
        </div>
      </div>
      <Badge variant="outline" className="text-label-sm shrink-0">
        {rule.enabled ? "active" : "off"}
      </Badge>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TriggerCard (compact)
// ---------------------------------------------------------------------------

function TriggerCard({ trigger }: { trigger: Trigger }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border px-3 py-2 bg-background hover:border-gp-node-trigger/30 transition-colors">
      <Zap size={11} className={`shrink-0 ${trigger.enabled ? "text-gp-node-trigger" : "text-muted-foreground/30"}`} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{trigger.name}</div>
        <div className="text-label text-muted-foreground truncate">
          {trigger.event} {trigger.trigger_type && `(${trigger.trigger_type})`}
        </div>
      </div>
      {trigger.category && (
        <Badge variant="outline" className="text-label-sm shrink-0">
          {trigger.category}
        </Badge>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// WorkflowCard (compact placeholder for scenarios)
// ---------------------------------------------------------------------------

function WorkflowPlaceholder({ scenarioCount }: { scenarioCount: number }) {
  if (scenarioCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed">
        <Workflow size={24} className="mb-2 text-muted-foreground/20" />
        <p className="text-xs text-muted-foreground">No workflows yet</p>
        <button
          onClick={() => navigateToView("workflows")}
          className="mt-2 flex items-center gap-1 text-label-lg text-primary hover:underline"
        >
          Create a workflow <ArrowRight size={11} />
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div
        className="flex items-center gap-3 rounded-lg border px-3 py-3 bg-background cursor-pointer hover:border-gp-node-control/30 transition-colors"
        onClick={() => navigateToView("workflows")}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gp-node-control/10">
          <GitBranch size={14} className="text-gp-node-control" />
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums">{scenarioCount}</div>
          <div className="text-label text-muted-foreground">Saved workflows</div>
        </div>
        <ChevronRight size={14} className="ml-auto text-muted-foreground" />
      </div>
      <button
        onClick={() => navigateToView("workflows")}
        className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-3 hover:border-primary/30 transition-colors text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
          <Play size={14} className="text-muted-foreground" />
        </div>
        <div>
          <div className="text-xs font-medium">Open editor</div>
          <div className="text-label text-muted-foreground">Build & run pipelines</div>
        </div>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ExplorerWorkspace
// ---------------------------------------------------------------------------

type ViewMode = "grid" | "list"

export function ExplorerWorkspace() {
  const project = useActiveProject()
  const rules = useProjectStore((s) => s.rules)
  const triggers = useProjectStore((s) => s.triggers)
  const datasets = useDatasetStore((s) => s.datasets)
  const { removeDataset, renameDataset: renameInStore } = useDatasetStore()

  const {
    isDragOver,
    pendingDuplicate,
    clearPendingDuplicate,
    confirmDuplicate,
    handleFileInput,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useDatasetImport()

  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [search, setSearch] = useState("")
  const [activityOpen, setActivityOpen] = useState(false)
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<DatasetMeta | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; dataset: DatasetMeta } | null>(null)

  const handleCardContextMenu = useCallback((e: React.MouseEvent, ds: DatasetMeta) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, dataset: ds })
  }, [])

  // Load stats
  useEffect(() => {
    if (!project) return
    setStatsLoading(true)
    getProjectStats(project.id)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false))
  }, [project, datasets.length])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteDatasetApi(id)
      removeDataset(id)
      const validKeys = new Set<string>()
      for (const ds of useDatasetStore.getState().datasets) {
        for (const l of ds.layers ?? []) validKeys.add(layerKey(ds.id, l.name))
      }
      useMapViewStore.getState().cleanupOrphanedLayers(validKeys)
      toast.success("Dataset deleted")
    } catch (err) {
      toast.error("Delete failed: " + (err instanceof Error ? err.message : String(err)))
    }
    setDeleteConfirmId(null)
  }, [removeDataset])

  const handleRename = useCallback(
    async (ds: DatasetMeta, newName: string) => {
      if (!newName || newName === ds.name) {
        setRenameTarget(null)
        return
      }
      try {
        await renameDatasetApi(ds.id, newName)
        renameInStore(ds.id, newName)
        toast.success("Dataset renamed")
      } catch (err) {
        toast.error("Rename failed: " + (err instanceof Error ? err.message : String(err)))
      }
      setRenameTarget(null)
    },
    [renameInStore],
  )

  const handleOpenMap = useCallback(
    (ds: DatasetMeta) => {
      if (ds.layers?.[0]) {
        useDatasetStore.getState().selectLayer(ds.id, ds.layers[0].name)
      }
      navigateToView("map")
    },
    [],
  )

  const handleExport = useCallback(async (ds: DatasetMeta) => {
    const stack = useMapViewStore.getState().views.find((v) => v.id === useMapViewStore.getState().activeViewId)?.state.layerStack ?? []
    try {
      await exportGpkg(
        (ds.layers ?? []).map((l) => {
          const style = stack.find((s) => s.key === layerKey(ds.id, l.name))
          return { datasetId: ds.id, layerName: l.name, color: style?.color, opacity: style?.opacity }
        }),
        `${ds.name}.gpkg`,
      )
      toast.success("Export started")
    } catch (err) {
      toast.error("Export failed: " + (err instanceof Error ? err.message : String(err)))
    }
  }, [])

  // Filter datasets
  const filteredDatasets = search.trim()
    ? datasets.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.format.toLowerCase().includes(search.toLowerCase()),
      )
    : datasets

  // Derived counts
  const scenarioCount = stats?.scenario_count ?? 0

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No active project
      </div>
    )
  }

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && <DragDropOverlay />}

      {/* Main layout: scrollable content + right activity panel */}
      <div className="flex h-full min-h-0">
        {/* Left: main content */}
        <ScrollArea className="flex-1 min-w-0">
          <div className="p-4 space-y-6">
            {/* ---- Project header + stats ---- */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-base font-semibold leading-tight">{project.name}</h1>
                  {project.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{project.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Activity toggle — visible below xl */}
                  <button
                    onClick={() => setActivityOpen((v) => !v)}
                    className={`xl:hidden flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                      activityOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                    title="Toggle activity"
                    aria-label="Toggle activity panel"
                  >
                    <Activity size={14} />
                  </button>
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Upload size={13} />
                    Import
                    <input
                      type="file"
                      className="sr-only"
                      accept=".gpkg,.geojson,.json,.shp,.fgb,.csv,.parquet,.tif,.tiff,.zip"
                      onChange={handleFileInput}
                    />
                  </label>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard
                  icon={<HardDrive size={14} className="text-gp-node-source" />}
                  label="Datasets"
                  value={statsLoading ? "—" : (stats?.dataset_count ?? datasets.length)}
                  accent="bg-gp-node-source/10"
                />
                <StatCard
                  icon={<Layers size={14} className="text-gp-geom-polygon" />}
                  label="Layers"
                  value={statsLoading ? "—" : (stats?.layer_count ?? 0)}
                  accent="bg-gp-geom-polygon/10"
                />
                <StatCard
                  icon={<SlidersHorizontal size={14} className="text-gp-node-transform" />}
                  label="Rules"
                  value={statsLoading ? "—" : (stats?.rule_count ?? rules.length)}
                  accent="bg-gp-node-transform/10"
                  onClick={() => {
                    useUIStore.getState().setActiveSection("rules")
                    navigateToView("map")
                  }}
                />
                <StatCard
                  icon={<Zap size={14} className="text-gp-node-trigger" />}
                  label="Triggers"
                  value={statsLoading ? "—" : (stats?.trigger_count ?? triggers.length)}
                  accent="bg-gp-node-trigger/10"
                  onClick={() => {
                    useUIStore.getState().setActiveSection("triggers")
                    navigateToView("map")
                  }}
                />
                <StatCard
                  icon={<Workflow size={14} className="text-gp-node-control" />}
                  label="Workflows"
                  value={statsLoading ? "—" : scenarioCount}
                  accent="bg-gp-node-control/10"
                  onClick={() => navigateToView("workflows")}
                />
                {stats && stats.total_feature_count > 0 && (
                  <StatCard
                    icon={<BarChart2 size={14} className="text-gp-warning" />}
                    label="Features"
                    value={stats.total_feature_count.toLocaleString()}
                    accent="bg-gp-warning/10"
                  />
                )}
              </div>
            </div>

            {/* ---- Datasets section ---- */}
            <div>
              <SectionHeader
                icon={<HardDrive size={14} className="text-gp-node-source" />}
                title="Datasets"
                count={datasets.length}
                action={{ label: "View on map", onClick: () => navigateToView("map") }}
              />

              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1 max-w-xs">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter datasets..."
                    className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                      viewMode === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent"
                    }`}
                    title="Grid view"
                    aria-label="Grid view"
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                      viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent"
                    }`}
                    title="List view"
                    aria-label="List view"
                  >
                    <List size={13} />
                  </button>
                </div>
              </div>

              {filteredDatasets.length === 0 ? (
                <EmptyState
                  hasSearch={Boolean(search)}
                  onImport={() => document.querySelector<HTMLInputElement>("input[type=file]")?.click()}
                />
              ) : (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                      : "flex flex-col gap-2"
                  }
                >
                  {filteredDatasets.map((ds) => (
                    <DatasetCard
                      key={ds.id}
                      dataset={ds}
                      onOpenMap={handleOpenMap}
                      onDelete={(d) => setDeleteConfirmId(d.id)}
                      onRename={(d) => setRenameTarget(d)}
                      onExport={handleExport}
                      onContextMenu={handleCardContextMenu}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ---- Rules & Triggers section ---- */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Rules */}
              <div>
                <SectionHeader
                  icon={<SlidersHorizontal size={14} className="text-gp-node-transform" />}
                  title="Rules"
                  count={rules.length}
                  action={{
                    label: "Manage",
                    onClick: () => {
                      useUIStore.getState().setActiveSection("rules")
                      navigateToView("map")
                    },
                  }}
                />
                {rules.length === 0 ? (
                  <div className="flex items-center justify-center py-6 rounded-lg border border-dashed text-xs text-muted-foreground">
                    No rules configured
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {rules.slice(0, 5).map((r) => (
                      <RuleCard key={r.id} rule={r} />
                    ))}
                    {rules.length > 5 && (
                      <p className="text-label text-muted-foreground pl-1">
                        +{rules.length - 5} more rules
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Triggers */}
              <div>
                <SectionHeader
                  icon={<Zap size={14} className="text-gp-node-trigger" />}
                  title="Triggers"
                  count={triggers.length}
                  action={{
                    label: "Manage",
                    onClick: () => {
                      useUIStore.getState().setActiveSection("triggers")
                      navigateToView("map")
                    },
                  }}
                />
                {triggers.length === 0 ? (
                  <div className="flex items-center justify-center py-6 rounded-lg border border-dashed text-xs text-muted-foreground">
                    No triggers configured
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {triggers.slice(0, 5).map((t) => (
                      <TriggerCard key={t.id} trigger={t} />
                    ))}
                    {triggers.length > 5 && (
                      <p className="text-label text-muted-foreground pl-1">
                        +{triggers.length - 5} more triggers
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ---- Workflows section ---- */}
            <div>
              <SectionHeader
                icon={<Workflow size={14} className="text-gp-node-control" />}
                title="Workflows"
                count={scenarioCount}
                action={
                  scenarioCount > 0
                    ? { label: "Open editor", onClick: () => navigateToView("workflows") }
                    : undefined
                }
              />
              <WorkflowPlaceholder scenarioCount={scenarioCount} />
            </div>

            {/* ---- Schema graph section (#191) ---- */}
            {datasets.length > 0 && (
              <div>
                <SectionHeader
                  icon={<Share2 size={14} className="text-gp-node-transform" />}
                  title="Schema"
                  count={datasets.length}
                  action={{ label: "View on map", onClick: () => navigateToView("map") }}
                />
                <DatasetSchemaGraph
                  datasets={datasets}
                  onSelectDataset={(ds) => {
                    if (ds.layers?.[0]) {
                      useDatasetStore.getState().selectLayer(ds.id, ds.layers[0].name)
                    }
                    navigateToView("map")
                  }}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Right: Activity timeline — always visible on xl+, toggleable below */}
        <div className={`${activityOpen ? "flex" : "hidden"} xl:flex w-(--width-inspector) shrink-0 flex-col border-l bg-background overflow-hidden`}>
          <div className="border-b px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Activity
            </h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="px-2 py-2">
              <ActivityTimeline showRefresh limit={25} />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Dataset context menu */}
      {ctxMenu && (
        <DatasetContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onOpenMap={() => handleOpenMap(ctxMenu.dataset)}
          onRename={() => setRenameTarget(ctxMenu.dataset)}
          onExport={() => handleExport(ctxMenu.dataset)}
          onDelete={() => setDeleteConfirmId(ctxMenu.dataset.id)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Delete dataset?"
        description="This will permanently remove the dataset and its data. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {/* Rename dialog */}
      {renameTarget && (
        <RenameDialog
          initialName={renameTarget.name}
          onConfirm={(name) => handleRename(renameTarget, name)}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      {/* Duplicate import dialog */}
      {pendingDuplicate && (
        <DuplicateImportDialog
          pending={pendingDuplicate}
          onCancel={clearPendingDuplicate}
          onConfirm={confirmDuplicate}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState({
  hasSearch,
  onImport,
}: {
  hasSearch: boolean
  onImport: () => void
}) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Search size={24} className="mb-3 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No datasets match your search</p>
        <p className="text-xs text-muted-foreground/60">Try a different keyword or format</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <HardDrive size={32} className="mb-4 text-muted-foreground/20" />
      <p className="mb-1 text-sm text-muted-foreground">No datasets yet</p>
      <p className="mb-4 text-xs text-muted-foreground/60">
        Import a file or drag and drop it onto this page
      </p>
      <button
        onClick={onImport}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Import dataset
      </button>
    </div>
  )
}
