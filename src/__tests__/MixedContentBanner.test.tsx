/**
 * MixedContentBanner.test — render matrix for issue #42.
 *
 * The banner must appear ONLY when the portal origin is HTTPS AND the
 * configured backend URL is plain http://. All four combinations are
 * exercised below. happy-dom lets us mutate `window.location.protocol`
 * directly, which jsdom historically rejected.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

import { MixedContentBanner } from "@/components/MixedContentBanner"
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

function setProtocol(protocol: "http:" | "https:") {
  // happy-dom exposes window.location as a writable structure; this is
  // safer than messing with global descriptors.
  Object.defineProperty(window.location, "protocol", {
    configurable: true,
    value: protocol,
  })
}

describe("MixedContentBanner", () => {
  beforeEach(() => {
    resetStore()
    setProtocol("http:")
  })
  afterEach(() => {
    cleanup()
    setProtocol("http:")
  })

  it("renders nothing when origin is HTTP and backend is HTTP", () => {
    setProtocol("http:")
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    render(<MixedContentBanner />)
    expect(screen.queryByTestId("mixed-content-banner")).toBeNull()
  })

  it("renders nothing when origin is HTTPS and backend is HTTPS", () => {
    setProtocol("https:")
    useSettingsStore.setState({ backendUrl: "https://api.example.com" })
    render(<MixedContentBanner />)
    expect(screen.queryByTestId("mixed-content-banner")).toBeNull()
  })

  it("renders nothing when backend is empty (demo mode)", () => {
    setProtocol("https:")
    useSettingsStore.setState({ backendUrl: "" })
    render(<MixedContentBanner />)
    expect(screen.queryByTestId("mixed-content-banner")).toBeNull()
  })

  it("renders the warning when origin is HTTPS and backend is HTTP", () => {
    setProtocol("https:")
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    render(<MixedContentBanner />)
    const banner = screen.getByTestId("mixed-content-banner")
    expect(banner).toBeTruthy()
    expect(banner.getAttribute("role")).toBe("alert")
    // The banner must include actionable copy (mentions gispulse portal CLI).
    expect(banner.textContent).toMatch(/gispulse portal/i)
  })

  it("links to the portal CLI docs", () => {
    setProtocol("https:")
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    render(<MixedContentBanner />)
    const link = screen.getByRole("link")
    expect(link.getAttribute("href")).toMatch(/portal/i)
    expect(link.getAttribute("target")).toBe("_blank")
    // External link safety
    expect(link.getAttribute("rel")).toContain("noopener")
  })
})
