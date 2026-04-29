/**
 * Component tests for CronBuilder — exercises both the pure parse/build
 * cron logic and the React rendering surface. Pattern mirrors the
 * existing SchemaForm.test.tsx (testing-library/react + vitest, no
 * zustand mocking required because CronBuilder is fully prop-driven).
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CronBuilder } from "../CronBuilder"

function harness(initial = "0 * * * *") {
  const onChange = vi.fn<(cron: string) => void>()
  const view = render(<CronBuilder value={initial} onChange={onChange} />)
  return { onChange, ...view }
}

describe("CronBuilder — presets", () => {
  it("renders the four preset buttons", () => {
    harness()
    expect(screen.getByRole("button", { name: /every 15 min/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /every hour/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /every day midnight/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /every monday 8am/i })).toBeInTheDocument()
  })

  it("emits the preset cron string on click", () => {
    const { onChange } = harness("")
    fireEvent.click(screen.getByRole("button", { name: /every 15 min/i }))
    expect(onChange).toHaveBeenLastCalledWith("*/15 * * * *")

    fireEvent.click(screen.getByRole("button", { name: /every monday 8am/i }))
    expect(onChange).toHaveBeenLastCalledWith("0 8 * * 1")
  })

  it("highlights the active preset when value matches", () => {
    harness("0 0 * * *")
    const button = screen.getByRole("button", { name: /every day midnight/i })
    // The active preset gets the `border-primary` class; non-active rows
    // get `border-border`. We assert on the class to avoid hardcoding the
    // exact tailwind string.
    expect(button.className).toContain("border-primary")
  })
})

describe("CronBuilder — granular fields", () => {
  it("renders 5 labeled inputs (Min / Hour / Day / Month / Weekday)", () => {
    harness()
    expect(screen.getByLabelText("Min")).toBeInTheDocument()
    expect(screen.getByLabelText("Hour")).toBeInTheDocument()
    expect(screen.getByLabelText("Day")).toBeInTheDocument()
    expect(screen.getByLabelText("Month")).toBeInTheDocument()
    expect(screen.getByLabelText("Weekday")).toBeInTheDocument()
  })

  it("populates inputs from the current cron value", () => {
    harness("30 9 * * 1")
    expect(screen.getByLabelText("Min")).toHaveValue("30")
    expect(screen.getByLabelText("Hour")).toHaveValue("9")
    expect(screen.getByLabelText("Day")).toHaveValue("*")
    expect(screen.getByLabelText("Month")).toHaveValue("*")
    expect(screen.getByLabelText("Weekday")).toHaveValue("1")
  })

  it("emits the rebuilt cron when a single field changes", () => {
    const { onChange } = harness("0 8 * * *")
    fireEvent.change(screen.getByLabelText("Hour"), { target: { value: "14" } })
    expect(onChange).toHaveBeenLastCalledWith("0 14 * * *")
  })

  it("substitutes '*' when a field is cleared (empty string)", () => {
    const { onChange } = harness("30 9 1 6 *")
    fireEvent.change(screen.getByLabelText("Day"), { target: { value: "" } })
    expect(onChange).toHaveBeenLastCalledWith("30 9 * 6 *")
  })

  it("preserves the other fields when only one changes", () => {
    const { onChange } = harness("15 10 5 7 3")
    fireEvent.change(screen.getByLabelText("Min"), { target: { value: "0" } })
    expect(onChange).toHaveBeenLastCalledWith("0 10 5 7 3")
  })
})

describe("CronBuilder — expression preview", () => {
  it("shows the current value verbatim in the cron preview", () => {
    harness("*/15 9-17 * * 1-5")
    expect(screen.getByText("*/15 9-17 * * 1-5")).toBeInTheDocument()
  })

  it("falls back to '* * * * *' when value is empty", () => {
    harness("")
    expect(screen.getByText("* * * * *")).toBeInTheDocument()
  })
})

describe("CronBuilder — parseCron edge cases (via component)", () => {
  it("handles extra whitespace in input cron", () => {
    harness("  0   9   *   *   *  ")
    expect(screen.getByLabelText("Min")).toHaveValue("0")
    expect(screen.getByLabelText("Hour")).toHaveValue("9")
  })

  it("defaults missing fields to '*' when cron is incomplete", () => {
    // 3-field cron — last 2 default to *
    harness("0 9 *")
    expect(screen.getByLabelText("Min")).toHaveValue("0")
    expect(screen.getByLabelText("Hour")).toHaveValue("9")
    expect(screen.getByLabelText("Day")).toHaveValue("*")
    expect(screen.getByLabelText("Month")).toHaveValue("*")
    expect(screen.getByLabelText("Weekday")).toHaveValue("*")
  })
})
