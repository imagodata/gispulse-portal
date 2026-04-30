/**
 * ModeBanner.test — visual state matrix + toggle behaviour.
 *
 * Three states under test:
 *   1. demo            (backendUrl = "" or demo.gispulse.dev)
 *   2. connected       (custom backend, healthStatus = "ok"|"idle")
 *   3. disconnected    (custom backend, healthStatus = "fail")
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ModeBanner } from "@/components/ModeBanner"
import { getBannerMode } from "@/utils/backendUrl"
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

describe("getBannerMode (pure)", () => {
  it("returns demo for empty URL", () => {
    expect(getBannerMode("", "idle")).toBe("demo")
    expect(getBannerMode("", "fail")).toBe("demo") // ignored — demo wins
  })

  it("returns demo for canonical demo host", () => {
    expect(getBannerMode("https://demo.gispulse.dev", "ok")).toBe("demo")
  })

  it("returns connected for custom backend (idle, checking, ok)", () => {
    expect(getBannerMode("http://localhost:8001", "idle")).toBe("connected")
    expect(getBannerMode("http://localhost:8001", "checking")).toBe("connected")
    expect(getBannerMode("http://localhost:8001", "ok")).toBe("connected")
  })

  it("returns disconnected for custom backend with fail status", () => {
    expect(getBannerMode("http://localhost:8001", "fail")).toBe("disconnected")
  })
})

describe("ModeBanner — render states", () => {
  beforeEach(() => resetStore())
  afterEach(() => vi.restoreAllMocks())

  it("renders demo state with role=status", () => {
    const onOpenSettings = vi.fn()
    render(<ModeBanner onOpenSettings={onOpenSettings} />)
    const banner = screen.getByTestId("mode-banner")
    expect(banner.dataset.mode).toBe("demo")
    expect(banner.getAttribute("role")).toBe("status")
    expect(banner.getAttribute("aria-live")).toBe("polite")
    // Switch CTA points to "Use my engine"
    expect(screen.getByRole("button", { name: /my engine/i })).toBeInTheDocument()
  })

  it("renders connected state when backend is custom and probe succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 200 }))
    useSettingsStore.setState({ backendUrl: "http://localhost:8001", healthStatus: "ok" })
    render(<ModeBanner onOpenSettings={vi.fn()} />)
    const banner = screen.getByTestId("mode-banner")
    expect(banner.dataset.mode).toBe("connected")
    expect(banner.getAttribute("role")).toBe("status")
    expect(screen.getByText(/localhost:8001/)).toBeInTheDocument()
    // Switch CTA inverts to "Back to demo"
    expect(screen.getByRole("button", { name: /demo/i })).toBeInTheDocument()
  })

  it("renders disconnected state with role=alert when probe fails", () => {
    useSettingsStore.setState({
      backendUrl: "http://localhost:8001",
      healthStatus: "fail",
    })
    render(<ModeBanner onOpenSettings={vi.fn()} />)
    const banner = screen.getByTestId("mode-banner")
    expect(banner.dataset.mode).toBe("disconnected")
    expect(banner.getAttribute("role")).toBe("alert")
    expect(banner.getAttribute("aria-live")).toBe("assertive")
  })

  it("clicking 'Use my engine' calls onOpenSettings", () => {
    const onOpenSettings = vi.fn()
    render(<ModeBanner onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByRole("button", { name: /my engine/i }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it("clicking 'Back to demo' resets backend URL", () => {
    useSettingsStore.setState({
      backendUrl: "http://localhost:8001",
      healthStatus: "ok",
    })
    localStorage.setItem(STORAGE_KEY, "http://localhost:8001")
    render(<ModeBanner onOpenSettings={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /back to demo/i }))
    expect(useSettingsStore.getState().backendUrl).toBe("")
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("auto-probes /health on mount when in custom mode + idle", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 200 }))
    useSettingsStore.setState({
      backendUrl: "http://localhost:8001",
      healthStatus: "idle",
    })
    render(<ModeBanner onOpenSettings={vi.fn()} />)
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:8001/health",
        expect.objectContaining({ method: "GET" }),
      )
    })
  })

  it("does NOT auto-probe in demo mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    )
    render(<ModeBanner onOpenSettings={vi.fn()} />)
    // Give the effect a tick to fire (or NOT fire)
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
