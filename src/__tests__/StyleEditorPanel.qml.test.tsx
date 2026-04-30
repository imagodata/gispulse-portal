/**
 * StyleEditorPanel — QML import/export interactions (issues #25, #26).
 *
 * Covers:
 *   - Export button calls api/styles.exportQml() with the filename derived
 *     from `{datasetName}-{layerName}.qml` (sanitised).
 *   - Import button click opens the hidden file input.
 *   - Picking a file with NO custom styleDef applies the returned style_def
 *     immediately (no overwrite dialog).
 *   - Picking a file when a custom styleDef IS set surfaces the confirm
 *     dialog; confirming runs the import, cancelling discards it.
 *   - Toast.success / toast.error are wired on success / failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock("@/api/styles", () => ({
  importQml: vi.fn(),
  exportQml: vi.fn(),
}))

import { toast } from "sonner"
import { importQml, exportQml } from "@/api/styles"
import { StyleEditorPanel } from "@/components/style/StyleEditorPanel"
import { useDatasetStore } from "@/stores/datasetStore"
import { useMapViewStore } from "@/stores/mapViewStore"
import { setupStoreReset } from "@/__tests__/helpers/zustand"
import { renderWithProviders } from "@/__tests__/helpers/renderWithProviders"
import type { LayerStyleDef } from "@/types/layerStyle"
import type { DatasetMeta } from "@/types/dataset"

const DATASET_ID = "ds-1"
const LAYER_NAME = "parcels"
const LAYER_KEY = `${DATASET_ID}::${LAYER_NAME}`

function seedStores(opts: { withCustomStyleDef?: boolean } = {}) {
  const dataset: DatasetMeta = {
    id: DATASET_ID,
    name: "Cadastre 2024",
    source_path: "/tmp/cadastre.gpkg",
    format: "gpkg",
    crs: "EPSG:4326",
    file_size: 1024,
    layers: [
      {
        name: LAYER_NAME,
        geometry_type: "MultiPolygon",
        feature_count: 100,
        bbox: [0, 0, 1, 1],
        crs: "EPSG:4326",
        fields: [{ name: "id", type: "int" }],
      },
    ],
    created_at: "2026-04-30",
  }
  useDatasetStore.setState({ datasets: [dataset] })

  const styleDef: LayerStyleDef | undefined = opts.withCustomStyleDef
    ? { renderer: "single", symbol: { kind: "fill", color: "#ff0000", opacity: 0.5, strokeColor: "#000", strokeWidth: 1 } }
    : undefined

  const view = useMapViewStore.getState().views[0]
  useMapViewStore.setState({
    views: [
      {
        ...view,
        state: {
          ...view.state,
          layerStack: [
            {
              key: LAYER_KEY,
              visible: true,
              color: "#3b82f6",
              opacity: 0.7,
              displayName: LAYER_NAME,
              ...(styleDef ? { styleDef } : {}),
            },
          ],
        },
      },
    ],
  })
}

describe("StyleEditorPanel — QML import/export", () => {
  setupStoreReset(useDatasetStore, useMapViewStore)

  beforeEach(() => {
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()
    vi.mocked(importQml).mockReset()
    vi.mocked(exportQml).mockReset()
  })

  it("renders Import .qml + Export .qml buttons in the header", () => {
    seedStores()
    renderWithProviders(<StyleEditorPanel layerKey={LAYER_KEY} onClose={vi.fn()} />)
    expect(screen.getByRole("button", { name: /import \.qml/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /export \.qml/i })).toBeInTheDocument()
  })

  it("export button calls exportQml with sanitised filename and toasts success", async () => {
    seedStores()
    vi.mocked(exportQml).mockResolvedValueOnce(new Blob(["<qgis/>"]))
    renderWithProviders(<StyleEditorPanel layerKey={LAYER_KEY} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /export \.qml/i }))

    await waitFor(() => {
      expect(exportQml).toHaveBeenCalledWith(
        DATASET_ID,
        LAYER_NAME,
        "Cadastre_2024-parcels.qml",
      )
    })
    expect(toast.success).toHaveBeenCalled()
  })

  it("export button toasts error on failure", async () => {
    seedStores()
    vi.mocked(exportQml).mockRejectedValueOnce(new Error("No QML style for layer"))
    renderWithProviders(<StyleEditorPanel layerKey={LAYER_KEY} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /export \.qml/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("file pick with no custom styleDef calls importQml directly and applies result", async () => {
    seedStores({ withCustomStyleDef: false })
    const returnedStyle: LayerStyleDef = {
      renderer: "single",
      symbol: { kind: "fill", color: "#00ff00", opacity: 0.8, strokeColor: "#000", strokeWidth: 1 },
    }
    vi.mocked(importQml).mockResolvedValueOnce({
      layer_name: LAYER_NAME,
      style_def: returnedStyle,
      qml_size_bytes: 256,
    })

    const { container } = renderWithProviders(
      <StyleEditorPanel layerKey={LAYER_KEY} onClose={vi.fn()} />,
    )

    const file = new File(["<qgis/>"], "fixture.qml", { type: "application/xml" })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeTruthy()

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(importQml).toHaveBeenCalledWith(DATASET_ID, LAYER_NAME, file, "polygon")
    })

    // confirm the returned style_def landed in the store
    const stored = useMapViewStore.getState().views[0].state.layerStack[0].styleDef
    expect(stored).toEqual(returnedStyle)
    expect(toast.success).toHaveBeenCalled()
  })

  it("file pick with existing custom styleDef opens overwrite dialog; confirm runs import", async () => {
    seedStores({ withCustomStyleDef: true })
    const returnedStyle: LayerStyleDef = { renderer: "single" }
    vi.mocked(importQml).mockResolvedValueOnce({
      layer_name: LAYER_NAME,
      style_def: returnedStyle,
      qml_size_bytes: 128,
    })

    const { container } = renderWithProviders(
      <StyleEditorPanel layerKey={LAYER_KEY} onClose={vi.fn()} />,
    )

    const file = new File(["<qgis/>"], "fixture.qml", { type: "application/xml" })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    // Dialog visible, import not yet called
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    expect(importQml).not.toHaveBeenCalled()

    // Confirm
    fireEvent.click(screen.getByRole("button", { name: /^replace$/i }))

    await waitFor(() => {
      expect(importQml).toHaveBeenCalledWith(DATASET_ID, LAYER_NAME, file, "polygon")
    })
  })

  it("cancelling the overwrite dialog discards the pending file", async () => {
    seedStores({ withCustomStyleDef: true })
    const { container } = renderWithProviders(
      <StyleEditorPanel layerKey={LAYER_KEY} onClose={vi.fn()} />,
    )

    const file = new File(["<qgis/>"], "fixture.qml", { type: "application/xml" })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
    expect(importQml).not.toHaveBeenCalled()
  })

  it("import failure surfaces toast.error", async () => {
    seedStores({ withCustomStyleDef: false })
    vi.mocked(importQml).mockRejectedValueOnce(new Error("Invalid QML"))

    const { container } = renderWithProviders(
      <StyleEditorPanel layerKey={LAYER_KEY} onClose={vi.fn()} />,
    )

    const file = new File(["bad"], "bad.qml", { type: "application/xml" })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled()
    })
    expect(toast.success).not.toHaveBeenCalled()
  })
})
