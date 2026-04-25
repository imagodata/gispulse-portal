import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { GISPulseLogo } from "@/components/GISPulseLogo"
import { useProjectStore } from "@/stores/projectStore"
import type { Project } from "@/types/project"

// Sort options for project list (#212)
type SortKey = "name" | "updated_at" | "created_at"

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name (A-Z)",
  updated_at: "Last modified",
  created_at: "Date created",
}

const SORT_STORAGE_KEY = "gispulse:projects:sort"

function loadSort(): SortKey {
  return (localStorage.getItem(SORT_STORAGE_KEY) as SortKey) ?? "updated_at"
}

function sortProjects(projects: Project[], key: SortKey): Project[] {
  return [...projects].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name)
    const aVal = (a as unknown as Record<string, unknown>)[key] as string | undefined
    const bVal = (b as unknown as Record<string, unknown>)[key] as string | undefined
    if (!aVal && !bVal) return 0
    if (!aVal) return 1
    if (!bVal) return -1
    // Most recent first for date fields
    return bVal.localeCompare(aVal)
  })
}

export function ProjectsPage() {
  const { projects: rawProjects, createProject, deleteProject, setActiveProject, loading } =
    useProjectStore()
  const projects = Array.isArray(rawProjects) ? rawProjects : []

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState("")

  const modalRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  // Focus management and Escape key
  useEffect(() => {
    if (showCreate) {
      triggerRef.current = document.activeElement as HTMLElement
      // autoFocus on first input handles initial focus
    } else if (triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [showCreate])

  useEffect(() => {
    if (!showCreate) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDialog()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showCreate])

  const handleCreate = async () => {
    if (!name.trim()) return
    setError("")
    try {
      const p = await createProject(name.trim(), description.trim())
      setName("")
      setDescription("")
      setShowCreate(false)
      setActiveProject(p.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
    }
  }

  const closeDialog = () => {
    setShowCreate(false)
    setName("")
    setDescription("")
    setError("")
  }

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>(loadSort)

  const handleSortChange = (key: SortKey) => {
    setSortKey(key)
    localStorage.setItem(SORT_STORAGE_KEY, key)
  }

  const sortedProjects = useMemo(
    () => sortProjects(projects, sortKey),
    [projects, sortKey],
  )

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeleteConfirmId(id)
  }

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmId) return
    try {
      await deleteProject(deleteConfirmId)
    } catch (err) {
      console.error("Delete project failed:", err)
      toast.error("Failed to delete project")
    }
    setDeleteConfirmId(null)
  }, [deleteConfirmId, deleteProject])

  return (
    <div className="flex h-screen w-screen flex-col bg-muted/30">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <GISPulseLogo animated size={32} className="text-foreground" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">GISPulse</h1>
            <p className="text-xs text-muted-foreground">Geospatial processing engine</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort select (#212) */}
          {projects.length > 1 && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="projects-sort" className="text-xs text-muted-foreground whitespace-nowrap">
                Sort by
              </label>
              <select
                id="projects-sort"
                value={sortKey}
                onChange={(e) => handleSortChange(e.target.value as SortKey)}
                className="h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Sort projects by"
              >
                {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            New project
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 text-5xl text-muted-foreground/20">{"\u25C7"}</div>
            <p className="mb-1 text-sm text-muted-foreground">No projects yet</p>
            <p className="mb-4 text-xs text-muted-foreground/70">
              Create a project to start importing spatial data
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedProjects.map((p: Project) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => setActiveProject(p.id)}
                onDelete={(e) => handleDeleteClick(e, p.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create project modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeDialog}
            aria-hidden="true"
          />
          {/* Dialog */}
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-xl"
          >
            <h2 id="new-project-title" className="mb-4 text-base font-semibold">New project</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="project-name" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Name
                </label>
                <input
                  id="project-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="My project"
                  autoFocus
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="project-description" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Description{" "}
                  <span className="font-normal text-muted-foreground/50">(optional)</span>
                </label>
                <input
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Short description..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeDialog}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim() || loading}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirmId(null)} aria-hidden="true" />
          <div role="alertdialog" aria-modal="true" className="relative z-10 w-full max-w-sm rounded-lg border bg-background p-5 shadow-xl">
            <h2 className="text-sm font-semibold mb-2">Delete project?</h2>
            <p className="text-xs text-muted-foreground mb-4">
              This action cannot be undone. The project and all its configuration will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project
  onOpen: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const datasetCount = project.datasets.length
  const ruleCount = project.rules.length
  const triggerCount = project.triggers.length
  const created = new Date(project.created_at).toLocaleDateString()

  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer rounded-lg border bg-background p-4 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="ml-2 rounded p-1 text-xs text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          title="Delete project"
        >
          {"\u2715"}
        </button>
      </div>

      <div className="flex items-center gap-3 text-label text-muted-foreground">
        <Stat label="Datasets" value={datasetCount} />
        <Stat label="Rules" value={ruleCount} />
        <Stat label="Triggers" value={triggerCount} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-label text-muted-foreground/60">{created}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-label font-medium text-muted-foreground">
          {project.engine_backend}
        </span>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="font-mono font-medium text-foreground">{value}</span>{" "}
      {label}
    </span>
  )
}
