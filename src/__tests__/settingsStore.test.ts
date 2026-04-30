/**
 * settingsStore.test — store mutations + healthcheck probe.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { useSettingsStore, probeHealth, STORAGE_KEY } from "@/stores/settingsStore"

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

describe("settingsStore.setBackendUrl", () => {
  beforeEach(() => resetStore())

  it("normalizes and persists a valid URL", () => {
    useSettingsStore.getState().setBackendUrl("http://localhost:8001/")
    expect(useSettingsStore.getState().backendUrl).toBe("http://localhost:8001")
    expect(localStorage.getItem(STORAGE_KEY)).toBe("http://localhost:8001")
  })

  it("ignores invalid URLs (no state mutation)", () => {
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    useSettingsStore.getState().setBackendUrl("not a url")
    expect(useSettingsStore.getState().backendUrl).toBe("http://localhost:8001")
  })

  it("empty string clears localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "http://localhost:8001")
    useSettingsStore.getState().setBackendUrl("")
    expect(useSettingsStore.getState().backendUrl).toBe("")
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("resets healthStatus on URL change", () => {
    useSettingsStore.setState({ healthStatus: "ok", healthLatencyMs: 42 })
    useSettingsStore.getState().setBackendUrl("http://localhost:8001")
    expect(useSettingsStore.getState().healthStatus).toBe("idle")
    expect(useSettingsStore.getState().healthLatencyMs).toBeNull()
  })
})

describe("settingsStore.reset", () => {
  beforeEach(() => resetStore())

  it("reverts URL to empty and clears localStorage", () => {
    useSettingsStore.getState().setBackendUrl("http://localhost:8001")
    useSettingsStore.getState().reset()
    expect(useSettingsStore.getState().backendUrl).toBe("")
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe("settingsStore.runHealthcheck", () => {
  beforeEach(() => resetStore())
  afterEach(() => vi.restoreAllMocks())

  it("sets status to ok on 200 response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    )
    const status = await useSettingsStore.getState().runHealthcheck("http://localhost:8001")
    expect(status).toBe("ok")
    expect(useSettingsStore.getState().healthStatus).toBe("ok")
    expect(useSettingsStore.getState().healthLatencyMs).toBeTypeOf("number")
    fetchSpy.mockRestore()
  })

  it("sets status to fail on 5xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    )
    const status = await useSettingsStore.getState().runHealthcheck("http://localhost:8001")
    expect(status).toBe("fail")
    expect(useSettingsStore.getState().healthStatus).toBe("fail")
    expect(useSettingsStore.getState().healthError).toContain("500")
  })

  it("sets status to fail on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"))
    const status = await useSettingsStore.getState().runHealthcheck("http://localhost:8001")
    expect(status).toBe("fail")
    expect(useSettingsStore.getState().healthError).toBe("ECONNREFUSED")
  })

  it("uses store URL when no override is provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    )
    useSettingsStore.setState({ backendUrl: "http://stored.example.com" })
    await useSettingsStore.getState().runHealthcheck()
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://stored.example.com/health",
      expect.objectContaining({ method: "GET" }),
    )
  })
})

describe("probeHealth (pure)", () => {
  afterEach(() => vi.restoreAllMocks())

  it("uses bare /health for empty URL (proxy default)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("", { status: 200 }))
    await probeHealth("", fetchSpy as unknown as typeof fetch)
    expect(fetchSpy).toHaveBeenCalledWith("/health", expect.any(Object))
  })

  it("appends /health to a custom URL", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("", { status: 200 }))
    await probeHealth("http://localhost:8001", fetchSpy as unknown as typeof fetch)
    expect(fetchSpy).toHaveBeenCalledWith("http://localhost:8001/health", expect.any(Object))
  })

  it("returns timeout error when AbortError is raised", async () => {
    const fetchSpy = vi.fn().mockImplementation(() => {
      const err = new DOMException("aborted", "AbortError")
      return Promise.reject(err)
    })
    const r = await probeHealth("http://localhost:8001", fetchSpy as unknown as typeof fetch)
    expect(r.status).toBe("fail")
    expect(r.error).toBe("timeout")
  })
})
