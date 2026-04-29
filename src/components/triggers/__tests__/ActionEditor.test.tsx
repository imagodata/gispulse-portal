/**
 * Component tests for ActionEditor — covers the conditional render
 * forks across all 14 action types + the onChange/onRemove contract.
 *
 * Pattern follows CronBuilder.test.tsx + SchemaForm.test.tsx :
 * fully prop-driven component, no zustand or react-query mocks.
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ActionEditor } from "../ActionEditor"
import type { TriggerAction } from "@/types/editor"

function harness(action: TriggerAction) {
  const onChange = vi.fn<(action: TriggerAction) => void>()
  const onRemove = vi.fn<() => void>()
  const view = render(<ActionEditor action={action} onChange={onChange} onRemove={onRemove} />)
  return { onChange, onRemove, ...view }
}

// ---------------------------------------------------------------------------
// Header (badge + category + remove)
// ---------------------------------------------------------------------------

describe("ActionEditor — header", () => {
  it("shows the action label from ACTION_TYPES taxonomy", () => {
    harness({ type: "webhook", config: {} })
    expect(screen.getByText("Webhook")).toBeInTheDocument()
  })

  it("shows the action category in muted text", () => {
    harness({ type: "webhook", config: {} })
    expect(screen.getByText("external")).toBeInTheDocument()
  })

  it("falls back to action.type when the type is not in the taxonomy", () => {
    // @ts-expect-error — testing the unknown-type fallback path
    harness({ type: "ghost_action", config: {} })
    expect(screen.getByText("ghost_action")).toBeInTheDocument()
  })

  it("calls onRemove when the trash button is clicked", () => {
    const { onRemove } = harness({ type: "notify", config: {} })
    fireEvent.click(screen.getByTitle("Remove action"))
    expect(onRemove).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Per-type rendering (each branch in the if-tree)
// ---------------------------------------------------------------------------

describe("ActionEditor — type-specific inputs", () => {
  it("notify: renders message + channel inputs", () => {
    harness({ type: "notify", config: { message: "hi", channel: "alerts" } })
    expect(screen.getByPlaceholderText("Notification message")).toHaveValue("hi")
    expect(screen.getByPlaceholderText("Channel (optional)")).toHaveValue("alerts")
  })

  it("set_field: renders field + value inputs", () => {
    harness({ type: "set_field", config: { field: "status", value: "AUDIT" } })
    expect(screen.getByPlaceholderText("Field name")).toHaveValue("status")
    expect(screen.getByPlaceholderText("Value")).toHaveValue("AUDIT")
  })

  it("flag_feature: renders flag_field input + flag_value select with 3 options", () => {
    harness({ type: "flag_feature", config: { flag_field: "status", flag_value: "warning" } })
    expect(screen.getByPlaceholderText("Flag field name")).toHaveValue("status")
    const select = screen.getByRole("combobox") as HTMLSelectElement
    expect(select).toHaveValue("warning")
    expect(screen.getByRole("option", { name: "Violation" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Warning" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Needs Review" })).toBeInTheDocument()
  })

  it("run_job: renders job_name + dataset_id inputs", () => {
    harness({ type: "run_job", config: { job_name: "buffer", dataset_id: "ds-1" } })
    expect(screen.getByPlaceholderText("Job name / capability")).toHaveValue("buffer")
    expect(screen.getByPlaceholderText("Dataset ID (optional)")).toHaveValue("ds-1")
  })

  it("run_graph: renders scenario_id input", () => {
    harness({ type: "run_graph", config: { scenario_id: "s-42" } })
    expect(screen.getByPlaceholderText("Scenario ID")).toHaveValue("s-42")
  })

  it("run_sql: renders SQL textarea", () => {
    harness({ type: "run_sql", config: { sql: "SELECT 1" } })
    const ta = screen.getByPlaceholderText("SELECT ... or UPDATE ...") as HTMLTextAreaElement
    expect(ta.tagName).toBe("TEXTAREA")
    expect(ta.value).toBe("SELECT 1")
  })

  it("webhook: renders url input + method select (POST/PUT/PATCH)", () => {
    harness({ type: "webhook", config: { url: "https://e.com/h", method: "PUT" } })
    expect(screen.getByPlaceholderText("https://example.com/hook")).toHaveValue("https://e.com/h")
    const select = screen.getByRole("combobox") as HTMLSelectElement
    expect(select).toHaveValue("PUT")
  })

  it("log_event: renders message input only", () => {
    harness({ type: "log_event", config: { message: "audit row" } })
    expect(screen.getByPlaceholderText("Log message template")).toHaveValue("audit row")
  })

  it("send_email: renders to + subject + body inputs", () => {
    harness({
      type: "send_email",
      config: { to: "a@b.com", subject: "S", body: "B" },
    })
    expect(screen.getByPlaceholderText("recipient@example.com")).toHaveValue("a@b.com")
    expect(screen.getByPlaceholderText("Subject")).toHaveValue("S")
    expect(screen.getByPlaceholderText("Body template")).toHaveValue("B")
  })

  it("approve: renders reason input", () => {
    harness({ type: "approve", config: { reason: "OK" } })
    expect(screen.getByPlaceholderText("Reason / comment")).toHaveValue("OK")
  })

  it("reject: renders reason input (same as approve)", () => {
    harness({ type: "reject", config: { reason: "denied" } })
    expect(screen.getByPlaceholderText("Reason / comment")).toHaveValue("denied")
  })

  it("block_commit: renders block message input", () => {
    harness({ type: "block_commit", config: { message: "Forbidden" } })
    expect(screen.getByPlaceholderText("Block message shown to user")).toHaveValue("Forbidden")
  })

  it("update_aggregate: renders 2 inputs + aggregate_fn select with 5 options", () => {
    harness({
      type: "update_aggregate",
      config: { target_table: "stats", aggregate_field: "n", aggregate_fn: "sum" },
    })
    expect(screen.getByPlaceholderText("Target table")).toHaveValue("stats")
    expect(screen.getByPlaceholderText("Aggregate field")).toHaveValue("n")
    const select = screen.getByRole("combobox") as HTMLSelectElement
    expect(select).toHaveValue("sum")
    for (const fn of ["COUNT", "SUM", "AVG", "MIN", "MAX"]) {
      expect(screen.getByRole("option", { name: fn })).toBeInTheDocument()
    }
  })

  it("enqueue: renders queue + payload_template inputs", () => {
    harness({
      type: "enqueue",
      config: { queue: "etl", payload_template: '{"id": $fid}' },
    })
    expect(screen.getByPlaceholderText("Queue name")).toHaveValue("etl")
    expect(screen.getByPlaceholderText("Payload template (JSON)")).toHaveValue('{"id": $fid}')
  })
})

// ---------------------------------------------------------------------------
// onChange contract — config patch shape
// ---------------------------------------------------------------------------

describe("ActionEditor — onChange config patches", () => {
  it("emits onChange with the updated config field, preserving other config keys", () => {
    const { onChange } = harness({
      type: "webhook",
      config: { url: "https://old.com", method: "POST", retries: 3 },
    })
    fireEvent.change(screen.getByPlaceholderText("https://example.com/hook"), {
      target: { value: "https://new.com" },
    })
    expect(onChange).toHaveBeenLastCalledWith({
      type: "webhook",
      config: { url: "https://new.com", method: "POST", retries: 3 },
    })
  })

  it("preserves the action type across config edits", () => {
    const { onChange } = harness({ type: "notify", config: { message: "" } })
    fireEvent.change(screen.getByPlaceholderText("Notification message"), {
      target: { value: "alert" },
    })
    expect(onChange.mock.calls[0]?.[0].type).toBe("notify")
  })

  it("emits the right key for select changes (webhook method)", () => {
    const { onChange } = harness({
      type: "webhook",
      config: { url: "https://e.com", method: "POST" },
    })
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "PATCH" } })
    expect(onChange).toHaveBeenLastCalledWith({
      type: "webhook",
      config: { url: "https://e.com", method: "PATCH" },
    })
  })
})
