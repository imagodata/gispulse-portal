/**
 * Component tests for PredicateBuilder — covers the recursive
 * Compound / Attr / Geom / Aggregation predicate editor tree.
 *
 * The component is fully prop-driven (value, onChange, fields, tables) —
 * no zustand or react-query — so tests follow the same shape as the
 * earlier leaf PRs (CronBuilder, ActionEditor, shared.tsx).
 *
 * Coverage angles :
 *   1. Root group : logic toggles, add buttons, MAX_DEPTH guard
 *   2. AttrPredicateEditor : fields select vs free-text fallback, op + value, remove
 *   3. GeomPredicateEditor : conditional distance field, distant table fallback, buffer
 *   4. AggregationPredicateEditor : describeAggregation render, aggregate fn vs field
 *      label flip, threshold compare, filtered op list
 *   5. Recursive Compound : nested group renders + removes correctly
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { PredicateBuilder } from "../PredicateBuilder"
import type {
  AnyPredicate,
  AttrPredicate,
  CompoundPredicate,
  GeomPredicate,
} from "@/types/editor"

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function emptyAnd(predicates: AnyPredicate[] = []): CompoundPredicate {
  return { type: "compound", logic: "AND", predicates }
}

function attr(field = "status", op: AttrPredicate["op"] = "eq", value: unknown = "active"): AttrPredicate {
  return { type: "attr", field, op, value }
}

function geom(extra: Partial<GeomPredicate> = {}): GeomPredicate {
  return {
    type: "geom",
    op: "intersects",
    ref_table: "zones",
    ref_geom_col: "geom",
    ...extra,
  }
}

function aggGeom(extra: Partial<GeomPredicate> = {}): GeomPredicate {
  return {
    type: "geom",
    op: "contains",
    ref_table: "buildings",
    ref_geom_col: "geom",
    aggregate_fn: "count",
    aggregate_op: "gt",
    aggregate_value: 5,
    ...extra,
  }
}

function harness(value: CompoundPredicate, opts: { fields?: string[]; tables?: string[] } = {}) {
  const onChange = vi.fn<(node: CompoundPredicate) => void>()
  const view = render(
    <PredicateBuilder
      value={value}
      onChange={onChange}
      fields={opts.fields}
      tables={opts.tables}
    />,
  )
  return { onChange, ...view }
}

// ---------------------------------------------------------------------------
// Root group : logic + add buttons + MAX_DEPTH guard
// ---------------------------------------------------------------------------

describe("PredicateBuilder — root group logic toggle", () => {
  it("renders the three logic buttons (AND / OR / NOT)", () => {
    harness(emptyAnd())
    expect(screen.getByRole("button", { name: "AND" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "OR" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "NOT" })).toBeInTheDocument()
  })

  it("highlights the active logic with bg-primary", () => {
    harness({ type: "compound", logic: "OR", predicates: [] })
    const or = screen.getByRole("button", { name: "OR" })
    expect(or.className).toContain("bg-primary")
    expect(screen.getByRole("button", { name: "AND" }).className).toContain("bg-muted")
  })

  it("emits onChange with the new logic when a different button is clicked", () => {
    const { onChange } = harness(emptyAnd())
    fireEvent.click(screen.getByRole("button", { name: "OR" }))
    expect(onChange).toHaveBeenCalledWith({
      type: "compound",
      logic: "OR",
      predicates: [],
    })
  })
})

describe("PredicateBuilder — add buttons", () => {
  it("+ Attribute appends an empty AttrPredicate", () => {
    const { onChange } = harness(emptyAnd())
    fireEvent.click(screen.getByRole("button", { name: "+ Attribute" }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]![0]
    expect(next.predicates).toHaveLength(1)
    expect(next.predicates[0]).toEqual({ type: "attr", field: "", op: "eq", value: "" })
  })

  it("+ Geometry appends an empty GeomPredicate (intersects, no aggregate)", () => {
    const { onChange } = harness(emptyAnd())
    fireEvent.click(screen.getByRole("button", { name: "+ Geometry" }))
    const next = onChange.mock.calls[0]![0]
    const newChild = next.predicates[0] as GeomPredicate
    expect(newChild.type).toBe("geom")
    expect(newChild.op).toBe("intersects")
    expect(newChild.ref_table).toBe("")
    expect(newChild.aggregate_fn).toBeUndefined()
  })

  it("+ Aggregation appends a GeomPredicate with default aggregate (count > 0)", () => {
    const { onChange } = harness(emptyAnd())
    fireEvent.click(screen.getByRole("button", { name: "+ Aggregation" }))
    const newChild = onChange.mock.calls[0]![0].predicates[0] as GeomPredicate
    expect(newChild.aggregate_fn).toBe("count")
    expect(newChild.aggregate_op).toBe("gt")
    expect(newChild.aggregate_value).toBe(0)
    expect(newChild.op).toBe("contains")
  })

  it("+ Group is visible at depth 0 (root)", () => {
    harness(emptyAnd())
    expect(screen.getByRole("button", { name: "+ Group" })).toBeInTheDocument()
  })

  it("+ Group hidden at depth MAX_DEPTH-1 (= 1, one level nested)", () => {
    const nested = emptyAnd([emptyAnd()]) // root has a child compound
    const { container } = harness(nested)
    // The nested compound is the child group; its + Group button should be absent.
    const buttons = within(container).getAllByRole("button", { name: "+ Group" })
    // Only the root group has its + Group button — the nested one shouldn't render it.
    expect(buttons).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// AttrPredicateEditor — rendered inside group when child.type === "attr"
// ---------------------------------------------------------------------------

describe("AttrPredicateEditor (via PredicateBuilder)", () => {
  it("shows the ATTR badge and 8 attr operators", () => {
    harness(emptyAnd([attr()]))
    expect(screen.getByText("ATTR")).toBeInTheDocument()
    // Op select : 8 ATTR_OPS entries (=, !=, >, <, >=, <=, IN, LIKE).
    const opSelect = screen
      .getAllByRole("combobox")
      .find((el) => (el as HTMLSelectElement).value === "eq")
    expect(opSelect).toBeTruthy()
    expect(within(opSelect as HTMLElement).getAllByRole("option")).toHaveLength(8)
  })

  it("renders a <select> for the field when fields prop is non-empty", () => {
    harness(emptyAnd([attr()]), { fields: ["status", "name", "size"] })
    expect(screen.getByRole("option", { name: "status" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "name" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "size" })).toBeInTheDocument()
    // Plus the 'field...' placeholder option
    expect(screen.getByRole("option", { name: /field\.\.\./i })).toBeInTheDocument()
  })

  it("falls back to a free-text Input when fields prop is empty", () => {
    harness(emptyAnd([attr("custom_col", "eq", "x")]))
    expect(screen.getByPlaceholderText("field")).toHaveValue("custom_col")
  })

  it("emits onChange when the value Input changes", () => {
    const { onChange } = harness(emptyAnd([attr("status", "eq", "active")]))
    fireEvent.change(screen.getByPlaceholderText("value"), {
      target: { value: "draft" },
    })
    const next = onChange.mock.calls[0]![0]
    expect((next.predicates[0] as AttrPredicate).value).toBe("draft")
  })

  it("remove button removes the predicate from the parent group's children", () => {
    const { onChange } = harness(emptyAnd([attr(), attr("zone", "neq", "x")]))
    // 2 ATTR rows, each with its own Remove button (title="Remove")
    const removes = screen.getAllByTitle("Remove")
    fireEvent.click(removes[0]!)
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]![0]
    expect(next.predicates).toHaveLength(1)
    // The second predicate survives.
    expect((next.predicates[0] as AttrPredicate).field).toBe("zone")
  })
})

// ---------------------------------------------------------------------------
// GeomPredicateEditor — non-aggregated geom
// ---------------------------------------------------------------------------

describe("GeomPredicateEditor (via PredicateBuilder)", () => {
  it("shows the GEOM badge and the 8 geom operators", () => {
    harness(emptyAnd([geom()]))
    expect(screen.getByText("GEOM")).toBeInTheDocument()
    const opSelect = screen
      .getAllByRole("combobox")
      .find((el) => (el as HTMLSelectElement).value === "intersects")
    expect(opSelect).toBeTruthy()
    expect(within(opSelect as HTMLElement).getAllByRole("option")).toHaveLength(8)
  })

  it("renders a <select> for the distant table when tables prop is non-empty", () => {
    harness(emptyAnd([geom()]), { tables: ["zones", "parcels"] })
    expect(screen.getByRole("option", { name: "zones" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "parcels" })).toBeInTheDocument()
  })

  it("falls back to a free-text Input when tables prop is empty", () => {
    harness(emptyAnd([geom({ ref_table: "freeform_table" })]))
    expect(screen.getByPlaceholderText("table name")).toHaveValue("freeform_table")
  })

  it("hides the Distance field for non-distance ops (intersects)", () => {
    harness(emptyAnd([geom({ op: "intersects" })]))
    expect(screen.queryByText("Distance (m)")).not.toBeInTheDocument()
  })

  it("shows the Distance field for distance_lt", () => {
    harness(emptyAnd([geom({ op: "distance_lt", distance: 100 })]))
    expect(screen.getByText("Distance (m)")).toBeInTheDocument()
  })

  it("shows the Distance field for distance_gt", () => {
    harness(emptyAnd([geom({ op: "distance_gt", distance: 50 })]))
    expect(screen.getByText("Distance (m)")).toBeInTheDocument()
  })

  it("Buffer (m) is always shown regardless of op", () => {
    harness(emptyAnd([geom({ op: "intersects" })]))
    expect(screen.getByText("Buffer (m)")).toBeInTheDocument()
  })

  it("emits onChange when the WHERE filter input changes", () => {
    const { onChange } = harness(emptyAnd([geom()]))
    fireEvent.change(screen.getByPlaceholderText(/WHERE filter/i), {
      target: { value: "active = true" },
    })
    const next = onChange.mock.calls[0]![0]
    expect((next.predicates[0] as GeomPredicate).ref_filter).toBe("active = true")
  })
})

// ---------------------------------------------------------------------------
// AggregationPredicateEditor — geom with aggregate_fn set
// ---------------------------------------------------------------------------

describe("AggregationPredicateEditor (via PredicateBuilder)", () => {
  it("shows the AGG badge", () => {
    harness(emptyAnd([aggGeom()]))
    expect(screen.getByText("AGG")).toBeInTheDocument()
  })

  it("renders the natural-language description when fields are filled", () => {
    harness(
      emptyAnd([
        aggGeom({
          aggregate_fn: "sum",
          aggregate_op: "gt",
          aggregate_value: 1000,
          ref_table: "buildings",
          ref_column: "footprint_area",
          op: "contains",
        }),
      ]),
    )
    // describeAggregation : "Fire if SUM(footprint_area) of buildings features matching ST_Contains > 1000"
    // Match the whole description in one shot — ST_Contains also appears in the
    // spatial relation <option> list, so a separate getByText would be ambiguous.
    expect(
      screen.getByText(/Fire if SUM\(footprint_area\) of buildings features matching ST_Contains > 1000/i),
    ).toBeInTheDocument()
  })

  it("filters the spatial relation list to non-distance ops", () => {
    harness(emptyAnd([aggGeom()]))
    // The aggregation's op select drops distance_lt / distance_gt — keep
    // only the 6 set ops (intersects/within/contains/crosses/overlaps/touches).
    const allOpSelects = screen.getAllByRole("combobox")
    // Find the one whose current value matches the aggregation's op ("contains")
    const opSelect = allOpSelects.find(
      (el) => (el as HTMLSelectElement).value === "contains",
    )
    expect(opSelect).toBeTruthy()
    const opOptions = within(opSelect as HTMLElement).getAllByRole("option")
    expect(opOptions).toHaveLength(6)
    const optValues = opOptions.map((o) => (o as HTMLOptionElement).value)
    expect(optValues).not.toContain("distance_lt")
    expect(optValues).not.toContain("distance_gt")
  })

  it("uses 'Agg field' label and ref_column input for non-count aggregates", () => {
    harness(emptyAnd([aggGeom({ aggregate_fn: "sum", ref_column: "area" })]))
    expect(screen.getByText("Agg field")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("field to aggregate")).toHaveValue("area")
  })

  it("uses 'Geom col' label and ref_geom_col input for count aggregate", () => {
    harness(emptyAnd([aggGeom({ aggregate_fn: "count", ref_geom_col: "geom_pt" })]))
    expect(screen.getByText("Geom col")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("geom")).toHaveValue("geom_pt")
  })

  it("renders the Threshold compare op + value", () => {
    harness(emptyAnd([aggGeom({ aggregate_op: "gte", aggregate_value: 42 })]))
    expect(screen.getByText("Threshold")).toBeInTheDocument()
    const valueInput = screen.getByPlaceholderText("value") as HTMLInputElement
    expect(valueInput.value).toBe("42")
  })

  it("emits a numeric aggregate_value on Threshold input change", () => {
    const { onChange } = harness(emptyAnd([aggGeom()]))
    fireEvent.change(screen.getByPlaceholderText("value"), { target: { value: "100" } })
    const next = onChange.mock.calls[0]![0]
    expect((next.predicates[0] as GeomPredicate).aggregate_value).toBe(100)
  })

  it("emits aggregate_value: undefined when the Threshold input is cleared", () => {
    const { onChange } = harness(emptyAnd([aggGeom({ aggregate_value: 5 })]))
    fireEvent.change(screen.getByPlaceholderText("value"), { target: { value: "" } })
    const next = onChange.mock.calls[0]![0]
    expect((next.predicates[0] as GeomPredicate).aggregate_value).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Recursive Compound — nested groups
// ---------------------------------------------------------------------------

describe("PredicateBuilder — nested compound predicates", () => {
  it("renders a child compound as a nested PredicateGroup", () => {
    const nested = emptyAnd([
      attr("region", "eq", "EU"),
      { type: "compound", logic: "OR", predicates: [attr("status", "eq", "draft")] },
    ])
    harness(nested)
    // Both parent and child compound show their AND/OR/NOT buttons.
    // Parent has AND active, child has OR active → 2 highlighted buttons total.
    const ands = screen.getAllByRole("button", { name: "AND" })
    const ors = screen.getAllByRole("button", { name: "OR" })
    expect(ands.length).toBeGreaterThanOrEqual(2)
    expect(ors.length).toBeGreaterThanOrEqual(2)
  })

  it("removes the nested group via its Remove group button", () => {
    const nested = emptyAnd([
      { type: "compound", logic: "OR", predicates: [] },
    ])
    const { onChange } = harness(nested)
    fireEvent.click(screen.getByTitle("Remove group"))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0].predicates).toHaveLength(0)
  })

  it("alternates background shade by depth (depth even = bg-muted/30, odd = bg-muted/60)", () => {
    const nested = emptyAnd([
      { type: "compound", logic: "AND", predicates: [] },
    ])
    const { container } = harness(nested)
    const groups = container.querySelectorAll("[class*='bg-muted/']")
    expect(groups.length).toBeGreaterThanOrEqual(2)
    // First group (depth 0) uses bg-muted/30
    expect(groups[0]?.className).toContain("bg-muted/30")
    // Second group (depth 1, nested) uses bg-muted/60
    expect(groups[1]?.className).toContain("bg-muted/60")
  })
})
