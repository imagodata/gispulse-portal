import { describe, it, expect } from "vitest"
import { KEYBOARD_SHORTCUTS } from "@/hooks/useKeyboardShortcuts"

describe("KEYBOARD_SHORTCUTS manifest", () => {
  it("has at least one shortcut per group: Navigation, Panels, Global", () => {
    const groups = new Set(KEYBOARD_SHORTCUTS.map((s) => s.group))
    expect(groups.has("Navigation")).toBe(true)
    expect(groups.has("Panels")).toBe(true)
    expect(groups.has("Global")).toBe(true)
  })

  it("all shortcuts have a non-empty description", () => {
    for (const s of KEYBOARD_SHORTCUTS) {
      expect(s.description.trim().length).toBeGreaterThan(0)
    }
  })

  it("workspace shortcuts 1-5 are all present", () => {
    const navShortcuts = KEYBOARD_SHORTCUTS.filter((s) => s.group === "Navigation")
    const keys = navShortcuts.map((s) => s.key)
    for (const k of ["1", "2", "3", "4", "5"]) {
      expect(keys).toContain(k)
    }
  })

  it("Ctrl+K shortcut is defined", () => {
    const kCmd = KEYBOARD_SHORTCUTS.find(
      (s) => s.key === "k" && s.modifiers.includes("ctrl"),
    )
    expect(kCmd).toBeDefined()
  })
})
