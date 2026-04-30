/**
 * request.test — issue #41: settingsStore.backendUrl wiring.
 *
 * Asserts the URL composition contract:
 *   - empty store URL  → fetch hits /api/portal/...  + /health
 *   - custom store URL → fetch hits {url}/api/portal/...  + {url}/health
 *   - trailing slash on the stored URL is stripped
 *   - cache invalidation when the user swaps backends mid-session
 *   - legacy `BASE` import surface still works under template literals
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  request,
  isBackendAlive,
  getBase,
  BASE,
  API_PATH_PREFIX,
  _resetBackendAliveCache,
} from "@/api/request"
import { useSettingsStore } from "@/stores/settingsStore"

function makeOk(body: unknown = {}, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response
}

function resetStore() {
  useSettingsStore.setState({
    backendUrl: "",
    healthStatus: "idle",
    healthLatencyMs: null,
    healthError: null,
    panelOpen: false,
    readOnlyDialogOpen: false,
  })
}

describe("getBase()", () => {
  beforeEach(() => resetStore())

  it("returns the proxy default when backendUrl is empty", () => {
    expect(getBase()).toBe("/api/portal")
    expect(getBase()).toBe(API_PATH_PREFIX)
  })

  it("composes {backendUrl}/api/portal when a custom URL is set", () => {
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    expect(getBase()).toBe("http://localhost:8001/api/portal")
  })

  it("strips a trailing slash from the stored URL", () => {
    // Direct setState bypasses the validator; getBase() must still
    // produce a clean URL with no double slash.
    useSettingsStore.setState({ backendUrl: "http://localhost:8001/" })
    expect(getBase()).toBe("http://localhost:8001/api/portal")
  })

  it("honors HTTPS origins (e.g. demo backend)", () => {
    useSettingsStore.setState({ backendUrl: "https://demo.gispulse.dev" })
    expect(getBase()).toBe("https://demo.gispulse.dev/api/portal")
  })
})

describe("BASE legacy proxy", () => {
  beforeEach(() => resetStore())

  it("stringifies to the live getBase() result inside template literals", () => {
    expect(`${BASE}/datasets/upload`).toBe("/api/portal/datasets/upload")
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    expect(`${BASE}/datasets/upload`).toBe(
      "http://localhost:8001/api/portal/datasets/upload",
    )
  })

  it("supports standard string methods (.length, .startsWith)", () => {
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    // String methods get forwarded onto the resolved live string.
    expect((BASE as unknown as string).startsWith("http://")).toBe(true)
  })
})

describe("request() URL composition", () => {
  const ORIGINAL_FETCH = global.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetStore()
    _resetBackendAliveCache()
    fetchMock = vi.fn(async (url: RequestInfo | URL): Promise<Response> => {
      // Auto-respond OK to every call; the assertions check the URL.
      void url
      return makeOk({ ok: true })
    })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
  })

  it("hits same-origin /api/portal/... when store is empty", async () => {
    await request("/datasets")
    // First call is the /health probe, second is the actual request.
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls).toContain("/health")
    expect(urls).toContain("/api/portal/datasets")
  })

  it("hits {backendUrl}/api/portal/... when a custom URL is set", async () => {
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    await request("/projects")
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls).toContain("http://localhost:8001/health")
    expect(urls).toContain("http://localhost:8001/api/portal/projects")
  })

  it("re-resolves the URL on every call (live wiring, not cached)", async () => {
    // First call against the demo backend.
    await request("/foo")
    let urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls).toContain("/api/portal/foo")

    // User switches to a custom backend mid-session.
    useSettingsStore.setState({ backendUrl: "http://my.engine:8001" })
    _resetBackendAliveCache() // simulate the SettingsPanel commit hook
    fetchMock.mockClear()

    await request("/bar")
    urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls).toContain("http://my.engine:8001/health")
    expect(urls).toContain("http://my.engine:8001/api/portal/bar")
  })

  it("propagates query strings and JSON body without mangling the base", async () => {
    useSettingsStore.setState({ backendUrl: "https://demo.gispulse.dev" })
    await request("/sql/preview?limit=10", {
      method: "POST",
      body: JSON.stringify({ query: "SELECT 1" }),
    })
    const lastCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/sql/preview"),
    )
    expect(lastCall).toBeDefined()
    expect(String(lastCall![0])).toBe(
      "https://demo.gispulse.dev/api/portal/sql/preview?limit=10",
    )
    const init = lastCall![1] as RequestInit
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ query: "SELECT 1" }))
  })
})

describe("isBackendAlive() cache invalidation", () => {
  const ORIGINAL_FETCH = global.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetStore()
    _resetBackendAliveCache()
    fetchMock = vi.fn(async (url: RequestInfo | URL): Promise<Response> => {
      void url
      return makeOk({ ok: true })
    })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH
    vi.restoreAllMocks()
  })

  it("re-probes /health when the user swaps backends", async () => {
    // First call: demo (empty) → probes /health
    await isBackendAlive()
    expect(fetchMock).toHaveBeenCalledWith("/health", expect.any(Object))

    // User connects to local engine — the next isBackendAlive() must
    // probe the new origin, not return the cached "alive" from /health.
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    await isBackendAlive()
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8001/health",
      expect.any(Object),
    )
  })
})
