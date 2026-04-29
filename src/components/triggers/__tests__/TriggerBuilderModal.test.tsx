/**
 * Component tests for TriggerBuilderModal — closes the last leaf in
 * audit P1 #8 / issue #3 (and the orchestrator pair with
 * TriggerBuilderInline #18).
 *
 * Strategy : mock the two orchestration hooks (`useTriggerForm`,
 * `useTriggerStepper`) so we can drive the modal into specific states
 * (open / closed, first / last step, dirty / clean, editing / new)
 * without seeding the underlying stores. The 6 step subcomponents are
 * stubbed too — their rendering is irrelevant for the modal-shell
 * tests, and they pull in even more context (zustand + sonner +
 * api/client).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { TriggerType } from "@/types/editor"

// vi.mock calls hoisted to module top — must come before component
// import. We provide a factory so each test can swap the return
// values via vi.mocked(...).mockReturnValue(...).
vi.mock("@/components/triggers/hooks/useTriggerForm", () => ({
  useTriggerForm: vi.fn(),
}))
vi.mock("@/components/triggers/hooks/useTriggerStepper", () => ({
  useTriggerStepper: vi.fn(),
}))

// Stub the 6 step subcomponents — their internal rendering is out of
// scope (covered by the leaf PRs : ActionEditor, PredicateBuilder, etc.).
vi.mock("../steps/StepIdentity", () => ({
  StepIdentity: () => <div data-testid="step-identity">Identity step</div>,
}))
vi.mock("../steps/StepTypeConfig", () => ({
  StepTypeConfig: () => <div data-testid="step-config">Config step</div>,
}))
vi.mock("../steps/StepSpatialOps", () => ({
  StepSpatialOps: () => <div data-testid="step-spatial">Spatial step</div>,
}))
vi.mock("../steps/StepConditions", () => ({
  StepConditions: () => <div data-testid="step-conditions">Conditions step</div>,
}))
vi.mock("../steps/StepActions", () => ({
  StepActions: () => <div data-testid="step-actions">Actions step</div>,
}))
vi.mock("../steps/StepReview", () => ({
  StepReview: () => <div data-testid="step-review">Review step</div>,
}))

import { TriggerBuilderModal } from "../TriggerBuilderModal"
import { useTriggerForm } from "@/components/triggers/hooks/useTriggerForm"
import { useTriggerStepper } from "@/components/triggers/hooks/useTriggerStepper"

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

interface FormOverrides {
  isEditing?: boolean
  triggerBuilderOpen?: boolean
  closeTriggerBuilder?: () => void
  name?: string
  severity?: "info" | "warning" | "error" | "critical"
  setSeverity?: (s: string) => void
  triggerType?: TriggerType
  predicates?: { predicates: unknown[] }
  actions?: unknown[]
  operations?: unknown[]
  saving?: boolean
  canSave?: boolean
  handleSave?: () => void | Promise<void>
}

function makeForm(overrides: FormOverrides = {}) {
  return {
    isEditing: false,
    triggerBuilderOpen: true,
    closeTriggerBuilder: vi.fn(),
    name: "My Trigger",
    severity: "info",
    setSeverity: vi.fn(),
    triggerType: "dml" as TriggerType,
    predicates: { predicates: [] },
    actions: [],
    operations: [],
    saving: false,
    canSave: true,
    handleSave: vi.fn(),
    ...overrides,
  }
}

interface StepperOverrides {
  steps?: { id: string; label: string; visible: boolean }[]
  activeStep?: number
  currentStep?: { id: string; label: string }
  isFirst?: boolean
  isLast?: boolean
  goNext?: () => void
  goPrev?: () => void
  goTo?: (idx: number) => void
  reset?: () => void
}

function makeStepper(overrides: StepperOverrides = {}) {
  const steps = overrides.steps ?? [
    { id: "identity", label: "Identity", visible: true },
    { id: "config", label: "Config", visible: true },
    { id: "spatial", label: "Spatial", visible: true },
    { id: "conditions", label: "Conditions", visible: true },
    { id: "actions", label: "Actions", visible: true },
    { id: "review", label: "Review", visible: true },
  ]
  const activeStep = overrides.activeStep ?? 0
  const currentStep = overrides.currentStep ?? steps[activeStep]!
  return {
    steps,
    activeStep,
    currentStep,
    isFirst: overrides.isFirst ?? activeStep === 0,
    isLast: overrides.isLast ?? activeStep === steps.length - 1,
    goNext: overrides.goNext ?? vi.fn(),
    goPrev: overrides.goPrev ?? vi.fn(),
    goTo: overrides.goTo ?? vi.fn(),
    reset: overrides.reset ?? vi.fn(),
  }
}

function setMocks(
  formOverrides: FormOverrides = {},
  stepperOverrides: StepperOverrides = {},
) {
  const form = makeForm(formOverrides)
  const stepper = makeStepper(stepperOverrides)
  vi.mocked(useTriggerForm).mockReturnValue(form as never)
  vi.mocked(useTriggerStepper).mockReturnValue(stepper as never)
  return { form, stepper }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("TriggerBuilderModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  it("returns null when triggerBuilderOpen is false", () => {
    setMocks({ triggerBuilderOpen: false })
    const { container } = render(<TriggerBuilderModal />)
    expect(container.firstChild).toBeNull()
  })

  it("renders the dialog when triggerBuilderOpen is true", () => {
    setMocks()
    render(<TriggerBuilderModal />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Header — title + name + close
  // -------------------------------------------------------------------------

  it("shows 'New Trigger' title in create mode", () => {
    setMocks({ isEditing: false })
    render(<TriggerBuilderModal />)
    expect(screen.getByRole("heading", { name: "New Trigger" })).toBeInTheDocument()
  })

  it("shows 'Edit Trigger' title in edit mode", () => {
    setMocks({ isEditing: true })
    render(<TriggerBuilderModal />)
    expect(screen.getByRole("heading", { name: "Edit Trigger" })).toBeInTheDocument()
  })

  it("renders the trigger name as a subtitle when set", () => {
    setMocks({ name: "Audit Parcels" })
    render(<TriggerBuilderModal />)
    expect(screen.getByText("Audit Parcels")).toBeInTheDocument()
  })

  it("hides the name subtitle when name is empty", () => {
    setMocks({ name: "" })
    render(<TriggerBuilderModal />)
    // No subtitle renders for an empty name
    const dialog = screen.getByRole("dialog")
    expect(dialog.querySelectorAll("p.truncate")).toHaveLength(0)
  })

  it("close button (X) calls closeTriggerBuilder", () => {
    const closeTriggerBuilder = vi.fn()
    setMocks({ closeTriggerBuilder })
    render(<TriggerBuilderModal />)
    fireEvent.click(screen.getByRole("button", { name: /close/i }))
    expect(closeTriggerBuilder).toHaveBeenCalledOnce()
  })

  it("backdrop click calls closeTriggerBuilder", () => {
    const closeTriggerBuilder = vi.fn()
    setMocks({ closeTriggerBuilder })
    const { container } = render(<TriggerBuilderModal />)
    const backdrop = container.querySelector('[aria-hidden="true"]')
    expect(backdrop).toBeTruthy()
    fireEvent.click(backdrop!)
    expect(closeTriggerBuilder).toHaveBeenCalledOnce()
  })

  // -------------------------------------------------------------------------
  // Severity selector
  // -------------------------------------------------------------------------

  it("renders all 4 severity buttons", () => {
    setMocks()
    render(<TriggerBuilderModal />)
    expect(screen.getByRole("button", { name: /info/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /warning/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /error/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /critical/i })).toBeInTheDocument()
  })

  it("highlights the active severity with the bg color class", () => {
    setMocks({ severity: "warning" })
    render(<TriggerBuilderModal />)
    const warningBtn = screen.getByRole("button", { name: /warning/i })
    expect(warningBtn.className).toContain("bg-amber-500")
  })

  it("clicking a severity calls setSeverity", () => {
    const setSeverity = vi.fn()
    setMocks({ setSeverity })
    render(<TriggerBuilderModal />)
    fireEvent.click(screen.getByRole("button", { name: /critical/i }))
    expect(setSeverity).toHaveBeenCalledWith("critical")
  })

  // -------------------------------------------------------------------------
  // Stepper bar
  // -------------------------------------------------------------------------

  it("renders all visible step buttons in the stepper", () => {
    setMocks()
    render(<TriggerBuilderModal />)
    expect(screen.getByRole("button", { name: /identity/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /config/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /review/i })).toBeInTheDocument()
  })

  it("clicking a step button calls goTo with its index", () => {
    const goTo = vi.fn()
    setMocks({}, { goTo })
    render(<TriggerBuilderModal />)
    fireEvent.click(screen.getByRole("button", { name: /spatial/i }))
    // Spatial is step index 2 in the default 6-step layout.
    expect(goTo).toHaveBeenCalledWith(2)
  })

  it("conditions step button shows a count badge when predicates are present", () => {
    setMocks(
      {
        predicates: {
          predicates: [
            { type: "attr" },
            { type: "attr" },
            { type: "attr" },
          ],
        },
      },
      { activeStep: 0 },
    )
    render(<TriggerBuilderModal />)
    const condBtn = screen.getByRole("button", { name: /conditions/i })
    // The badge shows the count "3" inside the conditions button
    expect(condBtn.textContent).toContain("3")
  })

  it("actions step button shows a count badge when actions are present", () => {
    setMocks({ actions: [{ type: "notify" }, { type: "webhook" }] })
    render(<TriggerBuilderModal />)
    const actBtn = screen.getByRole("button", { name: /actions/i })
    expect(actBtn.textContent).toContain("2")
  })

  it("spatial step button shows a count badge when operations are present", () => {
    setMocks({ operations: [{ operation: "st_within" }] })
    render(<TriggerBuilderModal />)
    const spatialBtn = screen.getByRole("button", { name: /spatial/i })
    expect(spatialBtn.textContent).toContain("1")
  })

  // -------------------------------------------------------------------------
  // Step content rendering
  // -------------------------------------------------------------------------

  it("renders the active step's component (identity step)", () => {
    setMocks({}, { activeStep: 0, currentStep: { id: "identity", label: "Identity" } })
    render(<TriggerBuilderModal />)
    expect(screen.getByTestId("step-identity")).toBeInTheDocument()
    expect(screen.queryByTestId("step-review")).not.toBeInTheDocument()
  })

  it("renders the review step when activeStep points to review", () => {
    setMocks(
      {},
      {
        activeStep: 5,
        currentStep: { id: "review", label: "Review" },
        isFirst: false,
        isLast: true,
      },
    )
    render(<TriggerBuilderModal />)
    expect(screen.getByTestId("step-review")).toBeInTheDocument()
    expect(screen.queryByTestId("step-identity")).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Footer navigation
  // -------------------------------------------------------------------------

  it("hides the Previous button on the first step", () => {
    setMocks({}, { isFirst: true, isLast: false })
    render(<TriggerBuilderModal />)
    expect(screen.queryByRole("button", { name: /previous/i })).not.toBeInTheDocument()
  })

  it("shows Previous button on non-first steps and calls goPrev", () => {
    const goPrev = vi.fn()
    setMocks({}, { isFirst: false, isLast: false, goPrev, activeStep: 2 })
    render(<TriggerBuilderModal />)
    fireEvent.click(screen.getByRole("button", { name: /previous/i }))
    expect(goPrev).toHaveBeenCalledOnce()
  })

  it("shows Next button on non-last steps and calls goNext", () => {
    const goNext = vi.fn()
    setMocks({}, { isFirst: false, isLast: false, goNext, activeStep: 2 })
    render(<TriggerBuilderModal />)
    fireEvent.click(screen.getByRole("button", { name: /next/i }))
    expect(goNext).toHaveBeenCalledOnce()
  })

  it("on the last step shows 'Create' instead of Next, and calls handleSave", () => {
    const handleSave = vi.fn()
    setMocks(
      { isEditing: false, handleSave, canSave: true },
      { isFirst: false, isLast: true, activeStep: 5 },
    )
    render(<TriggerBuilderModal />)
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /create/i }))
    expect(handleSave).toHaveBeenCalledOnce()
  })

  it("on the last step in edit mode shows 'Update' label", () => {
    setMocks({ isEditing: true }, { isFirst: false, isLast: true, activeStep: 5 })
    render(<TriggerBuilderModal />)
    expect(screen.getByRole("button", { name: /update/i })).toBeInTheDocument()
  })

  it("save button is disabled when canSave is false", () => {
    setMocks(
      { canSave: false },
      { isFirst: false, isLast: true, activeStep: 5 },
    )
    render(<TriggerBuilderModal />)
    const create = screen.getByRole("button", { name: /create/i })
    expect(create).toBeDisabled()
  })

  it("save button shows 'Saving...' when saving is true", () => {
    setMocks(
      { saving: true, canSave: true },
      { isFirst: false, isLast: true, activeStep: 5 },
    )
    render(<TriggerBuilderModal />)
    expect(screen.getByRole("button", { name: /saving/i })).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Cancel button
  // -------------------------------------------------------------------------

  it("Cancel button calls closeTriggerBuilder", () => {
    const closeTriggerBuilder = vi.fn()
    setMocks({ closeTriggerBuilder })
    render(<TriggerBuilderModal />)
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }))
    expect(closeTriggerBuilder).toHaveBeenCalledOnce()
  })

  it("Cancel button is disabled while saving", () => {
    setMocks({ saving: true })
    render(<TriggerBuilderModal />)
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Footer summary chips
  // -------------------------------------------------------------------------

  it("footer summary shows the trigger type label", () => {
    setMocks({ triggerType: "dml" })
    render(<TriggerBuilderModal />)
    // 'dml' is the value, label in TRIGGER_TYPES is 'DML'
    expect(screen.getByText("DML")).toBeInTheDocument()
  })

  it("footer summary shows operation count with correct pluralization", () => {
    const { rerender } = render(<TriggerBuilderModal />)
    setMocks({ operations: [{}] })
    rerender(<TriggerBuilderModal />)
    expect(screen.getByText("1 op")).toBeInTheDocument()

    setMocks({ operations: [{}, {}, {}] })
    rerender(<TriggerBuilderModal />)
    expect(screen.getByText("3 ops")).toBeInTheDocument()
  })

  it("footer summary shows condition count with correct pluralization", () => {
    setMocks({ predicates: { predicates: [{}, {}] } })
    render(<TriggerBuilderModal />)
    expect(screen.getByText("2 conditions")).toBeInTheDocument()
  })

  it("footer summary shows action count (singular form)", () => {
    setMocks({ actions: [{ type: "notify" }] })
    render(<TriggerBuilderModal />)
    expect(screen.getByText("1 action")).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Keyboard handlers (ESC + Ctrl+Enter)
  // -------------------------------------------------------------------------

  it("Escape key closes the modal", () => {
    const closeTriggerBuilder = vi.fn()
    setMocks({ closeTriggerBuilder })
    render(<TriggerBuilderModal />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(closeTriggerBuilder).toHaveBeenCalledOnce()
  })

  it("Ctrl+Enter on the last step with canSave triggers handleSave", () => {
    const handleSave = vi.fn()
    setMocks(
      { handleSave, canSave: true },
      { isFirst: false, isLast: true, activeStep: 5 },
    )
    render(<TriggerBuilderModal />)
    fireEvent.keyDown(document, { key: "Enter", ctrlKey: true })
    expect(handleSave).toHaveBeenCalledOnce()
  })

  it("Ctrl+Enter on a non-last step does NOT save", () => {
    const handleSave = vi.fn()
    setMocks(
      { handleSave, canSave: true },
      { isFirst: false, isLast: false, activeStep: 2 },
    )
    render(<TriggerBuilderModal />)
    fireEvent.keyDown(document, { key: "Enter", ctrlKey: true })
    expect(handleSave).not.toHaveBeenCalled()
  })

  it("Ctrl+Enter when canSave is false does NOT save", () => {
    const handleSave = vi.fn()
    setMocks(
      { handleSave, canSave: false },
      { isFirst: false, isLast: true, activeStep: 5 },
    )
    render(<TriggerBuilderModal />)
    fireEvent.keyDown(document, { key: "Enter", ctrlKey: true })
    expect(handleSave).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // a11y attributes
  // -------------------------------------------------------------------------

  it("dialog has role='dialog' + aria-modal + aria-labelledby", () => {
    setMocks()
    render(<TriggerBuilderModal />)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAttribute("aria-labelledby", "trigger-builder-title")
  })

  // -------------------------------------------------------------------------
  // Stepper reset on re-open
  // -------------------------------------------------------------------------

  it("calls stepper.reset when the modal opens (so re-opening starts at step 1)", () => {
    const reset = vi.fn()
    setMocks({ triggerBuilderOpen: true }, { reset })
    render(<TriggerBuilderModal />)
    expect(reset).toHaveBeenCalledOnce()
  })
})
