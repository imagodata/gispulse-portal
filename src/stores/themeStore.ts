/**
 * themeStore — Zustand store for global dark/light/system theme management.
 *
 * Issue #195 (A7-S3): replaces per-component local state with a single shared store
 * so all consumers are synchronized when the theme changes.
 *
 * Supported values:
 *   "light"  — force light mode
 *   "dark"   — force dark mode
 *   "system" — follow OS preference (prefers-color-scheme)
 */

import { create } from "zustand"

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "gispulse:theme"

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function resolveTheme(t: Theme): "light" | "dark" {
  return t === "system" ? getSystemTheme() : t
}

function loadStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === "dark" || stored === "light" || stored === "system") return stored
  return "system"
}

function applyTheme(t: Theme) {
  const resolved = resolveTheme(t)
  const root = document.documentElement
  if (resolved === "dark") {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
}

interface ThemeState {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}

const initialTheme = loadStoredTheme()
applyTheme(initialTheme)

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  resolvedTheme: resolveTheme(initialTheme),

  setTheme: (t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t)
    applyTheme(t)
    set({ theme: t, resolvedTheme: resolveTheme(t) })
  },

  toggleTheme: () => {
    const { theme, setTheme } = get()
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
  },
}))

// Listen for OS preference changes and update when theme is "system"
if (typeof window !== "undefined") {
  const mq = window.matchMedia("(prefers-color-scheme: dark)")
  mq.addEventListener("change", () => {
    const { theme } = useThemeStore.getState()
    if (theme === "system") {
      applyTheme("system")
      useThemeStore.setState({ resolvedTheme: getSystemTheme() })
    }
  })
}
