/**
 * Integration test for the schema-driven NodePropertyPanel flow (#460):
 *   - SchemaForm renders bilingual labels via the translate prop
 *   - validateAgainstSchema produces errors that gate submit-style buttons
 *   - locale toggle swaps FR/EN labels at runtime
 *
 * Covers the user-visible contract of the schema-driven feature without
 * spinning up Playwright (deferred — no Playwright infra in this repo).
 */

import { describe, it, expect } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { useState } from "react"
import { SchemaForm } from "@/components/nodes/SchemaForm"
import { validateAgainstSchema, type JSONSchema } from "@/components/nodes/schemaFormUtils"
import { makeCapabilityTranslator } from "@/i18n/capabilityLabels"

const bufferSchema: JSONSchema = {
  type: "object",
  required: ["distance"],
  properties: {
    distance: { type: "number", minimum: 0, title: "distance" },
    cap_style: { type: "string", enum: ["round", "flat", "square"], title: "cap_style" },
  },
}

function Harness({ locale, initial }: { locale: "en" | "fr"; initial?: Record<string, unknown> }) {
  const [value, setValue] = useState<Record<string, unknown>>(initial ?? {})
  const errors = validateAgainstSchema(bufferSchema, value)
  const translate = makeCapabilityTranslator("buffer", locale)
  return (
    <div>
      <SchemaForm
        schema={bufferSchema}
        value={value}
        onChange={(k, v) => setValue((prev) => ({ ...prev, [k]: v }))}
        translate={translate}
      />
      <button
        type="button"
        disabled={Object.keys(errors).length > 0}
        data-testid="submit"
      >
        Run
      </button>
    </div>
  )
}

describe("Schema-driven NodePropertyPanel flow (#460)", () => {
  it("renders English labels for buffer capability", () => {
    render(<Harness locale="en" />)
    expect(screen.getByText("Buffer distance")).toBeInTheDocument()
    expect(screen.getByText("Cap style")).toBeInTheDocument()
  })

  it("renders French labels for buffer capability", () => {
    render(<Harness locale="fr" />)
    expect(screen.getByText("Distance du tampon")).toBeInTheDocument()
    expect(screen.getByText("Style d'extrémité")).toBeInTheDocument()
  })

  it("falls back to common dictionary then schema title for unknown capability params", () => {
    const t = makeCapabilityTranslator("unknown_cap", "fr")
    expect(t("distance", "fallback")).toBe("Distance")
    expect(t("totally_made_up_field", "Schema Title")).toBe("Schema Title")
  })

  it("disables submit when a required field is missing", () => {
    render(<Harness locale="en" initial={{}} />)
    expect(screen.getByTestId("submit")).toBeDisabled()
  })

  it("enables submit when all required fields are filled and valid", () => {
    render(<Harness locale="en" initial={{ distance: 10 }} />)
    expect(screen.getByTestId("submit")).not.toBeDisabled()
  })

  it("disables submit when a numeric field violates its minimum", () => {
    render(<Harness locale="en" initial={{ distance: -5 }} />)
    expect(screen.getByTestId("submit")).toBeDisabled()
    expect(screen.getByText(/Min 0/)).toBeInTheDocument()
  })

  it("validateAgainstSchema reports per-field errors", () => {
    const errors = validateAgainstSchema(bufferSchema, { distance: -1 })
    expect(errors.distance).toBe("Min 0")
  })

  it("re-renders with FR labels after locale state changes", () => {
    function Toggle() {
      const [loc, setLoc] = useState<"en" | "fr">("en")
      return (
        <div>
          <button data-testid="toggle" onClick={() => setLoc((p) => (p === "en" ? "fr" : "en"))}>
            toggle
          </button>
          <SchemaForm
            schema={bufferSchema}
            value={{ distance: 1 }}
            onChange={() => {}}
            translate={makeCapabilityTranslator("buffer", loc)}
          />
        </div>
      )
    }
    render(<Toggle />)
    expect(screen.getByText("Buffer distance")).toBeInTheDocument()
    act(() => {
      screen.getByTestId("toggle").click()
    })
    expect(screen.getByText("Distance du tampon")).toBeInTheDocument()
  })
})
