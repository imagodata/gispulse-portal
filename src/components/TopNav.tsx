import { useLocation, useNavigate } from "react-router-dom"
import {
  Compass,
  Map,
  Workflow,
  Database,
  Table2,
  HardDrive,
  PanelLeft,
  PanelBottom,
  PanelRight,
  Moon,
  Sun,
  Shield,
  Package,
  Settings,
} from "lucide-react"
import { GISPulseLogo } from "@/components/GISPulseLogo"
import { useUIStore } from "@/stores/uiStore"
import { useProjectStore } from "@/stores/projectStore"
import { useLiveEventStore } from "@/hooks/useLiveEvents"
import { useJobStore } from "@/stores/jobStore"
import { useThemeStore } from "@/stores/themeStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { ModeToggle } from "@/components/ModeToggle"
import { UserMenu } from "@/components/UserMenu"
import { useT } from "@/i18n/useT"
// AdminGuard / isAdmin live in the private `gispulse-portal-pro` package.
// In the libre app the admin button is never rendered.
const isAdmin = () => false
import { PANEL_WORKSPACES, type WorkspaceId } from "@/router"

const navItems: { id: WorkspaceId; path: string; label: string; icon: typeof Map }[] = [
  { id: "explorer", path: "/explorer", label: "Explorer", icon: Compass },
  { id: "map", path: "/map", label: "Map", icon: Map },
  { id: "datasets", path: "/datasets", label: "Datasets", icon: HardDrive },
  { id: "workflows", path: "/workflows", label: "Workflows", icon: Workflow },
  { id: "catalog", path: "/catalog", label: "Catalog", icon: Database },
  { id: "schema", path: "/schema", label: "Schema", icon: Table2 },
]

export function TopNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const wsConnected = useLiveEventStore((s) => s.connected)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const runningJobs = useJobStore((s) => s.jobs.filter((j) => j.status === "running").length)
  const { resolvedTheme, toggleTheme } = useThemeStore()
  const setSettingsOpen = useSettingsStore((s) => s.setPanelOpen)
  const t = useT()

  const {
    leftPanelOpen, toggleLeftPanel,
    bottomPanelOpen, toggleBottomPanel,
    inspectorOpen, toggleInspector,
  } = useUIStore()

  const currentPath = location.pathname
  const currentWs = currentPath.split("/").filter(Boolean)[0] as WorkspaceId | undefined
  const showPanelToggles = currentWs ? PANEL_WORKSPACES.has(currentWs) : false

  return (
    <header className="flex h-10 shrink-0 items-center border-b bg-background px-2 gap-1">
      {/* Logo / Home */}
      <button
        onClick={() => setActiveProject(null)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-semibold hover:bg-accent transition-colors mr-1"
        title="Back to projects"
      >
        <GISPulseLogo animated size={20} className="text-primary" />
        <span className="hidden sm:inline">GISPulse</span>
      </button>

      {/* Separator */}
      <div className="h-5 w-px bg-border mx-1" />

      {/* Workspace tabs */}
      <nav className="flex items-center gap-0.5">
        {navItems.map(({ id, path, label, icon: Icon }) => {
          const isActive = currentPath.startsWith(path)
          return (
            <button
              key={id}
              onClick={() => navigate(path)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors relative ${
                isActive
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={14} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="hidden md:inline">{label}</span>
              {/* Active underline */}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t bg-primary" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Right section */}
      <div className="ml-auto flex items-center gap-1">
        {/* Running jobs badge */}
        {runningJobs > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-label font-medium mr-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {runningJobs} job{runningJobs > 1 ? "s" : ""}
          </div>
        )}

        {/* Mode toggle — #31 (Mode 2 portal: Try it / My engine segmented) */}
        <ModeToggle onOpenSettings={() => setSettingsOpen(true)} />

        {/* Theme toggle — #208 */}
        <button
          onClick={toggleTheme}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {resolvedTheme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Settings — #30 (Mode 2 portal) */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title={t("settings.open_label")}
          aria-label={t("settings.open_label")}
          data-testid="open-settings"
        >
          <Settings size={14} />
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full mr-1" title={wsConnected ? "Connected" : "Disconnected"}>
          <span
            className={`h-2 w-2 rounded-full ${wsConnected ? "bg-gp-success" : "bg-destructive"}`}
          />
          <span className="text-label text-muted-foreground hidden sm:inline">
            {wsConnected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Marketplace link — visible to all authenticated users */}
        <button
          onClick={() => navigate("/marketplace")}
          className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
            currentPath.startsWith("/marketplace")
              ? "text-foreground bg-accent"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          title="Marketplace"
          aria-label="Marketplace"
        >
          <Package size={13} />
        </button>

        {/* Admin panel link — only visible for admin role */}
        {isAdmin() && (
          <button
            onClick={() => navigate("/admin")}
            className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
              currentPath.startsWith("/admin")
                ? "text-foreground bg-accent"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Admin Panel"
            aria-label="Admin Panel"
          >
            <Shield size={13} />
          </button>
        )}

        {/* User menu */}
        <div className="border-l pl-1 ml-1">
          <UserMenu />
        </div>

        {/* Panel toggles — only for map/workflows views */}
        {showPanelToggles && (
          <div className="flex items-center gap-0.5 border-l pl-1 ml-1">
            <button
              onClick={toggleLeftPanel}
              className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                leftPanelOpen
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
            >
              <PanelLeft size={14} />
            </button>
            <button
              onClick={toggleBottomPanel}
              className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                bottomPanelOpen
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title="Toggle bottom panel"
              aria-label="Toggle bottom panel"
            >
              <PanelBottom size={14} />
            </button>
            <button
              onClick={toggleInspector}
              className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                inspectorOpen
                  ? "text-foreground bg-accent"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title="Toggle inspector"
              aria-label="Toggle inspector"
            >
              <PanelRight size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
