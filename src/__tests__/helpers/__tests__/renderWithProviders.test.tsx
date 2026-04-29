/**
 * Validation tests for the renderWithProviders helper.
 *
 * Two angles :
 * - The default mode (no routerEntries) renders the tree as a plain
 *   `render()` would.
 * - The router mode wires a MemoryRouter that satisfies useLocation /
 *   useNavigate. Without this wrapper those hooks throw at render
 *   time.
 */

import { describe, expect, it } from "vitest"
import { screen } from "@testing-library/react"
import { useLocation, useNavigate, Link } from "react-router-dom"

import { renderWithProviders } from "../renderWithProviders"

function PlainGreeting({ name }: { name: string }) {
  return <p>Hello, {name}!</p>
}

function PathDisplay() {
  const location = useLocation()
  return <span data-testid="path">{location.pathname}</span>
}

function NavLink() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate("/dashboard")}>
      Go
    </button>
  )
}

describe("renderWithProviders — plain mode", () => {
  it("renders without a router when routerEntries is omitted", () => {
    renderWithProviders(<PlainGreeting name="Test" />)
    expect(screen.getByText("Hello, Test!")).toBeInTheDocument()
  })

  it("renders without a router when routerEntries is an empty array", () => {
    renderWithProviders(<PlainGreeting name="Empty" />, { routerEntries: [] })
    expect(screen.getByText("Hello, Empty!")).toBeInTheDocument()
  })
})

describe("renderWithProviders — router mode", () => {
  it("wires MemoryRouter when routerEntries is non-empty", () => {
    renderWithProviders(<PathDisplay />, { routerEntries: ["/projects/abc"] })
    expect(screen.getByTestId("path")).toHaveTextContent("/projects/abc")
  })

  it("respects routerInitialIndex when entries has multiple items", () => {
    renderWithProviders(<PathDisplay />, {
      routerEntries: ["/a", "/b", "/c"],
      routerInitialIndex: 2,
    })
    expect(screen.getByTestId("path")).toHaveTextContent("/c")
  })

  it("provides useNavigate without crashing", () => {
    // Just checking the render doesn't throw — the hook needs the
    // router context to even initialise.
    renderWithProviders(<NavLink />, { routerEntries: ["/"] })
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument()
  })

  it("supports <Link>-rendering components", () => {
    renderWithProviders(
      <Link to="/dest">Go there</Link>,
      { routerEntries: ["/"] },
    )
    const link = screen.getByRole("link", { name: "Go there" })
    expect(link).toHaveAttribute("href", "/dest")
  })
})

describe("renderWithProviders — RenderOptions passthrough", () => {
  it("forwards container to the underlying render() call", () => {
    const container = document.createElement("div")
    container.id = "custom-root"
    document.body.appendChild(container)

    renderWithProviders(<PlainGreeting name="Container" />, {
      container,
    })

    expect(container.querySelector("p")).toHaveTextContent("Hello, Container!")
    document.body.removeChild(container)
  })
})
