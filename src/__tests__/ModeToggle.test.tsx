/**
 * ModeToggle.test — segmented header control for issue #31.
 *
 * Validates active-segment derivation from `settingsStore.backendUrl`,
 * the demo→engine click (opens settings), and the engine→demo click
 * (calls reset).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"

import { ModeToggle } from "@/components/ModeToggle"
import { useSettingsStore, STORAGE_KEY } from "@/stores/settingsStore"

function resetStore() {
  useSettingsStore.setState({
    backendUrl: "",
    healthStatus: "idle",
    healthLatencyMs: null,
    healthError: null,
    panelOpen: false,
    readOnlyDialogOpen: false,
  })
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

describe("ModeToggle", () => {
  beforeEach(resetStore)
  afterEach(cleanup)

  it("marks the demo segment active when backendUrl is empty", () => {
    useSettingsStore.setState({ backendUrl: "" })
    render(<ModeToggle onOpenSettings={() => {}} />)
    expect(screen.getByTestId("mode-toggle-demo").getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByTestId("mode-toggle-engine").getAttribute("aria-pressed")).toBe("false")
  })

  it("marks the engine segment active when backendUrl is set", () => {
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    render(<ModeToggle onOpenSettings={() => {}} />)
    expect(screen.getByTestId("mode-toggle-demo").getAttribute("aria-pressed")).toBe("false")
    expect(screen.getByTestId("mode-toggle-engine").getAttribute("aria-pressed")).toBe("true")
  })

  it("opens settings when demo user clicks 'My engine'", () => {
    const onOpen = vi.fn()
    useSettingsStore.setState({ backendUrl: "" })
    render(<ModeToggle onOpenSettings={onOpen} />)
    fireEvent.click(screen.getByTestId("mode-toggle-engine"))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it("calls reset() when engine user clicks 'Try it'", () => {
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    render(<ModeToggle onOpenSettings={() => {}} />)
    fireEvent.click(screen.getByTestId("mode-toggle-demo"))
    expect(useSettingsStore.getState().backendUrl).toBe("")
  })

  it("attaches the read-only tooltip on the active demo segment", () => {
    useSettingsStore.setState({ backendUrl: "" })
    render(<ModeToggle onOpenSettings={() => {}} />)
    const demo = screen.getByTestId("mode-toggle-demo")
    expect(demo.getAttribute("title")).toMatch(/read-only|lecture seule/i)
  })

  it("does NOT show tooltip on demo segment when user is on engine", () => {
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    render(<ModeToggle onOpenSettings={() => {}} />)
    const demo = screen.getByTestId("mode-toggle-demo")
    expect(demo.getAttribute("title")).toBeNull()
  })
})
