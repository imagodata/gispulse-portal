/**
 * SettingsPanel.test — modal interaction: validation, healthcheck,
 * save, reset.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SettingsPanel } from "@/components/SettingsPanel"
import { useSettingsStore, STORAGE_KEY } from "@/stores/settingsStore"

function resetStore() {
  useSettingsStore.setState({
    backendUrl: "",
    healthStatus: "idle",
    healthLatencyMs: null,
    healthError: null,
    panelOpen: false,
    readOnlyDialogOpen: false,
  })
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

describe("SettingsPanel", () => {
  beforeEach(() => resetStore())
  afterEach(() => vi.restoreAllMocks())

  it("renders nothing when closed", () => {
    const { container } = render(<SettingsPanel open={false} onClose={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders the URL input + healthcheck button when open", () => {
    render(<SettingsPanel open={true} onClose={vi.fn()} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByLabelText(/backend url/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /test connection/i })).toBeInTheDocument()
  })

  it("shows validation error for non-http URL", async () => {
    const user = userEvent.setup()
    render(<SettingsPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByLabelText(/backend url/i) as HTMLInputElement
    await user.type(input, "ws://example.com")
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(screen.getByRole("alert")).toHaveTextContent(/http/)
  })

  it("shows validation error for trailing path", async () => {
    const user = userEvent.setup()
    render(<SettingsPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByLabelText(/backend url/i)
    await user.type(input, "https://api.example.com/v1")
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("save commits the URL to the store and closes the panel", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SettingsPanel open={true} onClose={onClose} />)
    const input = screen.getByLabelText(/backend url/i)
    await user.type(input, "http://localhost:8001/")
    await user.click(screen.getByRole("button", { name: /save & connect/i }))
    expect(useSettingsStore.getState().backendUrl).toBe("http://localhost:8001")
    expect(localStorage.getItem(STORAGE_KEY)).toBe("http://localhost:8001")
    expect(onClose).toHaveBeenCalled()
  })

  it("save is blocked when URL is invalid", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SettingsPanel open={true} onClose={onClose} />)
    const input = screen.getByLabelText(/backend url/i)
    await user.type(input, "garbage")
    const saveBtn = screen.getByRole("button", { name: /save & connect/i })
    expect(saveBtn).toBeDisabled()
    await user.click(saveBtn)
    expect(useSettingsStore.getState().backendUrl).toBe("")
    expect(onClose).not.toHaveBeenCalled()
  })

  it("reset clears localStorage and reverts to demo", async () => {
    useSettingsStore.setState({ backendUrl: "http://localhost:8001" })
    localStorage.setItem(STORAGE_KEY, "http://localhost:8001")
    const user = userEvent.setup()
    render(<SettingsPanel open={true} onClose={vi.fn()} />)
    await user.click(screen.getByRole("button", { name: /reset to demo/i }))
    expect(useSettingsStore.getState().backendUrl).toBe("")
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("healthcheck shows ok status with latency on 200", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    )
    const user = userEvent.setup()
    render(<SettingsPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByLabelText(/backend url/i)
    await user.type(input, "http://localhost:8001")
    await user.click(screen.getByRole("button", { name: /test connection/i }))
    await waitFor(() => {
      expect(screen.getByTestId("health-dot").dataset.status).toBe("ok")
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:8001/health",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("healthcheck shows fail status on 5xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 503 }))
    const user = userEvent.setup()
    render(<SettingsPanel open={true} onClose={vi.fn()} />)
    const input = screen.getByLabelText(/backend url/i)
    await user.type(input, "http://localhost:8001")
    await user.click(screen.getByRole("button", { name: /test connection/i }))
    await waitFor(() => {
      expect(screen.getByTestId("health-dot").dataset.status).toBe("fail")
    })
  })

  it("Escape closes the panel", () => {
    const onClose = vi.fn()
    render(<SettingsPanel open={true} onClose={onClose} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
