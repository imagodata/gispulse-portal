/**
 * Dialog for saving the current node editor graph as a reusable template.
 */

import { useState, useEffect } from "react"
import type { Node, Edge } from "@xyflow/react"
import { toast } from "sonner"
import { X } from "lucide-react"
import {
  snapshotToTemplate,
  useTemplateStore,
  type NodeTemplate,
} from "@/stores/templateStore"

const DOMAINS: { value: NodeTemplate["domain"]; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "ftth", label: "FTTH" },
  { value: "urbanisme", label: "Urbanisme" },
  { value: "environnement", label: "Environnement" },
  { value: "generic", label: "Generic" },
]

interface SaveTemplateDialogProps {
  open: boolean
  onClose: () => void
  nodes: Node[]
  edges: Edge[]
  defaultName?: string
}

export function SaveTemplateDialog({
  open,
  onClose,
  nodes,
  edges,
  defaultName = "",
}: SaveTemplateDialogProps) {
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState("")
  const [domain, setDomain] = useState<NodeTemplate["domain"]>("custom")
  const saveTemplate = useTemplateStore((s) => s.saveTemplate)

  // Keyboard: close on Escape (#197)
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  const realNodes = nodes.filter((n) => n.type !== "group")
  const canSave = name.trim().length > 0 && realNodes.length > 0

  const handleSave = () => {
    if (!canSave) return
    const tpl = snapshotToTemplate(nodes, edges, {
      name: name.trim(),
      description: description.trim(),
      domain,
    })
    saveTemplate(tpl)
    toast.success(`Template "${tpl.name}" saved (${realNodes.length} nodes)`)
    onClose()
    // Reset for next use
    setName("")
    setDescription("")
    setDomain("custom")
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-template-title"
    >
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 id="save-template-title" className="text-sm font-semibold text-foreground">Save as Template</h3>
          <button
            onClick={onClose}
            aria-label="Close save template dialog"
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          <div>
            <label htmlFor="save-template-name" className="block text-xs font-medium text-muted-foreground mb-1">
              Name
            </label>
            <input
              id="save-template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My pipeline template"
              autoFocus
              className="w-full px-2.5 py-1.5 text-sm rounded border border-border bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="save-template-description" className="block text-xs font-medium text-muted-foreground mb-1">
              Description
            </label>
            <textarea
              id="save-template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this template do?"
              rows={2}
              className="w-full px-2.5 py-1.5 text-sm rounded border border-border bg-background text-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div>
            <label htmlFor="save-template-domain" className="block text-xs font-medium text-muted-foreground mb-1">
              Domain
            </label>
            <select
              id="save-template-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value as NodeTemplate["domain"])}
              className="w-full px-2.5 py-1.5 text-sm rounded border border-border bg-background text-foreground outline-none focus:ring-1 focus:ring-primary"
            >
              {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-muted-foreground">
            {realNodes.length} node{realNodes.length !== 1 ? "s" : ""},{" "}
            {edges.length} edge{edges.length !== 1 ? "s" : ""} will be saved.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded border border-border bg-background hover:bg-muted transition-colors text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  )
}
