/**
 * styleEditors.test.tsx — Behavioural tests for the v1.5 style editors.
 *
 * Coverage:
 *   - GraduatedEditor (#23): server-side breaks call + histogram render +
 *     manual mode disables the Classify button.
 *   - CategorizedEditor (#24): cap at 12 distinct values + "Other" fallback
 *     + overflow notice rendered when distinct > 12.
 *   - BlendModeEditor (#27): renders 12 options.
 *   - ScaleVisibility (#28): "Zoom to layer extent" delegates to mapStore;
 *     disabled when bbox is unavailable.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { fireEvent, screen, waitFor, render } from "@testing-library/react"

vi.mock("@/api/styles", async () => {
  const actual = await vi.importActual<typeof import("@/api/styles")>("@/api/styles")
  return {
    ...actual,
    getBreaks: vi.fn(),
    getDistinctValues: vi.fn(),
    getFieldStats: vi.fn(),
  }
})

import {
  getBreaks,
  getDistinctValues,
  getFieldStats,
} from "@/api/styles"

import { GraduatedEditor } from "@/components/style/GraduatedEditor"
import { CategorizedEditor } from "@/components/style/CategorizedEditor"
import { BlendModeEditor } from "@/components/style/BlendModeEditor"
import { ScaleVisibility } from "@/components/style/ScaleVisibility"
import { useMapStore } from "@/stores/mapStore"
import { BLEND_MODES } from "@/types/layerStyle"
import type { GraduatedEntry, CategoryEntry } from "@/types/layerStyle"
import type { LayerField } from "@/types/dataset"

const NUMERIC_FIELDS: LayerField[] = [
  { name: "pop", type: "int" },
  { name: "label", type: "string" },
]

const ANY_FIELDS: LayerField[] = [
  { name: "category", type: "string" },
  { name: "id", type: "int" },
]

beforeEach(() => {
  vi.mocked(getBreaks).mockReset()
  vi.mocked(getDistinctValues).mockReset()
  vi.mocked(getFieldStats).mockReset()
})

// ───────────────────────────────────────────────────────────────────────
// GraduatedEditor — issue #23
// ───────────────────────────────────────────────────────────────────────

describe("GraduatedEditor (#23)", () => {
  it("calls server-side getBreaks when Classify is clicked, with the selected method + numClasses", async () => {
    vi.mocked(getFieldStats).mockResolvedValue({
      field: "pop",
      count: 100,
      min: 0,
      max: 100,
      mean: 50,
      std: 25,
      quantiles: { "0.25": 25, "0.5": 50, "0.75": 75 },
    })
    vi.mocked(getBreaks).mockResolvedValue({
      field: "pop",
      method: "jenks",
      n_classes: 5,
      breaks: [0, 20, 40, 60, 80, 100],
      labels: ["0–20", "20–40", "40–60", "60–80", "80–100"],
    })

    const onClassesChange = vi.fn()
    render(
      <GraduatedEditor
        geom="polygon"
        fields={NUMERIC_FIELDS}
        datasetId="ds-1"
        layerName="parcels"
        graduatedField="pop"
        classifyMethod="natural_breaks"
        colorRamp={undefined}
        classes={[]}
        onFieldChange={vi.fn()}
        onMethodChange={vi.fn()}
        onRampChange={vi.fn()}
        onClassesChange={onClassesChange}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /classify/i }))

    await waitFor(() => {
      expect(getBreaks).toHaveBeenCalledWith("ds-1", "parcels", "pop", "jenks", 5)
    })
    await waitFor(() => {
      expect(onClassesChange).toHaveBeenCalled()
    })
    const entries = onClassesChange.mock.calls[0][0] as GraduatedEntry[]
    expect(entries).toHaveLength(5)
    expect(entries[0].lower).toBe(0)
    expect(entries[4].upper).toBe(100)
  })

  it("disables Classify when method is 'manual' so user edits are preserved", () => {
    vi.mocked(getFieldStats).mockResolvedValue({
      field: "pop", count: 100, min: 0, max: 100, mean: 50, std: 25,
      quantiles: { "0.5": 50 },
    })
    render(
      <GraduatedEditor
        geom="polygon"
        fields={NUMERIC_FIELDS}
        datasetId="ds-1"
        layerName="parcels"
        graduatedField="pop"
        classifyMethod="manual"
        colorRamp={undefined}
        classes={[
          { lower: 0, upper: 50, label: "0–50", symbol: { kind: "fill", color: "#000", opacity: 1, strokeColor: "#000", strokeWidth: 1 } },
          { lower: 50, upper: 100, label: "50–100", symbol: { kind: "fill", color: "#fff", opacity: 1, strokeColor: "#fff", strokeWidth: 1 } },
        ]}
        onFieldChange={vi.fn()}
        onMethodChange={vi.fn()}
        onRampChange={vi.fn()}
        onClassesChange={vi.fn()}
      />,
    )
    const classifyBtn = screen.getByRole("button", { name: /classify/i })
    expect(classifyBtn).toBeDisabled()
  })

  it("renders the histogram with class break overlays once stats arrive", async () => {
    vi.mocked(getFieldStats).mockResolvedValue({
      field: "pop",
      count: 100,
      min: 0,
      max: 100,
      mean: 50,
      std: 25,
      quantiles: { "0.25": 25, "0.5": 50, "0.75": 75 },
    })
    const { container } = render(
      <GraduatedEditor
        geom="polygon"
        fields={NUMERIC_FIELDS}
        datasetId="ds-1"
        layerName="parcels"
        graduatedField="pop"
        classifyMethod="natural_breaks"
        colorRamp={undefined}
        classes={[
          { lower: 0,  upper: 50,  label: "0–50",  symbol: { kind: "fill", color: "#000", opacity: 1, strokeColor: "#000", strokeWidth: 1 } },
          { lower: 50, upper: 100, label: "50–100", symbol: { kind: "fill", color: "#fff", opacity: 1, strokeColor: "#fff", strokeWidth: 1 } },
        ]}
        onFieldChange={vi.fn()}
        onMethodChange={vi.fn()}
        onRampChange={vi.fn()}
        onClassesChange={vi.fn()}
      />,
    )

    // Wait for stats fetch to populate the histogram
    await waitFor(() => {
      expect(getFieldStats).toHaveBeenCalled()
    })
    await waitFor(() => {
      const svg = container.querySelector("svg")
      expect(svg).toBeTruthy()
      // 20 bins → 20 <rect>, plus 1 break-line for the inner break (50)
      const rects = svg!.querySelectorAll("rect")
      const lines = svg!.querySelectorAll("line")
      expect(rects.length).toBe(20)
      expect(lines.length).toBe(1)
    })
  })
})

// ───────────────────────────────────────────────────────────────────────
// CategorizedEditor — issue #24
// ───────────────────────────────────────────────────────────────────────

describe("CategorizedEditor (#24)", () => {
  it("caps distinct values at 12 and appends an 'Other' fallback bucket", async () => {
    // 15 distinct values from the backend
    const values = Array.from({ length: 15 }, (_, i) => `cat_${i}`)
    vi.mocked(getDistinctValues).mockResolvedValue({
      field: "category",
      count: 15,
      values,
    })

    const onCategoriesChange = vi.fn()
    render(
      <CategorizedEditor
        geom="polygon"
        fields={ANY_FIELDS}
        datasetId="ds-1"
        layerName="parcels"
        classField="category"
        categories={[]}
        onFieldChange={vi.fn()}
        onCategoriesChange={onCategoriesChange}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /fetch distinct/i }))

    await waitFor(() => {
      expect(onCategoriesChange).toHaveBeenCalled()
    })
    const cats = onCategoriesChange.mock.calls[0][0] as CategoryEntry[]
    // 12 capped + 1 "Other"
    expect(cats).toHaveLength(13)
    expect(cats.slice(0, 12).every((c) => c.value !== null)).toBe(true)
    const other = cats[cats.length - 1]
    expect(other.value).toBeNull()
  })

  it("shows overflow notice when distinct count exceeds the cap", async () => {
    vi.mocked(getDistinctValues).mockResolvedValue({
      field: "category",
      count: 50,
      values: Array.from({ length: 20 }, (_, i) => `v_${i}`),
    })

    const { rerender } = render(
      <CategorizedEditor
        geom="polygon"
        fields={ANY_FIELDS}
        datasetId="ds-1"
        layerName="parcels"
        classField="category"
        categories={[]}
        onFieldChange={vi.fn()}
        onCategoriesChange={(cats) => {
          // Trigger a re-render with classified categories so the
          // overflow notice (which only shows when categories.length > 0
          // AND overflow > 0) becomes visible.
          rerender(
            <CategorizedEditor
              geom="polygon"
              fields={ANY_FIELDS}
              datasetId="ds-1"
              layerName="parcels"
              classField="category"
              categories={cats}
              onFieldChange={vi.fn()}
              onCategoriesChange={vi.fn()}
            />,
          )
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /fetch distinct/i }))

    await waitFor(() => {
      // The notice contains "Showing top 12" and the overflow count
      expect(screen.getByRole("status")).toHaveTextContent(/12/)
      expect(screen.getByRole("status")).toHaveTextContent(/\+38/)
    })
  })

  it("does not append 'Other' bucket twice when the user re-classifies", async () => {
    vi.mocked(getDistinctValues).mockResolvedValue({
      field: "category",
      count: 3,
      values: ["a", "b", "c"],
    })

    const onCategoriesChange = vi.fn()
    render(
      <CategorizedEditor
        geom="polygon"
        fields={ANY_FIELDS}
        datasetId="ds-1"
        layerName="parcels"
        classField="category"
        categories={[]}
        onFieldChange={vi.fn()}
        onCategoriesChange={onCategoriesChange}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /fetch distinct/i }))

    await waitFor(() => {
      expect(onCategoriesChange).toHaveBeenCalled()
    })
    const cats = onCategoriesChange.mock.calls[0][0] as CategoryEntry[]
    const otherCount = cats.filter((c) => c.value === null).length
    expect(otherCount).toBe(1)
  })
})

// ───────────────────────────────────────────────────────────────────────
// BlendModeEditor — issue #27
// ───────────────────────────────────────────────────────────────────────

describe("BlendModeEditor (#27)", () => {
  it("renders all 12 blend mode options", () => {
    render(<BlendModeEditor blendMode={undefined} onChange={vi.fn()} />)
    const select = screen.getByRole("combobox")
    expect(select.children).toHaveLength(BLEND_MODES.length)
    expect(BLEND_MODES.length).toBe(12)
  })

  it("emits onChange(undefined) when user selects 'normal' (the default)", () => {
    const onChange = vi.fn()
    render(<BlendModeEditor blendMode="multiply" onChange={onChange} />)
    const select = screen.getByRole("combobox") as HTMLSelectElement
    fireEvent.change(select, { target: { value: "normal" } })
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it("emits onChange with the blend keyword for non-normal selections", () => {
    const onChange = vi.fn()
    render(<BlendModeEditor blendMode={undefined} onChange={onChange} />)
    const select = screen.getByRole("combobox") as HTMLSelectElement
    fireEvent.change(select, { target: { value: "multiply" } })
    expect(onChange).toHaveBeenCalledWith("multiply")
  })
})

// ───────────────────────────────────────────────────────────────────────
// ScaleVisibility — issue #28
// ───────────────────────────────────────────────────────────────────────

describe("ScaleVisibility (#28)", () => {
  it("disables 'Zoom to layer extent' when bbox is missing", () => {
    render(
      <ScaleVisibility
        minZoom={undefined}
        maxZoom={undefined}
        bbox={undefined}
        onChange={vi.fn()}
      />,
    )
    const btn = screen.getByRole("button", { name: /zoom/i })
    expect(btn).toBeDisabled()
  })

  it("disables zoom-to-extent for a degenerate (zero-area) bbox", () => {
    render(
      <ScaleVisibility
        minZoom={undefined}
        maxZoom={undefined}
        bbox={[0, 0, 0, 0]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: /zoom/i })).toBeDisabled()
  })

  it("calls mapStore.zoomToExtent with the layer bbox when clicked", () => {
    const fakeMap = {
      fitBounds: vi.fn(),
      flyTo: vi.fn(),
    } as unknown as Parameters<typeof useMapStore.getState>[0] extends never ? never : never
    // Inject a fake map directly so zoomToExtent can call fitBounds.
    useMapStore.setState({ map: fakeMap as never })

    render(
      <ScaleVisibility
        minZoom={undefined}
        maxZoom={undefined}
        bbox={[10, 20, 30, 40]}
        onChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /zoom/i }))
    expect((fakeMap as unknown as { fitBounds: ReturnType<typeof vi.fn> }).fitBounds)
      .toHaveBeenCalledWith([[10, 20], [30, 40]], { padding: 50 })

    // Clean up
    useMapStore.setState({ map: null })
  })

  it("clamps min/max sliders to maintain min <= max", () => {
    const onChange = vi.fn()
    render(
      <ScaleVisibility
        minZoom={5}
        maxZoom={10}
        bbox={[10, 20, 30, 40]}
        onChange={onChange}
      />,
    )
    // Drag minZoom to 15 (above maxZoom=10) — handler should clamp to 10
    const sliders = screen.getAllByRole("slider")
    fireEvent.change(sliders[0], { target: { value: "15" } })
    expect(onChange).toHaveBeenLastCalledWith(10, 10)
  })
})
