/**
 * Component tests for triggers/shared.tsx — exercises the 5 utility
 * primitives reused across the Trigger Builder UI.
 *
 * Same prop-driven shape as CronBuilder / ActionEditor — no zustand,
 * no react-query, no router. Tests follow the existing pattern.
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Database } from "lucide-react"
import {
  ConfigSection,
  ToggleChip,
  ToggleSwitch,
  LayerSelect,
  LiveEvalFeed,
} from "../shared"
import type { FiredTriggerResult } from "@/types/project"

// ---------------------------------------------------------------------------
// ConfigSection
// ---------------------------------------------------------------------------

describe("ConfigSection", () => {
  it("renders title text", () => {
    render(
      <ConfigSection title="My Section" icon={Database}>
        <span>body</span>
      </ConfigSection>,
    )
    expect(screen.getByText("My Section")).toBeInTheDocument()
  })

  it("renders the children inside the section", () => {
    render(
      <ConfigSection title="X" icon={Database}>
        <span data-testid="child">hello</span>
      </ConfigSection>,
    )
    expect(screen.getByTestId("child")).toHaveTextContent("hello")
  })

  it("merges the optional className with the default classes", () => {
    const { container } = render(
      <ConfigSection title="X" icon={Database} className="my-extra">
        <span>body</span>
      </ConfigSection>,
    )
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain("rounded-lg")
    expect(root.className).toContain("my-extra")
  })
})

// ---------------------------------------------------------------------------
// ToggleChip
// ---------------------------------------------------------------------------

describe("ToggleChip", () => {
  it("renders the label", () => {
    render(<ToggleChip label="DML" active={false} onClick={() => {}} />)
    expect(screen.getByRole("button", { name: "DML" })).toBeInTheDocument()
  })

  it("applies the active class when active is true", () => {
    render(<ToggleChip label="DML" active onClick={() => {}} />)
    const btn = screen.getByRole("button", { name: "DML" })
    expect(btn.className).toContain("border-primary")
    expect(btn.className).toContain("bg-primary/10")
  })

  it("applies the muted class when active is false", () => {
    render(<ToggleChip label="DML" active={false} onClick={() => {}} />)
    const btn = screen.getByRole("button", { name: "DML" })
    expect(btn.className).toContain("border-border")
    expect(btn.className).toContain("text-muted-foreground")
  })

  it("calls onClick when clicked", () => {
    const onClick = vi.fn()
    render(<ToggleChip label="DML" active={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole("button", { name: "DML" }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// ToggleSwitch
// ---------------------------------------------------------------------------

describe("ToggleSwitch", () => {
  it("uses role='switch' and reflects the checked state via aria-checked", () => {
    const { rerender } = render(<ToggleSwitch checked={false} onChange={() => {}} />)
    const sw = screen.getByRole("switch")
    expect(sw).toHaveAttribute("aria-checked", "false")
    rerender(<ToggleSwitch checked onChange={() => {}} />)
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
  })

  it("emits onChange(true) when clicked while unchecked", () => {
    const onChange = vi.fn<(v: boolean) => void>()
    render(<ToggleSwitch checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole("switch"))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("emits onChange(false) when clicked while checked", () => {
    const onChange = vi.fn<(v: boolean) => void>()
    render(<ToggleSwitch checked onChange={onChange} />)
    fireEvent.click(screen.getByRole("switch"))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it("paints the track green when checked, muted when not", () => {
    const { rerender } = render(<ToggleSwitch checked={false} onChange={() => {}} />)
    expect(screen.getByRole("switch").className).toContain("bg-muted")
    rerender(<ToggleSwitch checked onChange={() => {}} />)
    expect(screen.getByRole("switch").className).toContain("bg-primary")
  })
})

// ---------------------------------------------------------------------------
// LayerSelect — the conditional fallback is the meaningful behaviour
// ---------------------------------------------------------------------------

describe("LayerSelect", () => {
  it("renders a <select> when layers are non-empty", () => {
    render(<LayerSelect value="" onChange={() => {}} layers={["a", "b"]} />)
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("includes the placeholder option + one entry per layer", () => {
    render(<LayerSelect value="" onChange={() => {}} layers={["alpha", "beta"]} />)
    expect(screen.getByRole("option", { name: "Select a layer..." })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "alpha" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "beta" })).toBeInTheDocument()
  })

  it("emits onChange with the picked option value", () => {
    const onChange = vi.fn<(v: string) => void>()
    render(<LayerSelect value="" onChange={onChange} layers={["alpha", "beta"]} />)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "beta" } })
    expect(onChange).toHaveBeenCalledWith("beta")
  })

  it("falls back to a free-text Input when layers list is empty", () => {
    render(<LayerSelect value="my_table" onChange={() => {}} layers={[]} />)
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("table name")).toHaveValue("my_table")
  })

  it("emits onChange from the fallback Input", () => {
    const onChange = vi.fn<(v: string) => void>()
    render(<LayerSelect value="" onChange={onChange} layers={[]} />)
    fireEvent.change(screen.getByPlaceholderText("table name"), {
      target: { value: "ad_hoc_table" },
    })
    expect(onChange).toHaveBeenCalledWith("ad_hoc_table")
  })

  it("forwards the optional id to the rendered control", () => {
    const { rerender } = render(
      <LayerSelect value="" onChange={() => {}} layers={["a"]} id="my-id" />,
    )
    expect(screen.getByRole("combobox")).toHaveAttribute("id", "my-id")
    rerender(<LayerSelect value="" onChange={() => {}} layers={[]} id="my-id" />)
    expect(screen.getByPlaceholderText("table name")).toHaveAttribute("id", "my-id")
  })
})

// ---------------------------------------------------------------------------
// LiveEvalFeed
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<FiredTriggerResult> = {}): FiredTriggerResult {
  return {
    id: "evt-1",
    trigger_id: "trig-1",
    change_record_id: null,
    matched: true,
    actions_dispatched: ["webhook"],
    eval_time_ms: 12.34,
    result_summary: { operation: "INSERT", table: "parcels" },
    cascade_depth: 0,
    fired_at: "2026-04-29T18:00:00Z",
    ...overrides,
  }
}

describe("LiveEvalFeed", () => {
  it("shows the empty placeholder when no events", () => {
    render(<LiveEvalFeed events={[]} onClear={() => {}} />)
    expect(screen.getByText(/waiting for trigger evaluations/i)).toBeInTheDocument()
  })

  it("hides the Clear button when no events", () => {
    render(<LiveEvalFeed events={[]} onClear={() => {}} />)
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument()
  })

  it("renders one row per event with operation + table from result_summary", () => {
    render(
      <LiveEvalFeed
        events={[
          makeEvent({ id: "a", result_summary: { operation: "INSERT", table: "parcels" } }),
          makeEvent({ id: "b", result_summary: { operation: "UPDATE", table: "audit" } }),
        ]}
        onClear={() => {}}
      />,
    )
    expect(screen.getByText(/INSERT\s+parcels/)).toBeInTheDocument()
    expect(screen.getByText(/UPDATE\s+audit/)).toBeInTheDocument()
  })

  it("falls back to '?' when result_summary fields are missing", () => {
    render(
      <LiveEvalFeed
        events={[makeEvent({ id: "x", result_summary: {} })]}
        onClear={() => {}}
      />,
    )
    expect(screen.getByText(/\?/)).toBeInTheDocument()
  })

  it("formats eval_time_ms to one decimal", () => {
    render(
      <LiveEvalFeed events={[makeEvent({ eval_time_ms: 12.345 })]} onClear={() => {}} />,
    )
    expect(screen.getByText(/12\.3ms/)).toBeInTheDocument()
  })

  it("paints matched events green and unmatched events muted", () => {
    const { container } = render(
      <LiveEvalFeed
        events={[
          makeEvent({ id: "m", matched: true }),
          makeEvent({ id: "u", matched: false }),
        ]}
        onClear={() => {}}
      />,
    )
    // Two event rows in the scroll container; their className mix tells us
    // which is matched vs unmatched.
    const rows = container.querySelectorAll(".max-h-40 > div")
    expect(rows.length).toBe(2)
    expect((rows[0] as HTMLElement).className).toContain("bg-green-500/10")
    expect((rows[1] as HTMLElement).className).toContain("bg-muted")
  })

  it("calls onClear when the Clear button is clicked", () => {
    const onClear = vi.fn<() => void>()
    render(<LiveEvalFeed events={[makeEvent()]} onClear={onClear} />)
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(onClear).toHaveBeenCalledOnce()
  })
})
