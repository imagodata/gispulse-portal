/**
 * StyleEditorPanel — Advanced layer style editor.
 *
 * Geometry-aware: shows Point/Line/Fill editors based on the layer's geometry type.
 * Supports 4 renderer types: Single, Categorized, Graduated, Rule-based.
 * Changes apply in real-time to the map via the mapViewStore.
 */

import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { X, Circle, Minus, Square, Layers, BookOpen, RotateCcw, Upload, Download } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useT } from "@/i18n/useT"
import { useMapViewStore, parseLayerKey } from "@/stores/mapViewStore"
import { useDatasetStore } from "@/stores/datasetStore"
import { importQml, exportQml } from "@/api/styles"
import type {
  LayerStyleDef,
  RendererType,
  SymbolDef,
  PointSymbol,
  LineSymbol,
  FillSymbol,
  GeomFamily,
  CategoryEntry,
  GraduatedEntry,
  ClassifyMethod,
  ColorRampDef,
} from "@/types/layerStyle"
import { geomFamily, defaultSymbol, fromLegacyStyle } from "@/types/layerStyle"
import type { LayerField } from "@/types/dataset"
import { PointSymbolEditor } from "./PointSymbolEditor"
import { LineSymbolEditor } from "./LineSymbolEditor"
import { FillSymbolEditor } from "./FillSymbolEditor"
import { CategorizedEditor } from "./CategorizedEditor"
import { GraduatedEditor } from "./GraduatedEditor"
import { RuleBasedEditor } from "./RuleBasedEditor"
import { LabelEditor } from "./LabelEditor"
import { ScaleVisibility } from "./ScaleVisibility"

// ── Renderer type selector ────────────────────────────────────────────

const RENDERERS: { value: RendererType; label: string; icon: React.ReactNode }[] = [
  { value: "single", label: "Single", icon: <Circle size={11} /> },
  { value: "categorized", label: "Categ.", icon: <Layers size={11} /> },
  { value: "graduated", label: "Grad.", icon: <Square size={11} /> },
  { value: "rule-based", label: "Rules", icon: <BookOpen size={11} /> },
]

// ── Geometry icon ─────────────────────────────────────────────────────

function GeomBadge({ geom }: { geom: GeomFamily }) {
  const cls = "text-muted-foreground"
  if (geom === "point") return <Circle size={12} className={cls} />
  if (geom === "line") return <Minus size={12} className={cls} />
  return <Square size={12} className={cls} />
}

// ── Props ─────────────────────────────────────────────────────────────

interface StyleEditorPanelProps {
  layerKey: string
  onClose: () => void
}

export function StyleEditorPanel({ layerKey, onClose }: StyleEditorPanelProps) {
  const { datasetId, layerName } = parseLayerKey(layerKey)
  const datasets = useDatasetStore((s) => s.datasets)
  const setLayerStyleDef = useMapViewStore((s) => s.setLayerStyleDef)
  const clearLayerStyleDef = useMapViewStore((s) => s.clearLayerStyleDef)
  const layerStack = useMapViewStore((s) => {
    const view = s.views.find((v) => v.id === s.activeViewId) ?? s.views[0]
    return view?.state.layerStack ?? []
  })
  const t = useT()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Find layer metadata and current style
  const ds = datasets.find((d) => d.id === datasetId)
  const layerMeta = ds?.layers?.find((l) => l.name === layerName)
  const mapLayer = layerStack.find((l) => l.key === layerKey)

  const geom: GeomFamily = useMemo(
    () => geomFamily(layerMeta?.geometry_type ?? null),
    [layerMeta?.geometry_type],
  )

  const fields: LayerField[] = layerMeta?.fields ?? []

  // Resolve current styleDef — if none, create from legacy flat style
  const styleDef: LayerStyleDef = useMemo(() => {
    if (mapLayer?.styleDef) return mapLayer.styleDef
    if (mapLayer) {
      return fromLegacyStyle(
        { color: mapLayer.color, opacity: mapLayer.opacity, strokeColor: mapLayer.strokeColor, strokeWidth: mapLayer.strokeWidth },
        geom,
      )
    }
    return { renderer: "single", symbol: defaultSymbol(geom) }
  }, [mapLayer, geom])

  // Commit style changes to the store
  const commit = useCallback(
    (patch: Partial<LayerStyleDef>) => {
      setLayerStyleDef(layerKey, { ...styleDef, ...patch })
    },
    [layerKey, styleDef, setLayerStyleDef],
  )

  // ── Renderer switch ───────────────────────────────────────────────

  const handleRendererChange = useCallback(
    (renderer: RendererType) => {
      if (renderer === styleDef.renderer) return
      const base: LayerStyleDef = { renderer }
      if (renderer === "single") {
        base.symbol = styleDef.symbol ?? defaultSymbol(geom)
      } else if (renderer === "categorized") {
        base.classField = styleDef.classField ?? ""
        base.categories = styleDef.categories ?? []
      } else if (renderer === "graduated") {
        base.graduatedField = styleDef.graduatedField ?? ""
        base.classifyMethod = styleDef.classifyMethod ?? "equal_interval"
        base.classes = styleDef.classes ?? []
      } else if (renderer === "rule-based") {
        base.rules = styleDef.rules ?? []
      }
      // Preserve labels and scale across renderer switches
      if (styleDef.labeling) base.labeling = styleDef.labeling
      if (styleDef.minZoom != null) base.minZoom = styleDef.minZoom
      if (styleDef.maxZoom != null) base.maxZoom = styleDef.maxZoom
      setLayerStyleDef(layerKey, base)
    },
    [styleDef, geom, layerKey, setLayerStyleDef],
  )

  // ── Symbol change (single) ────────────────────────────────────────

  const handleSymbolChange = useCallback(
    (sym: SymbolDef) => commit({ symbol: sym }),
    [commit],
  )

  // ── QML import/export ─────────────────────────────────────────────

  const runImport = useCallback(
    async (file: File) => {
      setImporting(true)
      try {
        const result = await importQml(datasetId, layerName, file, geom)
        setLayerStyleDef(layerKey, result.style_def)
        toast.success(t("toast.qml_imported"), { description: file.name })
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        toast.error(t("toast.qml_import_failed"), { description: detail })
      } finally {
        setImporting(false)
      }
    },
    [datasetId, layerName, geom, layerKey, setLayerStyleDef, t],
  )

  const handleFilePicked = useCallback(
    (file: File | null) => {
      if (!file) return
      // Only show overwrite confirmation when the user already has a custom
      // style applied. fromLegacyStyle output is just default colour values,
      // not a deliberate styling choice — overwriting that is harmless.
      if (mapLayer?.styleDef) {
        setPendingImport(file)
      } else {
        void runImport(file)
      }
    },
    [mapLayer?.styleDef, runImport],
  )

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const safeDataset = (ds?.name ?? datasetId).replace(/[^a-z0-9_-]+/gi, "_")
      const safeLayer = layerName.replace(/[^a-z0-9_-]+/gi, "_")
      await exportQml(datasetId, layerName, `${safeDataset}-${safeLayer}.qml`)
      toast.success(t("toast.qml_exported"))
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      toast.error(t("toast.qml_export_failed"), { description: detail })
    } finally {
      setExporting(false)
    }
  }, [ds, datasetId, layerName, t])

  if (!ds || !layerMeta || !mapLayer) return null

  const displayName = mapLayer.displayName || layerName

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <GeomBadge geom={geom} />
        <span className="flex-1 text-xs font-medium truncate" title={displayName}>
          {displayName}
        </span>
        <span className="text-label-sm text-muted-foreground capitalize">{geom}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".qml,application/xml,text/xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            handleFilePicked(file)
            // reset so re-selecting the same file still triggers onChange
            e.target.value = ""
          }}
        />
        <IconButton
          label={t("style.import_qml")}
          disabled={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={12} />
        </IconButton>
        <IconButton
          label={t("style.export_qml")}
          disabled={exporting}
          onClick={handleExport}
        >
          <Download size={12} />
        </IconButton>
        <IconButton
          label="Reset to default style"
          onClick={() => { clearLayerStyleDef(layerKey); onClose() }}
        >
          <RotateCcw size={12} />
        </IconButton>
        <IconButton label="Close style editor" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>

      <ConfirmDialog
        open={pendingImport !== null}
        title={t("dialog.import_qml.title")}
        description={t("dialog.import_qml.body")}
        confirmLabel={t("dialog.import_qml.confirm")}
        cancelLabel={t("common.cancel")}
        variant="destructive"
        onConfirm={() => {
          const file = pendingImport
          setPendingImport(null)
          if (file) void runImport(file)
        }}
        onCancel={() => setPendingImport(null)}
      />

      {/* Renderer selector */}
      <div className="flex gap-0.5 px-3 py-1.5 border-b">
        {RENDERERS.map((r) => (
          <button
            key={r.value}
            onClick={() => handleRendererChange(r.value)}
            className={`flex items-center gap-1 flex-1 justify-center h-6 rounded text-label font-medium transition-colors ${
              styleDef.renderer === r.value
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {r.icon}
            {r.label}
          </button>
        ))}
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Single symbol editor — geometry-aware */}
        {styleDef.renderer === "single" && (
          <>
            {geom === "point" && (
              <PointSymbolEditor
                symbol={(styleDef.symbol as PointSymbol) ?? defaultSymbol("point") as PointSymbol}
                onChange={handleSymbolChange}
              />
            )}
            {geom === "line" && (
              <LineSymbolEditor
                symbol={(styleDef.symbol as LineSymbol) ?? defaultSymbol("line") as LineSymbol}
                onChange={handleSymbolChange}
              />
            )}
            {geom === "polygon" && (
              <FillSymbolEditor
                symbol={(styleDef.symbol as FillSymbol) ?? defaultSymbol("polygon") as FillSymbol}
                onChange={handleSymbolChange}
              />
            )}
            {geom === "mixed" && (
              <>
                <FillSymbolEditor
                  symbol={(styleDef.symbol as FillSymbol) ?? defaultSymbol("polygon") as FillSymbol}
                  onChange={handleSymbolChange}
                />
              </>
            )}
          </>
        )}

        {/* Categorized editor */}
        {styleDef.renderer === "categorized" && (
          <CategorizedEditor
            geom={geom}
            fields={fields}
            datasetId={datasetId}
            layerName={layerName}
            classField={styleDef.classField ?? ""}
            categories={styleDef.categories ?? []}
            onFieldChange={(f) => commit({ classField: f })}
            onCategoriesChange={(cats) => commit({ categories: cats })}
          />
        )}

        {/* Graduated editor */}
        {styleDef.renderer === "graduated" && (
          <GraduatedEditor
            geom={geom}
            fields={fields}
            datasetId={datasetId}
            layerName={layerName}
            graduatedField={styleDef.graduatedField ?? ""}
            classifyMethod={styleDef.classifyMethod ?? "equal_interval"}
            colorRamp={styleDef.colorRamp}
            classes={styleDef.classes ?? []}
            onFieldChange={(f) => commit({ graduatedField: f })}
            onMethodChange={(m) => commit({ classifyMethod: m })}
            onRampChange={(r) => commit({ colorRamp: r })}
            onClassesChange={(cls) => commit({ classes: cls })}
          />
        )}

        {/* Rule-based editor */}
        {styleDef.renderer === "rule-based" && (
          <RuleBasedEditor
            geom={geom}
            fields={fields}
            rules={styleDef.rules ?? []}
            onRulesChange={(rules) => commit({ rules })}
          />
        )}

        {/* Separator */}
        <div className="h-px bg-border" />

        {/* Labels — available for all renderer types */}
        <LabelEditor
          label={styleDef.labeling ?? { enabled: false, field: "", color: "#000000", fontSize: 11 }}
          fields={fields}
          onChange={(labeling) => commit({ labeling })}
        />

        {/* Scale visibility */}
        <ScaleVisibility
          minZoom={styleDef.minZoom}
          maxZoom={styleDef.maxZoom}
          onChange={(minZoom, maxZoom) => commit({ minZoom, maxZoom })}
        />
      </div>
    </div>
  )
}
