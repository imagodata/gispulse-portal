import { Eye, EyeOff, FolderPlus, Trash2, X } from "lucide-react"
import { IconButton } from "@/components/ui/icon-button"
import { toast } from "sonner"
import type { LayerVisibility } from "@/types/project"

export function BulkActionsBar({
  selectedKeys,
  layerVisibility,
  setLayerVisible,
  bulkRemoveLayerEntries,
  bulkRestoreLayerEntries,
  createLayerGroup,
  clearLayerSelection,
}: {
  selectedKeys: Set<string>
  layerVisibility: Record<string, LayerVisibility>
  setLayerVisible: (key: string, visible: boolean) => void
  bulkRemoveLayerEntries: (keys: string[]) => void
  bulkRestoreLayerEntries: (entries: Record<string, LayerVisibility>) => void
  createLayerGroup: (name: string, keys: string[]) => void
  clearLayerSelection: () => void
}) {
  const keys = [...selectedKeys]
  const allVisible = keys.every((k) => layerVisibility[k]?.visible ?? true)

  const handleToggleVisibility = () => {
    const target = !allVisible
    for (const key of keys) setLayerVisible(key, target)
  }

  const handleGroup = () => {
    createLayerGroup("Group", keys)
    clearLayerSelection()
  }

  const handleDelete = () => {
    const snapshot: Record<string, LayerVisibility> = {}
    for (const k of keys) {
      if (layerVisibility[k]) snapshot[k] = { ...layerVisibility[k] }
    }
    bulkRemoveLayerEntries(keys)
    clearLayerSelection()
    toast.info(`${keys.length} layer${keys.length > 1 ? "s" : ""} removed`, {
      action: {
        label: "Undo",
        onClick: () => bulkRestoreLayerEntries(snapshot),
      },
      duration: 5000,
    })
  }

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-primary/5 shrink-0">
      <span className="text-label text-primary/80 flex-1 font-medium">{keys.length} selected</span>
      <IconButton label={allVisible ? "Hide selected layers" : "Show selected layers"} onClick={handleToggleVisibility}>
        {allVisible ? <EyeOff size={12} /> : <Eye size={12} />}
      </IconButton>
      <IconButton label="Group selected layers" onClick={handleGroup}>
        <FolderPlus size={12} />
      </IconButton>
      <IconButton label="Delete selected layers" variant="destructive" onClick={handleDelete}>
        <Trash2 size={12} />
      </IconButton>
      <IconButton label="Clear selection" onClick={clearLayerSelection} className="text-muted-foreground/60">
        <X size={12} />
      </IconButton>
    </div>
  )
}
