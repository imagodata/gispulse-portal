# Test helpers

Composable utilities for component tests that need more than the default
`render(ui)` from testing-library.

## When to reach for which helper

| Need | Helper |
|---|---|
| Component uses `useNavigate` / `<Link>` / `useLocation` | `renderWithProviders` with `routerEntries` |
| Component uses zustand store(s) | `setupStoreReset(...stores)` in `describe` |
| Component imports `toast` from `sonner` | `vi.mock("sonner", …)` at file top (see snippet below) |
| Component calls `@/api/client` functions | `vi.mock("@/api/client", …)` at file top |
| Component uses `useCapabilities` | `_resetCapabilitiesCacheForTests()` from the hook itself, plus a mock for `listCapabilities` if needed |

## Patterns

### Plain prop-driven component

No helper needed. See `components/triggers/__tests__/CronBuilder.test.tsx` for the canonical small example.

```tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { MyLeaf } from "../MyLeaf"

it("renders", () => {
  render(<MyLeaf value="x" onChange={vi.fn()} />)
  expect(screen.getByDisplayValue("x")).toBeInTheDocument()
})
```

### Component that uses react-router

```tsx
import { renderWithProviders } from "@/__tests__/helpers/renderWithProviders"

it("navigates on submit", () => {
  renderWithProviders(<MyForm />, { routerEntries: ["/projects/123"] })
  // ...
})
```

### Component that uses zustand stores

```tsx
import { describe, it, expect } from "vitest"
import { useEditorStore } from "@/stores/editorStore"
import { setupStoreReset } from "@/__tests__/helpers/zustand"

describe("MyComponent", () => {
  setupStoreReset(useEditorStore)

  it("starts with no active scenario", () => {
    expect(useEditorStore.getState().activeScenarioId).toBeNull()
  })

  it("reacts to state mutation", () => {
    useEditorStore.setState({ activeScenarioId: "scn-1" })
    render(<MyComponent />)
    // assertions ...
    // After this test, useEditorStore is auto-reset to its default state.
  })
})
```

### Component that uses `sonner` toast

`vi.mock` calls are hoisted by Vitest, so they must live at the **top of the test file**, not inside a helper. Canonical snippet :

```tsx
import { vi } from "vitest"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  },
}))

import { toast } from "sonner"  // import AFTER vi.mock so the mock takes effect

// In tests :
import { beforeEach } from "vitest"
beforeEach(() => {
  vi.mocked(toast.success).mockClear()
  vi.mocked(toast.error).mockClear()
  // ...
})
```

### Component that calls `@/api/client`

Same pattern as sonner — `vi.mock("@/api/client", …)` at file top, with `vi.fn()` for each API function the component calls. Returns are typically `Promise.resolve(...)` for happy path, `Promise.reject(new Error(...))` for error paths.

```tsx
vi.mock("@/api/client", () => ({
  runScenarioNode: vi.fn().mockResolvedValue({ status: "success", duration_ms: 42, output_count: 100 }),
  createRuleFromNode: vi.fn().mockResolvedValue({ id: "rule-1" }),
}))
```

## Anti-patterns

- ❌ **Don't wrap zustand stores in a Provider.** They're not Context-based ; a wrapper does nothing.
- ❌ **Don't call `vi.mock` from inside a helper function.** Vitest hoists `vi.mock` calls to the top of the file at parse time. A helper that *calls* `vi.mock` won't have the same hoisting effect.
- ❌ **Don't add a `<QueryClientProvider>`.** This codebase doesn't use react-query directly. The `useCapabilities` hook is hand-rolled with a module-level cache.
- ❌ **Don't assume tests are isolated by default.** zustand stores leak. Use `setupStoreReset` if you mutate.

## Adding a new helper

If you find yourself copying the same setup 3+ times, extract it. Add the file under `src/__tests__/helpers/`, document it here, and ship a 1-2 case validation test demonstrating the helper works.
