/**
 * renderWithProviders — testing-library wrapper that adds the providers
 * orchestrator components (NodePropertyPanel, TriggerBuilderInline /
 * Modal, etc.) actually need at render time.
 *
 * Usage :
 *
 *   import { renderWithProviders } from "@/__tests__/helpers/renderWithProviders"
 *
 *   it("renders the run-node button", () => {
 *     renderWithProviders(<NodePropertyPanel nodeId="x" nodeType="capability" />)
 *     expect(screen.getByRole("button", { name: /run/i })).toBeInTheDocument()
 *   })
 *
 * What it provides
 * ----------------
 * - **MemoryRouter** when `routerEntries` is passed. Components that use
 *   `useNavigate` / `<Link>` need a router context ; without it Click
 *   events on links throw `Cannot read properties of undefined (reading
 *   'pathname')`. Pass an `initialEntries` array for the URL stack.
 * - **Plain render** when no providers are needed. Identical to a bare
 *   `render(ui)` call but keeps the call-site uniform.
 *
 * What it does NOT provide
 * ------------------------
 * - **Zustand stores** — those are module-level singletons. Use the
 *   `setupStoreReset` helper (see `helpers/zustand.ts`) to snapshot &
 *   restore initial state in `beforeEach`. Mocking stores wholesale is
 *   discouraged — the components rely on subtle slice update semantics.
 * - **sonner toast** — `vi.mock` calls are hoisted, so the mock has to
 *   live at the top of each test file (not behind a helper). See
 *   `helpers/README.md` for the canonical snippet.
 * - **API client** — same reason as sonner, mock at file top.
 * - **react-query / QueryClient** — not actually used in the codebase
 *   (`useCapabilities` is hand-rolled with a module-level cache and
 *   `_resetCapabilitiesCacheForTests()`). No QueryClientProvider needed.
 */

import { render, type RenderOptions, type RenderResult } from "@testing-library/react"
import type { ReactElement, ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"

export interface RenderWithProvidersOptions extends RenderOptions {
  /**
   * Wrap the tree in a MemoryRouter with these entries. Pass an empty
   * array or omit to render without a router.
   */
  routerEntries?: string[]
  /**
   * Initial index into routerEntries (default 0). Forwarded to
   * MemoryRouter.
   */
  routerInitialIndex?: number
}

export function renderWithProviders(
  ui: ReactElement,
  {
    routerEntries,
    routerInitialIndex,
    ...renderOptions
  }: RenderWithProvidersOptions = {},
): RenderResult {
  function Wrapper({ children }: { children: ReactNode }) {
    if (routerEntries && routerEntries.length > 0) {
      return (
        <MemoryRouter
          initialEntries={routerEntries}
          initialIndex={routerInitialIndex ?? 0}
        >
          {children}
        </MemoryRouter>
      )
    }
    return <>{children}</>
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions })
}
