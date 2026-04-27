import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SchemaForm } from "@/components/nodes/SchemaForm"
import { isRenderableSchema, validateAgainstSchema, type JSONSchema } from "@/components/nodes/schemaFormUtils"

function harness(schema: JSONSchema, initial: Record<string, unknown> = {}) {
  const onChange = vi.fn()
  const view = render(<SchemaForm schema={schema} value={initial} onChange={onChange} />)
  return { onChange, ...view }
}

describe("isRenderableSchema", () => {
  it("rejects null/undefined", () => {
    expect(isRenderableSchema(null)).toBe(false)
    expect(isRenderableSchema(undefined)).toBe(false)
  })
  it("rejects non-object schemas", () => {
    expect(isRenderableSchema({ type: "string" })).toBe(false)
  })
  it("rejects object without properties", () => {
    expect(isRenderableSchema({ type: "object" })).toBe(false)
  })
  it("rejects object with empty properties", () => {
    expect(isRenderableSchema({ type: "object", properties: {} })).toBe(false)
  })
  it("accepts object with properties", () => {
    expect(isRenderableSchema({ type: "object", properties: { x: { type: "string" } } })).toBe(true)
  })
})

describe("SchemaForm — rendering nothing", () => {
  it("renders nothing for unrenderable schema", () => {
    const { container } = harness({ type: "string" } as JSONSchema)
    expect(container.firstChild).toBeNull()
  })
})

describe("SchemaForm — string field", () => {
  it("renders a text input with title and description", () => {
    harness({
      type: "object",
      properties: {
        name: { type: "string", title: "Name", description: "Your name" },
      },
    })
    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument()
  })

  it("emits onChange with raw string", () => {
    const { onChange } = harness({
      type: "object",
      properties: { name: { type: "string", title: "Name" } },
    })
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Alice" } })
    expect(onChange).toHaveBeenLastCalledWith("name", "Alice")
  })

  it("flags missing required string", () => {
    const errors = validateAgainstSchema(
      {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string", title: "Name" } },
      },
      {},
    )
    expect(errors).toEqual({ name: "Required" })
  })

  it("validates string against pattern", () => {
    const errors = validateAgainstSchema(
      {
        type: "object",
        properties: { code: { type: "string", title: "Code", pattern: "^[A-Z]{3}$" } },
      },
      { code: "abc" },
    )
    expect(errors).toEqual({ code: "Invalid format" })
  })

  it("does not flag optional empty string", () => {
    const errors = validateAgainstSchema(
      {
        type: "object",
        properties: { name: { type: "string", title: "Name" } },
      },
      {},
    )
    expect(errors).toEqual({})
  })
})

describe("SchemaForm — number/integer field", () => {
  it("renders number input with min/max", () => {
    harness({
      type: "object",
      properties: { dist: { type: "number", title: "Distance", minimum: 0, maximum: 1000 } },
    })
    const input = screen.getByRole("spinbutton")
    expect(input).toHaveAttribute("min", "0")
    expect(input).toHaveAttribute("max", "1000")
  })

  it("emits Number on change", () => {
    const { onChange } = harness({
      type: "object",
      properties: { dist: { type: "number", title: "Distance" } },
    })
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "42" } })
    expect(onChange).toHaveBeenLastCalledWith("dist", 42)
  })

  it("flags integer that is not integer", () => {
    const errors = validateAgainstSchema(
      {
        type: "object",
        properties: { n: { type: "integer", title: "N" } },
      },
      { n: 1.5 },
    )
    expect(errors).toEqual({ n: "Must be an integer" })
  })

  it("flags below minimum", () => {
    const errors = validateAgainstSchema(
      {
        type: "object",
        properties: { dist: { type: "number", title: "Distance", minimum: 10 } },
      },
      { dist: 5 },
    )
    expect(errors).toEqual({ dist: "Min 10" })
  })

  it("flags above maximum", () => {
    const errors = validateAgainstSchema(
      {
        type: "object",
        properties: { dist: { type: "number", title: "Distance", maximum: 100 } },
      },
      { dist: 200 },
    )
    expect(errors).toEqual({ dist: "Max 100" })
  })
})

describe("SchemaForm — boolean field", () => {
  it("renders a checkbox", () => {
    harness({
      type: "object",
      properties: { flag: { type: "boolean", title: "Flag" } },
    })
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  it("emits boolean on toggle", async () => {
    const user = userEvent.setup()
    const { onChange } = harness({
      type: "object",
      properties: { flag: { type: "boolean", title: "Flag" } },
    })
    await user.click(screen.getByRole("checkbox"))
    expect(onChange).toHaveBeenLastCalledWith("flag", true)
  })
})

describe("SchemaForm — enum field", () => {
  it("renders a select with all options", () => {
    harness({
      type: "object",
      properties: { kind: { type: "string", title: "Kind", enum: ["a", "b", "c"] } },
    })
    expect(screen.getByRole("option", { name: "a" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "b" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "c" })).toBeInTheDocument()
  })

  it("emits onChange when option selected", () => {
    const { onChange } = harness({
      type: "object",
      properties: { kind: { type: "string", title: "Kind", enum: ["a", "b"] } },
    })
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "b" } })
    expect(onChange).toHaveBeenLastCalledWith("kind", "b")
  })

  it("flags invalid enum value", () => {
    const errors = validateAgainstSchema(
      {
        type: "object",
        properties: { kind: { type: "string", title: "Kind", enum: ["a", "b"] } },
      },
      { kind: "c" },
    )
    expect(errors).toEqual({ kind: "Invalid choice" })
  })
})

describe("SchemaForm — array field", () => {
  it("renders an item per array entry plus add button", () => {
    harness(
      {
        type: "object",
        properties: { tags: { type: "array", title: "Tags", items: { type: "string" } } },
      },
      { tags: ["one", "two"] },
    )
    const inputs = screen.getAllByRole("textbox")
    expect(inputs).toHaveLength(2)
    expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument()
  })

  it("appends item on add click", async () => {
    const user = userEvent.setup()
    const { onChange } = harness(
      {
        type: "object",
        properties: { tags: { type: "array", items: { type: "string" } } },
      },
      { tags: ["one"] },
    )
    await user.click(screen.getByRole("button", { name: /add item/i }))
    expect(onChange).toHaveBeenLastCalledWith("tags", ["one", ""])
  })

  it("removes item on x click", async () => {
    const user = userEvent.setup()
    const { onChange } = harness(
      {
        type: "object",
        properties: { tags: { type: "array", items: { type: "string" } } },
      },
      { tags: ["a", "b", "c"] },
    )
    await user.click(screen.getByRole("button", { name: /remove item 2/i }))
    expect(onChange).toHaveBeenLastCalledWith("tags", ["a", "c"])
  })
})

describe("SchemaForm — nested object field", () => {
  it("renders a fieldset with nested properties", () => {
    harness({
      type: "object",
      properties: {
        meta: {
          type: "object",
          title: "Meta",
          properties: { author: { type: "string", title: "Author" } },
        },
      },
    })
    // "Meta" appears twice: as parent label + nested fieldset legend
    expect(screen.getAllByText("Meta")).toHaveLength(2)
    expect(screen.getByText("Author")).toBeInTheDocument()
  })

  it("emits parent-level onChange with merged child", () => {
    const { onChange } = harness(
      {
        type: "object",
        properties: {
          meta: {
            type: "object",
            properties: { author: { type: "string" } },
          },
        },
      },
      { meta: { author: "Alice" } },
    )
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Bob" } })
    expect(onChange).toHaveBeenLastCalledWith("meta", { author: "Bob" })
  })
})

describe("SchemaForm — i18n hook", () => {
  it("uses translate function for labels when provided", () => {
    const translate = (key: string, fallback: string) => (key === "distance" ? "Distance (m)" : fallback)
    render(
      <SchemaForm
        schema={{
          type: "object",
          properties: { distance: { type: "number", title: "Distance" } },
        }}
        value={{}}
        onChange={() => {}}
        translate={translate}
      />,
    )
    expect(screen.getByText("Distance (m)")).toBeInTheDocument()
  })
})
