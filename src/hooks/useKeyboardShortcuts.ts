import { useEffect } from "react"
import { useUIStore } from "@/stores/uiStore"
import { navigateToView } from "@/router"

export interface KeyboardShortcut {
  key: string
  modifiers: ("ctrl" | "shift" | "alt")[]
  description: string
  group: string
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Workspace navigation (1-5)
  { key: "1", modifiers: [], description: "Switch to Explorer workspace", group: "Navigation" },
  { key: "2", modifiers: [], description: "Switch to Map workspace", group: "Navigation" },
  { key: "3", modifiers: [], description: "Switch to Schema workspace", group: "Navigation" },
  { key: "4", modifiers: [], description: "Switch to Workflows workspace", group: "Navigation" },
  { key: "5", modifiers: [], description: "Switch to Catalog workspace", group: "Navigation" },
  // Panels
  { key: "i", modifiers: ["ctrl"], description: "Toggle inspector panel", group: "Panels" },
  { key: "b", modifiers: ["ctrl"], description: "Toggle sidebar", group: "Panels" },
  // Global
  { key: "k", modifiers: ["ctrl"], description: "Open command palette", group: "Global" },
  { key: "s", modifiers: ["ctrl"], description: "Save / trigger sync", group: "Global" },
  { key: "?", modifiers: ["ctrl"], description: "Show keyboard shortcuts", group: "Global" },
  { key: "Escape", modifiers: [], description: "Close modal / overlay", group: "Global" },
]

const WORKSPACE_KEYS: Record<string, string> = {
  "1": "explorer",
  "2": "map",
  "3": "schema",
  "4": "workflows",
  "5": "catalog",
}

interface UseKeyboardShortcutsOptions {
  /** Called when Ctrl+K is pressed — open command palette */
  onCommandPalette?: () => void
  /** Called when Ctrl+? is pressed — open shortcuts help */
  onShortcutsHelp?: () => void
  /** Called when Escape is pressed */
  onEscape?: () => void
  /** Called when Ctrl+S is pressed */
  onSave?: () => void
  /** Whether shortcuts are currently enabled (false when a modal input is focused) */
  enabled?: boolean
}

/**
 * Global keyboard shortcuts hook.
 * Attach once at App root level.
 */
export function useKeyboardShortcuts({
  onCommandPalette,
  onShortcutsHelp,
  onEscape,
  onSave,
  enabled = true,
}: UseKeyboardShortcutsOptions = {}) {
  const toggleInspector = useUIStore((s) => s.toggleInspector)
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel)

  useEffect(() => {
    if (!enabled) return

    function handler(e: KeyboardEvent) {
      // Skip when the user is typing in an input / textarea / contenteditable
      const target = e.target as HTMLElement
      const isEditing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable

      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key

      // Ctrl+K — command palette (allowed even in inputs to match VSCode behavior)
      if (ctrl && key === "k") {
        e.preventDefault()
        onCommandPalette?.()
        return
      }

      // Ctrl+? — shortcuts help
      if (ctrl && (key === "?" || key === "/")) {
        e.preventDefault()
        onShortcutsHelp?.()
        return
      }

      // Escape — close overlays
      if (key === "Escape") {
        onEscape?.()
        return
      }

      // Block remaining shortcuts when typing
      if (isEditing) return

      // Workspace switch 1-5
      if (!ctrl && !e.shiftKey && !e.altKey && WORKSPACE_KEYS[key]) {
        e.preventDefault()
        navigateToView(WORKSPACE_KEYS[key])
        return
      }

      // Ctrl+I — toggle inspector
      if (ctrl && key === "i") {
        e.preventDefault()
        toggleInspector()
        return
      }

      // Ctrl+B — toggle sidebar
      if (ctrl && key === "b") {
        e.preventDefault()
        toggleLeftPanel()
        return
      }

      // Ctrl+S — save
      if (ctrl && key === "s") {
        e.preventDefault()
        onSave?.()
        return
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [enabled, onCommandPalette, onShortcutsHelp, onEscape, onSave, toggleInspector, toggleLeftPanel])
}
