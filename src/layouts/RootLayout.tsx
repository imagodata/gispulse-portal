import { useEffect, useState, useCallback } from "react"
import { Outlet } from "react-router-dom"
import { Toaster } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ProjectsPage } from "@/components/ProjectsPage"
import { RuleEditorModal } from "@/components/rules/RuleEditorModal"
import { TriggerBuilderModal } from "@/components/triggers/TriggerBuilderModal"
import { JobTrackerCorner } from "@/components/JobTrackerCorner"
import { BackendStatusBanner } from "@/components/BackendStatusBanner"
import { CommandPalette } from "@/components/CommandPalette"
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp"
import { OnboardingFlow, isOnboardingDone } from "@/components/OnboardingFlow"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useProjectStore } from "@/stores/projectStore"
import { useAuthStore } from "@/stores/authStore"

export function RootLayout() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)
  const checkAuth = useAuthStore((s) => s.checkAuth)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(() => !isOnboardingDone())

  const handleOpenPalette = useCallback(() => setPaletteOpen(true), [])
  const handleClosePalette = useCallback(() => setPaletteOpen(false), [])
  const handleOpenShortcuts = useCallback(() => setShortcutsOpen(true), [])
  const handleCloseShortcuts = useCallback(() => setShortcutsOpen(false), [])
  const handleCloseOnboarding = useCallback(() => setOnboardingOpen(false), [])

  const handleEscape = useCallback(() => {
    if (paletteOpen) setPaletteOpen(false)
    else if (shortcutsOpen) setShortcutsOpen(false)
  }, [paletteOpen, shortcutsOpen])

  useKeyboardShortcuts({
    onCommandPalette: handleOpenPalette,
    onShortcutsHelp: handleOpenShortcuts,
    onEscape: handleEscape,
  })

  useEffect(() => {
    // Check auth session on app start — before fetching projects
    // Errors are gracefully swallowed; unauthenticated is a valid state
    checkAuth().catch(() => {})
  }, [checkAuth])

  useEffect(() => {
    // Errors are surfaced via BackendStatusBanner — no console pollution in prod (#212)
    fetchProjects().catch(() => {})
  }, [fetchProjects])

  if (!activeProjectId) {
    return (
      <TooltipProvider>
        <BackendStatusBanner />
        <ProjectsPage />
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <BackendStatusBanner />
      <Outlet />
      <RuleEditorModal />
      <TriggerBuilderModal />
      <JobTrackerCorner />
      <Toaster position="bottom-right" richColors />
      {/* Global overlays */}
      <CommandPalette open={paletteOpen} onClose={handleClosePalette} />
      <KeyboardShortcutsHelp open={shortcutsOpen} onClose={handleCloseShortcuts} />
      {onboardingOpen && <OnboardingFlow onDone={handleCloseOnboarding} />}
    </TooltipProvider>
  )
}
