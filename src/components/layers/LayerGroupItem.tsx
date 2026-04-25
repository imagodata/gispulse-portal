import { useState, useRef, useEffect, useCallback } from "react"
import { Eye, EyeOff, X, ChevronDown, ChevronRight, Folder, Pencil } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { useMapViewStore, useActiveLayerStack } from "@/stores/mapViewStore"

export function LayerGroupItem({ groupId, group, children, onDropLayer }: {
  groupId: string
  group: { name: string; collapsed: boolean; layers: string[] }
  children: React.ReactNode
  onDropLayer?: (groupId: string, layerKey: string) => void
}) {
  const { toggleGroupCollapsed, toggleGroupVisibility, deleteLayerGroup, renameLayerGroup } = useMapViewStore()
  const layerStack = useActiveLayerStack()

  const allVisible = group.layers.every((k) => {
    const layer = layerStack.find((l) => l.key === k)
    return layer ? layer.visible : true
  })

  // Inline rename state
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(group.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== group.name) {
      renameLayerGroup(groupId, trimmed)
    }
    setEditing(false)
  }, [editValue, group.name, groupId, renameLayerGroup])

  // Drop zone state
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const data = e.dataTransfer.types.includes("application/x-layer-key")
    if (data) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const layerKey = e.dataTransfer.getData("application/x-layer-key")
    if (layerKey && onDropLayer) {
      onDropLayer(groupId, layerKey)
    }
  }, [groupId, onDropLayer])

  return (
    <div className="mb-1">
      <div
        className={`group flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent/50 rounded-md transition-colors ${dragOver ? "ring-1 ring-primary bg-primary/10" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button onClick={() => toggleGroupCollapsed(groupId)} className="shrink-0">
          {group.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
        <Folder size={12} className="shrink-0 text-muted-foreground/60" />

        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") { setEditValue(group.name); setEditing(false) }
            }}
            className="flex-1 min-w-0 bg-transparent border-b border-primary/50 text-xs outline-none px-0.5"
          />
        ) : (
          <span
            className="flex-1 truncate cursor-default"
            onDoubleClick={() => { setEditValue(group.name); setEditing(true) }}
          >
            {group.name}
          </span>
        )}

        <span className="text-label-sm text-muted-foreground/40 tabular-nums">{group.layers.length}</span>

        <IconButton
          label="Rename group"
          onClick={() => { setEditValue(group.name); setEditing(true) }}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/50"
        >
          <Pencil size={10} />
        </IconButton>
        <IconButton
          label={allVisible ? "Hide group" : "Show group"}
          onClick={() => toggleGroupVisibility(groupId)}
          className={`shrink-0 ${allVisible ? "text-primary" : "text-muted-foreground/40"}`}
        >
          {allVisible ? <Eye size={12} /> : <EyeOff size={12} />}
        </IconButton>
        <IconButton
          label="Delete group"
          variant="destructive"
          onClick={() => deleteLayerGroup(groupId)}
          className="shrink-0 opacity-0 group-hover:opacity-100"
        >
          <X size={10} />
        </IconButton>
      </div>
      {!group.collapsed && (
        <div className="ml-4 border-l border-border/50 pl-1">
          {group.layers.length === 0 && (
            <div
              className={`flex items-center justify-center rounded-md border border-dashed py-2 text-label text-muted-foreground/40 transition-colors ${dragOver ? "border-primary/50 text-primary/60" : "border-muted-foreground/20"}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              Drop layers here
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
