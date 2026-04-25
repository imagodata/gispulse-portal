import { useEffect, useState, useCallback, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SchemaForm } from "@/components/rules/SchemaForm"
import { useEditorStore } from "@/stores/editorStore"
import { useProjectStore } from "@/stores/projectStore"
import { listCapabilities, updateRuleApi } from "@/api/client"
import type { CapabilitySchema } from "@/types/dataset"
import type { JsonSchema } from "@/types/editor"

export function RuleEditorModal() {
  const { ruleEditorOpen, ruleEditorId, closeRuleEditor } = useEditorStore()
  const rules = useProjectStore((s) => s.rules)
  const createRule = useProjectStore((s) => s.createRule)
  const fetchRules = useProjectStore((s) => s.fetchRules)

  const [capabilities, setCapabilities] = useState<CapabilitySchema[]>([])
  const [capLoading, setCapLoading] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [scope, setScope] = useState("")
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null)
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  const isEditing = ruleEditorId !== null
  const existingRule = isEditing ? rules.find((r) => r.id === ruleEditorId) : null

  const modalRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  // Capture trigger element and handle focus management
  useEffect(() => {
    if (ruleEditorOpen) {
      triggerRef.current = document.activeElement as HTMLElement
      // Focus the modal container on next tick
      requestAnimationFrame(() => modalRef.current?.focus())
    } else if (triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [ruleEditorOpen])

  // Escape key to close + focus trap
  useEffect(() => {
    if (!ruleEditorOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRuleEditor()
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [ruleEditorOpen, closeRuleEditor])

  // Load capabilities when modal opens
  useEffect(() => {
    if (!ruleEditorOpen) return
    setCapLoading(true)
    listCapabilities()
      .then(setCapabilities)
      .catch((err) => {
        console.error("Failed to load capabilities:", err)
        toast.error("Failed to load capabilities")
        setCapabilities([])
      })
      .finally(() => setCapLoading(false))
  }, [ruleEditorOpen])

  // Populate form when editing an existing rule
  useEffect(() => {
    if (!ruleEditorOpen) return
    if (existingRule) {
      setName(existingRule.name)
      setDescription(existingRule.description)
      setScope(existingRule.scope)
      setSelectedCapability(existingRule.capability)
      setConfig({ ...existingRule.config })
    } else {
      setName("")
      setDescription("")
      setScope("")
      setSelectedCapability(null)
      setConfig({})
    }
  }, [ruleEditorOpen, existingRule])

  const handleConfigChange = useCallback((key: string, val: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: val }))
  }, [])

  const selectedSchema: JsonSchema | null = selectedCapability
    ? (capabilities.find((c) => c.name === selectedCapability)?.json_schema as JsonSchema) ?? null
    : null

  const canSave = name.trim() !== "" && selectedCapability !== null

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        scope: scope.trim(),
        capability: selectedCapability!,
        config,
        enabled: existingRule?.enabled ?? true,
      }
      if (isEditing && ruleEditorId) {
        await updateRuleApi(ruleEditorId, payload)
        await fetchRules()
      } else {
        await createRule(payload)
      }
      closeRuleEditor()
    } catch (err) {
      console.error("Failed to save rule:", err)
      toast.error(`Failed to save rule: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  if (!ruleEditorOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeRuleEditor}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-editor-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-[720px] max-h-[85vh] flex flex-col rounded-lg border bg-background shadow-lg outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="rule-editor-title" className="text-sm font-semibold">
            {isEditing ? "Edit Rule" : "New Rule"}
          </h2>
          <button
            onClick={closeRuleEditor}
            aria-label="Close rule editor"
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-sm"
          >
            {"\u2715"}
          </button>
        </div>

        {/* Body: 2 columns */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left column: metadata + capability picker */}
          <div className="w-1/2 border-r flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {/* Name */}
                <div className="space-y-1">
                  <label htmlFor="rule-editor-name" className="text-xs font-medium">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="rule-editor-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Buffer 50m on roads"
                    className="text-xs"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label htmlFor="rule-editor-description" className="text-xs font-medium">Description</label>
                  <Input
                    id="rule-editor-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    className="text-xs"
                  />
                </div>

                {/* Scope */}
                <div className="space-y-1">
                  <label htmlFor="rule-editor-scope" className="text-xs font-medium">Scope</label>
                  <Input
                    id="rule-editor-scope"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    placeholder="e.g. layer:roads or *"
                    className="text-xs"
                  />
                  <p className="text-label text-muted-foreground">
                    Target scope for rule execution
                  </p>
                </div>

                {/* Capability picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    Capability <span className="text-destructive">*</span>
                  </label>
                  {capLoading ? (
                    <p className="text-xs text-muted-foreground py-2">
                      Loading capabilities...
                    </p>
                  ) : capabilities.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      No capabilities available. Is the backend running?
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {capabilities.map((cap) => {
                        const isSelected = selectedCapability === cap.name
                        return (
                          <button
                            key={cap.name}
                            onClick={() => {
                              setSelectedCapability(cap.name)
                              // Reset config when switching capability
                              if (!isSelected) setConfig({})
                            }}
                            className={`text-left rounded-md border p-2 transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="text-xs font-medium truncate">
                              {cap.name}
                            </div>
                            {cap.description && (
                              <div className="text-label text-muted-foreground line-clamp-2 mt-0.5">
                                {cap.description}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Right column: dynamic schema form */}
          <div className="w-1/2 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4">
                {selectedCapability ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-xs font-semibold">Configuration</h3>
                      <Badge variant="secondary" className="text-label-sm">
                        {selectedCapability}
                      </Badge>
                    </div>
                    {selectedSchema ? (
                      <SchemaForm
                        schema={selectedSchema}
                        value={config}
                        onChange={handleConfigChange}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No schema available for this capability.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-40">
                    <p className="text-xs text-muted-foreground">
                      Select a capability to configure parameters
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={closeRuleEditor}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}
