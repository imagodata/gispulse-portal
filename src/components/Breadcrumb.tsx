import { useLocation } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { useProjectStore } from "@/stores/projectStore"
import { useUIStore } from "@/stores/uiStore"

const workspaceLabels: Record<string, string> = {
  explorer: "Explorer",
  map: "Map",
  datasets: "Datasets",
  workflows: "Workflows",
  catalog: "Catalog",
  schema: "Schema",
}

export function Breadcrumb() {
  const location = useLocation()
  const activeProject = useProjectStore((s) => {
    const id = s.activeProjectId
    const list = Array.isArray(s.projects) ? s.projects : []
    return list.find((p) => p.id === id)
  })
  const contextSelection = useUIStore((s) => s.contextSelection)

  const segment = location.pathname.split("/").filter(Boolean)[0] ?? "explorer"
  const workspaceLabel = workspaceLabels[segment] ?? segment

  // Build context crumbs from selection
  const crumbs: string[] = []
  if (activeProject) crumbs.push(activeProject.name)
  crumbs.push(workspaceLabel)

  // Only show context selection crumbs on panel routes (map, workflows)
  const showContext = segment === "map" || segment === "workflows"
  if (showContext) {
    if (contextSelection.type === "layer") {
      crumbs.push(contextSelection.layerName)
    } else if (contextSelection.type === "node") {
      crumbs.push(`Node ${contextSelection.nodeId}`)
    } else if (contextSelection.type === "trigger") {
      crumbs.push(`Trigger`)
    } else if (contextSelection.type === "rule") {
      crumbs.push(`Rule`)
    }
  }

  return (
    <div className="flex items-center h-6 px-3 bg-muted/30 border-b text-label-lg text-muted-foreground gap-1">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={10} className="text-muted-foreground/50" />}
          <span className={i === crumbs.length - 1 ? "text-foreground font-medium" : ""}>
            {crumb}
          </span>
        </span>
      ))}
    </div>
  )
}
