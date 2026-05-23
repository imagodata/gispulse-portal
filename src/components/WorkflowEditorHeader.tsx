/**
 * WorkflowEditorHeader — Top bar shown when editing a workflow.
 *
 * Sprint W1: Back button to list, workflow name, export/import actions.
 */

import { useRef, useCallback } from "react"
import { ArrowLeft, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useWorkflowStore } from "@/stores/workflowStore"
import { useEditorStore } from "@/stores/editorStore"

export function WorkflowEditorHeader() {
  const setView = useWorkflowStore((s) => s.setView)
  const activeWorkflowName = useWorkflowStore((s) => s.activeWorkflowName)
  const fetchWorkflows = useWorkflowStore((s) => s.fetchWorkflows)
  const isGraphDirty = useEditorStore((s) => s.isGraphDirty)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleBack = useCallback(() => {
    if (isGraphDirty) {
      if (!confirm("You have unsaved changes. Leave anyway?")) return
    }
    // Clear editor state
    const editorState = useEditorStore.getState()
    editorState.setActiveScenarioId(null)
    editorState.setGraphDirty(false)
    editorState.clearNodeExecStates()
    editorState.setPendingGraph(null)
    useWorkflowStore.getState().setActiveWorkflow(null, null)
    setView("list")
    fetchWorkflows()
  }, [isGraphDirty, setView, fetchWorkflows])

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const { parseImport } = useWorkflowStore.getState()
        const parsed = parseImport(text)
        if (!parsed) {
          toast.error("Invalid workflow file format")
          return
        }
        const { deserializeGraph } = await import("@/lib/graphSerializer")
        const graph = deserializeGraph(parsed.graph)
        useEditorStore.getState().setPendingGraph(graph)
        toast.success(`Imported "${parsed.name}"`)
      } catch (err) {
        toast.error(
          `Import failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    [],
  )

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-background/95 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5"
        onClick={handleBack}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Workflows
      </Button>

      <div className="h-4 w-px bg-border" />

      <span className="text-sm font-medium text-foreground truncate">
        {activeWorkflowName || "Untitled Workflow"}
      </span>

      {isGraphDirty && (
        <span
          className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0"
          title="Unsaved changes"
        />
      )}

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1.5 text-muted-foreground"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-3 w-3" />
        Import
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.workflow.json"
        className="hidden"
        onChange={handleImportFile}
      />
    </div>
  )
}
