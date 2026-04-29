/**
 * Component tests for TriggerBuilderInline — first orchestrator test
 * exercising the helpers from PR #16 (renderWithProviders +
 * setupStoreReset) and the README's vi.mock("sonner") pattern.
 *
 * What's covered:
 * - Missing trigger : the "Trigger not found" placeholder.
 * - Header : trigger name, enabled badge.
 * - Identity / Type / Conditions / Spatial Ops / Actions / Review
 *   collapsible sections render with the right counts and content.
 * - Field edits update local state but mark the form dirty (Save
 *   button enabled, "Unsaved changes" banner).
 * - Triggers with conditional content : "On Schedule" shows Cron,
 *   "On Threshold" shows Expression, "On DML" shows Event.
 * - Save handler : empty name → toast.error + no updateTrigger call.
 * - Save handler : happy path → updateTrigger called with merged
 *   payload + toast.success.
 * - Save handler : updateTrigger rejects → toast.error with the
 *   formatted message + saving state cleared.
 * - "Full editor" button calls openTriggerBuilder(triggerId).
 *
 * Validation of the test infra : if the helpers from PR #16 work as
 * advertised, this file should pass without any new mocking
 * boilerplate beyond the documented patterns.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// vi.mock("sonner") MUST be at file top (Vitest hoists it before the
// component import so the toast spies replace the real implementation
// before the component module is evaluated).
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  },
}))

import { toast } from "sonner"
import { TriggerBuilderInline } from "../TriggerBuilderInline"
import { useProjectStore } from "@/stores/projectStore"
import { useEditorStore } from "@/stores/editorStore"
import { setupStoreReset } from "@/__tests__/helpers/zustand"
import type { Trigger } from "@/types/project"

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function makeTrigger(overrides: Partial<Trigger> = {}): Trigger {
  return {
    id: "trig-1",
    name: "My Trigger",
    event: "INSERT",
    trigger_type: "On DML",
    rule_id: null,
    conditions: { table: "parcels" },
    enabled: true,
    severity: "info",
    ...overrides,
  }
}

function seedTrigger(t: Trigger) {
  useProjectStore.setState({ triggers: [t] })
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("TriggerBuilderInline", () => {
  // Reset both stores between tests so seeded triggers / open state
  // don't leak. This is what audit P1 #8 was waiting on — the helper
  // infra from PR #16 makes orchestrator tests possible without
  // re-implementing snapshot/restore in every file.
  setupStoreReset(useProjectStore, useEditorStore)

  beforeEach(() => {
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
  })

  // ---------------------------------------------------------------------------
  // Missing trigger fallback
  // ---------------------------------------------------------------------------

  it("renders a 'Trigger not found' placeholder when the id is unknown", () => {
    render(<TriggerBuilderInline triggerId="ghost-id" />)
    expect(screen.getByText(/trigger not found/i)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  it("renders the trigger name in the header", () => {
    seedTrigger(makeTrigger({ name: "Audit New Parcels" }))
    render(<TriggerBuilderInline triggerId="trig-1" />)
    expect(screen.getByRole("heading", { name: "Audit New Parcels" })).toBeInTheDocument()
  })

  it("shows the 'on' enabled badge for enabled triggers", () => {
    seedTrigger(makeTrigger({ enabled: true }))
    render(<TriggerBuilderInline triggerId="trig-1" />)
    expect(screen.getByText("on")).toBeInTheDocument()
  })

  it("shows the 'off' enabled badge for disabled triggers", () => {
    seedTrigger(makeTrigger({ enabled: false }))
    render(<TriggerBuilderInline triggerId="trig-1" />)
    expect(screen.getByText("off")).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Identity section
  // ---------------------------------------------------------------------------

  it("populates the Name input from the trigger", () => {
    seedTrigger(makeTrigger({ name: "InitialName" }))
    render(<TriggerBuilderInline triggerId="trig-1" />)
    expect(screen.getByPlaceholderText("Trigger name")).toHaveValue("InitialName")
  })

  it("populates the Severity select from the trigger", () => {
    seedTrigger(makeTrigger({ severity: "warning" }))
    render(<TriggerBuilderInline triggerId="trig-1" />)
    const sev = screen
      .getAllByRole("combobox")
      .find((el) => (el as HTMLSelectElement).value === "warning")
    expect(sev).toBeTruthy()
  })

  // ---------------------------------------------------------------------------
  // Type section — conditional fields
  // ---------------------------------------------------------------------------

  it("On DML : shows the Event select", () => {
    seedTrigger(makeTrigger({ trigger_type: "On DML", event: "UPDATE" }))
    render(<TriggerBuilderInline triggerId="trig-1" />)
    const ev = screen
      .getAllByRole("combobox")
      .find((el) => (el as HTMLSelectElement).value === "UPDATE")
    expect(ev).toBeTruthy()
  })

  it("On Schedule : shows the Cron input instead of Event", () => {
    seedTrigger(
      makeTrigger({
        trigger_type: "On Schedule",
        conditions: { table: "x", cron: "*/5 * * * *" },
      }),
    )
    render(<TriggerBuilderInline triggerId="trig-1" />)
    expect(screen.getByPlaceholderText("*/5 * * * *")).toHaveValue("*/5 * * * *")
  })

  it("On Threshold : shows the Expression input", () => {
    seedTrigger(
      makeTrigger({
        trigger_type: "On Threshold",
        conditions: { table: "x", threshold: "count > 100" },
      }),
    )
    render(<TriggerBuilderInline triggerId="trig-1" />)
    expect(screen.getByPlaceholderText("count > 100")).toHaveValue("count > 100")
  })

  // ---------------------------------------------------------------------------
  // Conditions / Spatial Ops / Actions section badges
  // ---------------------------------------------------------------------------

  it("Conditions badge counts the predicates", () => {
    seedTrigger(
      makeTrigger({
        conditions: {
          table: "x",
          predicates: {
            predicates: [
              { type: "attr", field: "a", op: "eq", value: 1 },
              { type: "attr", field: "b", op: "eq", value: 2 },
              { type: "attr", field: "c", op: "eq", value: 3 },
            ],
          },
        },
      }),
    )
    render(<TriggerBuilderInline triggerId="trig-1" />)
    // Conditions section header has the count badge.
    const badge = screen.getByText("3")
    expect(badge).toBeInTheDocument()
  })

  it("Spatial Ops badge counts operations", () => {
    seedTrigger(
      makeTrigger({
        conditions: {
          table: "x",
          operations: [
            { operation: "ST_Within", phase: "before" },
            { operation: "ST_Buffer", phase: "after" },
          ],
        },
      }),
    )
    render(<TriggerBuilderInline triggerId="trig-1" />)
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("Actions section shows 'No actions configured.' when empty", () => {
    seedTrigger(makeTrigger())
    render(<TriggerBuilderInline triggerId="trig-1" />)
    // The Actions panel is collapsed by default, expand it.
    fireEvent.click(screen.getByRole("button", { name: /actions/i }))
    expect(screen.getByText("No actions configured.")).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Dirty state
  // ---------------------------------------------------------------------------

  it("does not show 'Unsaved changes' when nothing was edited", () => {
    seedTrigger(makeTrigger())
    render(<TriggerBuilderInline triggerId="trig-1" />)
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
  })

  it("shows 'Unsaved changes' once the Name is edited", () => {
    seedTrigger(makeTrigger({ name: "Original" }))
    render(<TriggerBuilderInline triggerId="trig-1" />)
    fireEvent.change(screen.getByPlaceholderText("Trigger name"), {
      target: { value: "Edited" },
    })
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
  })

  it("disables the Save button when the form is pristine", () => {
    seedTrigger(makeTrigger())
    render(<TriggerBuilderInline triggerId="trig-1" />)
    const save = screen.getByRole("button", { name: /save/i })
    expect(save).toBeDisabled()
  })

  it("enables the Save button when the form is dirty", () => {
    seedTrigger(makeTrigger({ name: "Original" }))
    render(<TriggerBuilderInline triggerId="trig-1" />)
    fireEvent.change(screen.getByPlaceholderText("Trigger name"), {
      target: { value: "Edited" },
    })
    expect(screen.getByRole("button", { name: /save/i })).toBeEnabled()
  })

  // ---------------------------------------------------------------------------
  // Save handler
  // ---------------------------------------------------------------------------

  it("Save with an empty name toasts an error and does NOT call updateTrigger", async () => {
    const updateTrigger = vi.fn<typeof useProjectStore.getState.prototype.updateTrigger>()
    seedTrigger(makeTrigger({ name: "Original" }))
    useProjectStore.setState({ updateTrigger })

    render(<TriggerBuilderInline triggerId="trig-1" />)
    fireEvent.change(screen.getByPlaceholderText("Trigger name"), {
      target: { value: "   " }, // whitespace-only ⇒ trim to empty
    })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Name is required.")
    })
    expect(updateTrigger).not.toHaveBeenCalled()
  })

  it("Save happy path : calls updateTrigger with the trimmed name and toasts success", async () => {
    const updateTrigger = vi
      .fn()
      .mockResolvedValue(undefined)
    seedTrigger(makeTrigger({ name: "Original" }))
    useProjectStore.setState({ updateTrigger })

    render(<TriggerBuilderInline triggerId="trig-1" />)
    fireEvent.change(screen.getByPlaceholderText("Trigger name"), {
      target: { value: "New Name" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(updateTrigger).toHaveBeenCalledOnce()
    })
    const [id, payload] = updateTrigger.mock.calls[0]!
    expect(id).toBe("trig-1")
    expect(payload.name).toBe("New Name")
    expect(payload.trigger_type).toBe("On DML")
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Trigger "New Name" saved')
  })

  it("Save with surrounding whitespace : payload is trimmed but the success toast quotes the raw input (existing UX quirk)", async () => {
    // Documents — does not endorse — the current behaviour : the toast
    // string interpolates `name` (un-trimmed local state) while the
    // updateTrigger payload uses `name.trim()`. Worth a tiny follow-up
    // fix to align the two ; until then, this test pins the contract.
    const updateTrigger = vi.fn().mockResolvedValue(undefined)
    seedTrigger(makeTrigger({ name: "Original" }))
    useProjectStore.setState({ updateTrigger })

    render(<TriggerBuilderInline triggerId="trig-1" />)
    fireEvent.change(screen.getByPlaceholderText("Trigger name"), {
      target: { value: "  Padded  " },
    })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(updateTrigger).toHaveBeenCalledOnce()
    })
    expect(updateTrigger.mock.calls[0]![1].name).toBe("Padded") // payload trimmed
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Trigger "  Padded  " saved') // toast un-trimmed
  })

  it("Save with a rejected updateTrigger toasts the formatted error", async () => {
    const updateTrigger = vi
      .fn()
      .mockRejectedValue(new Error("Backend offline"))
    seedTrigger(makeTrigger({ name: "Original" }))
    useProjectStore.setState({ updateTrigger })

    render(<TriggerBuilderInline triggerId="trig-1" />)
    fireEvent.change(screen.getByPlaceholderText("Trigger name"), {
      target: { value: "Edited" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Save failed: Backend offline",
      )
    })
  })

  // ---------------------------------------------------------------------------
  // Full editor button
  // ---------------------------------------------------------------------------

  it("'Full editor' button calls openTriggerBuilder with the trigger id", () => {
    const openTriggerBuilder = vi.fn()
    seedTrigger(makeTrigger())
    useEditorStore.setState({ openTriggerBuilder })

    render(<TriggerBuilderInline triggerId="trig-1" />)
    fireEvent.click(screen.getByRole("button", { name: /full editor/i }))
    expect(openTriggerBuilder).toHaveBeenCalledWith("trig-1")
  })
})
