import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  getBreaks,
  putStyle,
  importQml,
  exportQml,
  classifyMethodToBreaksMethod,
} from "@/api/styles"
import type { LayerStyleDef } from "@/types/layerStyle"

const ORIGINAL_FETCH = global.fetch
const _queue: Response[] = []

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response
}

beforeEach(() => {
  _queue.length = 0
  global.fetch = vi.fn(async (url: RequestInfo | URL): Promise<Response> => {
    const u = typeof url === "string" ? url : url.toString()
    if (u.endsWith("/health")) {
      return makeResponse({ ok: true })
    }
    const next = _queue.shift()
    if (!next) throw new Error(`No mock response queued for ${u}`)
    return next
  }) as typeof fetch
})

afterEach(() => {
  global.fetch = ORIGINAL_FETCH
  vi.restoreAllMocks()
})

function mockJson(body: unknown, status = 200) {
  _queue.push(makeResponse(body, status))
}

function lastNonHealthCall(): [string, RequestInit] {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
  for (let i = calls.length - 1; i >= 0; i--) {
    const u = typeof calls[i][0] === "string" ? calls[i][0] : calls[i][0].toString()
    if (!u.endsWith("/health")) return calls[i] as [string, RequestInit]
  }
  throw new Error("No non-health fetch recorded")
}

describe("getBreaks", () => {
  it("POSTs field/method/n_classes and returns parsed result", async () => {
    mockJson({
      field: "pop",
      method: "jenks",
      n_classes: 5,
      breaks: [1, 5, 10, 15, 20, 25],
      labels: ["1 – 5", "5 – 10", "10 – 15", "15 – 20", "20 – 25"],
    })
    const res = await getBreaks("ds-1", "parcels", "pop", "jenks", 5)
    expect(res.breaks).toHaveLength(6)
    expect(res.labels).toHaveLength(5)
    const call = lastNonHealthCall()
    expect(call[0]).toContain("/datasets/ds-1/layers/parcels/breaks")
    expect(call[1].method).toBe("POST")
    expect(JSON.parse(call[1].body)).toEqual({
      field: "pop",
      method: "jenks",
      n_classes: 5,
    })
  })

  it("defaults to jenks + 5 classes", async () => {
    mockJson({ field: "x", method: "jenks", n_classes: 5, breaks: [], labels: [] })
    await getBreaks("ds", "l", "x")
    const body = JSON.parse(lastNonHealthCall()[1].body as string)
    expect(body.method).toBe("jenks")
    expect(body.n_classes).toBe(5)
  })
})

describe("putStyle", () => {
  it("PUTs style_def and normalises 'mixed' geom to polygon", async () => {
    mockJson({ layer_name: "parcels", qml_size_bytes: 512 })
    const styleDef: LayerStyleDef = {
      renderer: "single",
      symbol: { kind: "fill", color: "#ff0000", opacity: 0.5, strokeColor: "#000", strokeWidth: 1 },
    }
    await putStyle("ds-1", "parcels", styleDef, "mixed")
    const call = lastNonHealthCall()
    expect(call[1].method).toBe("PUT")
    const body = JSON.parse(call[1].body)
    expect(body.layer_name).toBe("parcels")
    expect(body.geom_type).toBe("polygon")
    expect(body.style_def.renderer).toBe("single")
  })
})

describe("importQml", () => {
  it("uploads multipart with file + layer_name + geom_type", async () => {
    mockJson({
      layer_name: "parcels",
      style_def: { renderer: "single" },
      qml_size_bytes: 256,
    })
    const file = new File(["<qgis/>"], "fixture.qml", { type: "application/xml" })
    const res = await importQml("ds-1", "parcels", file, "polygon")
    expect(res.layer_name).toBe("parcels")
    expect(res.style_def.renderer).toBe("single")
    const call = lastNonHealthCall()
    expect(call[0]).toContain("/datasets/ds-1/styles/import")
    expect(call[1].method).toBe("POST")
    expect(call[1].body).toBeInstanceOf(FormData)
  })

  it("throws on non-2xx response", async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Invalid QML",
      json: async () => ({}),
    } as Response)
    const file = new File(["bad"], "bad.qml")
    await expect(importQml("ds", "l", file)).rejects.toThrow(/400/)
  })
})

describe("exportQml", () => {
  it("returns matching layer's QML as Blob", async () => {
    mockJson({
      styles: [
        { f_table_name: "other", styleQML: "<other/>" },
        { f_table_name: "parcels", styleQML: "<qgis>parcels</qgis>" },
      ],
    })
    const blob = await exportQml("ds", "parcels")
    expect(blob).toBeInstanceOf(Blob)
    expect(await blob.text()).toBe("<qgis>parcels</qgis>")
  })

  it("throws if layer not found in styles", async () => {
    mockJson({ styles: [] })
    await expect(exportQml("ds", "missing")).rejects.toThrow(/No QML style/)
  })
})

describe("classifyMethodToBreaksMethod", () => {
  it("maps natural_breaks to jenks", () => {
    expect(classifyMethodToBreaksMethod("natural_breaks")).toBe("jenks")
  })
  it("preserves quantile / equal_interval / std_dev", () => {
    expect(classifyMethodToBreaksMethod("quantile")).toBe("quantile")
    expect(classifyMethodToBreaksMethod("equal_interval")).toBe("equal_interval")
    expect(classifyMethodToBreaksMethod("std_dev")).toBe("std_dev")
  })
})
