/**
 * NodeEditorToolbar — Grouped toolbar for the node editor.
 *
 * Sprint W1: reorganized into logical groups (File | Edit | View | Run).
 * Sprint W2: added Undo/Redo, Auto-layout, Snap to grid.
 */

import { useCallback, useState } from "react"
import {
  Save,
  Download,
  Upload,
  CheckCircle,
  Group,
  Ungroup,
  Bug,
  Play,
  X,
  Bookmark,
  Undo2,
  Redo2,
  LayoutDashboard,
  Grid3x3,
  Maximize2,
  GitBranch,
  Workflow,
} from "lucide-react"

export type EditorMode = "scenario" | "pipeline"

interface NodeEditorToolbarProps {
  pipelineName: string
  onPipelineNameChange: (name: string) => void
  onValidate: () => void
  onSave: () => void
  onSaveTemplate: () => void
  onExportJSON: () => void
  onImportPipelineV2?: () => void
  onExportPipelineV2?: () => void
  onRun: () => void
  onClearResults: () => void
  debugMode: boolean
  onDebugToggle: () => void
  isRunning: boolean
  isDirty: boolean
  hasResults: boolean
  onGroupSelection?: () => void
  onUngroupSelection?: () => void
  // Sprint W2
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  onAutoLayout?: () => void
  snapToGrid?: boolean
  onSnapToggle?: () => void
  onZoomFit?: () => void
  // Pipeline mode (#406)
  editorMode?: EditorMode
  onModeChange?: (mode: EditorMode) => void
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function TBtn({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  accent,
  title,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label?: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  accent?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-40 disabled:pointer-events-none ${
        accent
          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
          : active
            ? "border border-primary bg-primary/10 text-primary"
            : "border border-border bg-background hover:bg-muted text-foreground"
      }`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label && <span>{label}</span>}
    </button>
  )
}

function Separator() {
  return <div className="w-px h-5 bg-border mx-0.5" />
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

export function NodeEditorToolbar({
  pipelineName,
  onPipelineNameChange,
  onValidate,
  onSave,
  onSaveTemplate,
  onExportJSON,
  onImportPipelineV2,
  onExportPipelineV2,
  onRun,
  onClearResults,
  debugMode,
  onDebugToggle,
  isRunning,
  isDirty,
  hasResults,
  onGroupSelection,
  onUngroupSelection,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAutoLayout,
  snapToGrid,
  onSnapToggle,
  onZoomFit,
  editorMode = "scenario",
  onModeChange,
}: NodeEditorToolbarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(pipelineName)

  const startEditing = useCallback(() => {
    setEditValue(pipelineName)
    setIsEditing(true)
  }, [pipelineName])

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim()
    if (trimmed) {
      onPipelineNameChange(trimmed)
    }
    setIsEditing(false)
  }, [editValue, onPipelineNameChange])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitEdit()
      if (e.key === "Escape") setIsEditing(false)
    },
    [commitEdit],
  )

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-background/90 backdrop-blur-sm gap-2 min-h-[40px]">
      {/* Left: Mode toggle + File + Edit groups */}
      <div className="flex items-center gap-1">
        {/* Mode toggle */}
        {onModeChange && (
          <>
            <button
              onClick={() => onModeChange(editorMode === "scenario" ? "pipeline" : "scenario")}
              title={editorMode === "pipeline" ? "Switch to Scenario mode" : "Switch to Pipeline mode"}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors border ${
                editorMode === "pipeline"
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {editorMode === "pipeline" ? (
                <><GitBranch className="h-3 w-3" /> Pipeline v2</>
              ) : (
                <><Workflow className="h-3 w-3" /> Scenario</>
              )}
            </button>
            <Separator />
          </>
        )}

        {/* File */}
        <TBtn icon={Save} label="Save" onClick={onSave} title="Save workflow (Ctrl+S)" />
        <TBtn icon={Bookmark} onClick={onSaveTemplate} title="Save as template" />
        <TBtn icon={Download} onClick={onExportJSON} title="Export as JSON" />
        {editorMode === "pipeline" && onImportPipelineV2 && (
          <TBtn icon={Upload} onClick={onImportPipelineV2} title="Import PipelineSpec v2 JSON" />
        )}
        {editorMode === "pipeline" && onExportPipelineV2 && (
          <TBtn icon={GitBranch} onClick={onExportPipelineV2} title="Export as PipelineSpec v2 JSON" />
        )}

        <Separator />

        {/* Edit */}
        {onUndo && (
          <TBtn icon={Undo2} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" />
        )}
        {onRedo && (
          <TBtn icon={Redo2} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" />
        )}
        <TBtn icon={CheckCircle} label="Validate" onClick={onValidate} title="Validate pipeline" />
        {onGroupSelection && (
          <TBtn icon={Group} onClick={onGroupSelection} title="Group selected (Ctrl+G)" />
        )}
        {onUngroupSelection && (
          <TBtn icon={Ungroup} onClick={onUngroupSelection} title="Ungroup selected" />
        )}

        <Separator />

        {/* View */}
        {onAutoLayout && (
          <TBtn icon={LayoutDashboard} onClick={onAutoLayout} title="Auto-layout (dagre)" />
        )}
        {onSnapToggle && (
          <TBtn icon={Grid3x3} onClick={onSnapToggle} active={snapToGrid} title="Snap to grid" />
        )}
        {onZoomFit && (
          <TBtn icon={Maximize2} onClick={onZoomFit} title="Zoom to fit (Ctrl+Shift+F)" />
        )}
        <TBtn icon={Bug} onClick={onDebugToggle} active={debugMode} title="Debug overlay" />
        {hasResults && (
          <TBtn icon={X} label="Clear" onClick={onClearResults} title="Clear results" />
        )}
      </div>

      {/* Center: pipeline name + dirty indicator */}
      <div className="flex-1 flex justify-center items-center gap-2">
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
            autoFocus
            className="text-sm font-semibold text-center bg-transparent border-b-2 border-primary outline-none px-2 py-0.5 min-w-[200px] text-foreground"
          />
        ) : (
          <button
            onClick={startEditing}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-text px-2 py-0.5"
            title="Click to rename pipeline"
          >
            {pipelineName}
          </button>
        )}
        {isDirty && (
          <span
            className="inline-block w-2 h-2 rounded-full bg-amber-500"
            title="Unsaved changes"
          />
        )}
      </div>

      {/* Right: Run */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onRun}
          disabled={isRunning}
          className={`px-3 py-1 text-xs font-semibold rounded text-white transition-colors flex items-center gap-1.5 ${
            isRunning
              ? "bg-emerald-400 cursor-not-allowed opacity-60"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {isRunning ? (
            <svg
              className="animate-spin h-3 w-3 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <Play className="h-3 w-3" />
          )}
          {isRunning ? "Running..." : editorMode === "pipeline" ? "Run Pipeline" : "Run"}
        </button>
      </div>
    </div>
  )
}
