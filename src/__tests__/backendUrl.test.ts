/**
 * backendUrl.test — pure validation / normalization helpers.
 * No DOM, no React — just URL parsing edge cases.
 */
import { describe, it, expect } from "vitest"
import {
  validateBackendUrl,
  normalizeBackendUrl,
  parseQueryBackend,
  isDemoBackend,
  backendHostLabel,
  DEMO_BACKEND_HOST,
} from "@/utils/backendUrl"

describe("validateBackendUrl", () => {
  it("accepts empty string as demo sentinel", () => {
    expect(validateBackendUrl("")).toEqual({ ok: true })
    expect(validateBackendUrl("   ")).toEqual({ ok: true })
  })

  it("accepts http and https hosts", () => {
    expect(validateBackendUrl("http://localhost:8001").ok).toBe(true)
    expect(validateBackendUrl("https://api.example.com").ok).toBe(true)
    expect(validateBackendUrl("http://127.0.0.1:8001/").ok).toBe(true)
  })

  it("rejects non-http schemes", () => {
    expect(validateBackendUrl("ws://example.com")).toEqual({ ok: false, reason: "scheme" })
    expect(validateBackendUrl("file:///etc/passwd")).toEqual({ ok: false, reason: "scheme" })
    expect(validateBackendUrl("ftp://example.com")).toEqual({ ok: false, reason: "scheme" })
  })

  it("rejects malformed URLs", () => {
    expect(validateBackendUrl("not a url")).toEqual({ ok: false, reason: "format" })
    expect(validateBackendUrl("//example.com")).toEqual({ ok: false, reason: "format" })
    expect(validateBackendUrl("example.com")).toEqual({ ok: false, reason: "format" })
  })

  it("rejects URLs with trailing path segments", () => {
    expect(validateBackendUrl("https://api.example.com/v1")).toEqual({
      ok: false,
      reason: "trailing_path",
    })
    expect(validateBackendUrl("https://api.example.com/api/portal")).toEqual({
      ok: false,
      reason: "trailing_path",
    })
  })

  it("accepts trailing slash (will be stripped on normalize)", () => {
    expect(validateBackendUrl("https://api.example.com/").ok).toBe(true)
    expect(validateBackendUrl("https://api.example.com//").ok).toBe(true)
  })
})

describe("normalizeBackendUrl", () => {
  it("preserves empty string", () => {
    expect(normalizeBackendUrl("")).toBe("")
    expect(normalizeBackendUrl("  ")).toBe("")
  })

  it("strips trailing slashes", () => {
    expect(normalizeBackendUrl("https://api.example.com/")).toBe("https://api.example.com")
    expect(normalizeBackendUrl("http://127.0.0.1:8001/")).toBe("http://127.0.0.1:8001")
  })

  it("preserves port", () => {
    expect(normalizeBackendUrl("http://localhost:8001")).toBe("http://localhost:8001")
  })

  it("returns trimmed input on parse failure (defensive)", () => {
    expect(normalizeBackendUrl("not a url")).toBe("not a url")
  })
})

describe("parseQueryBackend", () => {
  it("returns null when ?backend is missing", () => {
    expect(parseQueryBackend("")).toBeNull()
    expect(parseQueryBackend("?other=foo")).toBeNull()
  })

  it("extracts and normalizes a valid backend param", () => {
    expect(parseQueryBackend("?backend=http://localhost:8001/")).toBe("http://localhost:8001")
    expect(parseQueryBackend("backend=https://api.example.com")).toBe("https://api.example.com")
  })

  it("returns null when backend param is invalid", () => {
    expect(parseQueryBackend("?backend=not-a-url")).toBeNull()
    expect(parseQueryBackend("?backend=ws://example.com")).toBeNull()
    expect(parseQueryBackend("?backend=https://api.example.com/v1")).toBeNull()
  })

  it("decodes URL-encoded backend value", () => {
    expect(parseQueryBackend("?backend=https%3A%2F%2Fapi.example.com")).toBe(
      "https://api.example.com",
    )
  })
})

describe("isDemoBackend", () => {
  it("treats empty as demo", () => {
    expect(isDemoBackend("")).toBe(true)
  })

  it("matches the canonical demo host", () => {
    expect(isDemoBackend(`https://${DEMO_BACKEND_HOST}`)).toBe(true)
    expect(isDemoBackend(`https://${DEMO_BACKEND_HOST}/`)).toBe(true)
  })

  it("rejects other hosts", () => {
    expect(isDemoBackend("http://localhost:8001")).toBe(false)
    expect(isDemoBackend("https://api.example.com")).toBe(false)
  })

  it("returns false on parse failure", () => {
    expect(isDemoBackend("garbage")).toBe(false)
  })
})

describe("backendHostLabel", () => {
  it("returns the demo host for empty input", () => {
    expect(backendHostLabel("")).toBe(DEMO_BACKEND_HOST)
  })

  it("returns host with port", () => {
    expect(backendHostLabel("http://localhost:8001")).toBe("localhost:8001")
    expect(backendHostLabel("https://api.example.com")).toBe("api.example.com")
  })

  it("returns input on parse failure", () => {
    expect(backendHostLabel("garbage")).toBe("garbage")
  })
})
