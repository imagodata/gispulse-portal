/**
 * ProjectSwitcherBar — Sprint R-3, issue #130
 *
 * A compact top bar showing the active project name with a dropdown to
 * switch between projects or create a new one, without leaving the workspace.
 */

import { useRef, useState, useEffect, useCallback } from "react"
import { ChevronDown, Plus, FolderOpen, ArrowLeft, Check } from "lucide-react"
import { useProjectStore, useActiveProject } from "@/stores/projectStore"
import type { Project } from "@/types/project"

// ---------------------------------------------------------------------------
// ProjectSwitcherBar
// ---------------------------------------------------------------------------

interface ProjectSwitcherBarProps {
  /** Called when user clicks the "back to projects" button */
  onBackToProjects?: () => void
  className?: string
}

export function ProjectSwitcherBar({
  onBackToProjects,
  className = "",
}: ProjectSwitcherBarProps) {
  const project = useActiveProject()
  const { projects: rawProjects, setActiveProject, createProject, loading } = useProjectStore()
  const projects = Array.isArray(rawProjects) ? rawProjects : []

  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [createError, setCreateError] = useState("")

  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCreate(false)
        setNewName("")
        setCreateError("")
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        setShowCreate(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  const handleSwitch = useCallback(
    (id: string) => {
      setActiveProject(id)
      setOpen(false)
    },
    [setActiveProject],
  )

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return
    setCreateError("")
    try {
      const p = await createProject(newName.trim())
      setActiveProject(p.id)
      setOpen(false)
      setShowCreate(false)
      setNewName("")
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create project")
    }
  }, [newName, createProject, setActiveProject])

  const handleBack = () => {
    setOpen(false)
    onBackToProjects?.()
    // Clear active project to go back to ProjectsPage
    setActiveProject(null)
  }

  if (!project) return null

  return (
    <div className={`relative flex items-center ${className}`} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          open
            ? "bg-accent text-foreground"
            : "text-foreground hover:bg-accent"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch project"
      >
        <FolderOpen size={13} className="text-muted-foreground" />
        <span className="max-w-[160px] truncate">{project.name}</span>
        <ChevronDown
          size={12}
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border bg-background shadow-xl">
          {/* Back to projects */}
          <button
            onClick={handleBack}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors rounded-t-lg"
          >
            <ArrowLeft size={12} />
            All projects
          </button>

          <div className="border-t" />

          {/* Project list */}
          <div
            role="listbox"
            aria-label="Projects"
            className="max-h-52 overflow-y-auto"
          >
            {projects.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">No projects</div>
            ) : (
              projects.map((p: Project) => (
                <button
                  key={p.id}
                  role="option"
                  aria-selected={p.id === project.id}
                  onClick={() => handleSwitch(p.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors"
                >
                  <FolderOpen
                    size={13}
                    className={p.id === project.id ? "text-primary" : "text-muted-foreground"}
                  />
                  <span className="flex-1 truncate text-left">{p.name}</span>
                  {p.id === project.id && (
                    <Check size={12} className="shrink-0 text-primary" />
                  )}
                  <span className="ml-1 text-label text-muted-foreground/60 shrink-0">
                    {p.datasets.length}ds
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="border-t" />

          {/* Create new project */}
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors rounded-b-lg"
            >
              <Plus size={13} />
              New project
            </button>
          ) : (
            <div className="p-3 space-y-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                  if (e.key === "Escape") {
                    setShowCreate(false)
                    setNewName("")
                  }
                }}
                placeholder="Project name"
                autoFocus
                className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {createError && (
                <p className="text-label text-destructive">{createError}</p>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setShowCreate(false)
                    setNewName("")
                    setCreateError("")
                  }}
                  className="flex-1 rounded border px-2 py-1 text-label-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || loading}
                  className="flex-1 rounded bg-primary px-2 py-1 text-label-lg font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
