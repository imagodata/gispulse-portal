import { useState } from "react"
import { Film, Save, RotateCcw, Trash2, Pencil, Check, X, Clock, Plus, Copy, Layers } from "lucide-react"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useMapViewStore } from "@/stores/mapViewStore"

// ---------- Helpers ----------

function formatDate(epoch: number): string {
  const d = new Date(epoch)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

// ---------- View Row ----------

function ViewRow({
  id,
  name,
  isActive,
  layerCount,
  createdAt,
  onSwitch,
  onDelete,
  onRename,
  onDuplicate,
}: {
  id: string
  name: string
  isActive: boolean
  layerCount: number
  createdAt: number
  onSwitch: () => void
  onDelete: () => void
  onRename: (name: string) => void
  onDuplicate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  function commitRename() {
    onRename(draft)
    setEditing(false)
  }

  function cancelRename() {
    setDraft(name)
    setEditing(false)
  }

  return (
    <div
      key={id}
      onClick={() => !editing && onSwitch()}
      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors cursor-pointer ${
        isActive ? "bg-primary/10 text-foreground" : "hover:bg-accent/50"
      }`}
    >
      {/* Icon */}
      <Layers size={12} className={`shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/60"}`} />

      {/* Name / edit field */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") cancelRename()
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-background border border-primary rounded px-1 py-0 text-xs focus:outline-none"
          />
        ) : (
          <div className="truncate text-xs font-medium">{name}</div>
        )}
        <div className="flex items-center gap-1 text-label text-muted-foreground/50">
          <span>{layerCount} layer{layerCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Actions */}
      {editing ? (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); commitRename() }}
            className="h-5 w-5 flex items-center justify-center rounded text-green-500 hover:bg-green-500/10 transition-colors"
            title="Confirm"
          >
            <Check size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); cancelRename() }}
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent transition-colors"
            title="Cancel"
          >
            <X size={11} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate() }}
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Duplicate view"
          >
            <Copy size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDraft(name); setEditing(true) }}
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Rename"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
            title="Delete view"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- Snapshot Row ----------

function SnapshotRow({
  name,
  createdAt,
  onRestore,
  onDelete,
}: {
  name: string
  createdAt: number
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors">
      <Film size={12} className="shrink-0 text-muted-foreground/60" />
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs font-medium">{name}</div>
        <div className="flex items-center gap-1 text-label text-muted-foreground/50">
          <Clock size={8} />
          {formatDate(createdAt)}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onRestore}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Restore snapshot"
        >
          <RotateCcw size={11} />
        </button>
        <button
          onClick={onDelete}
          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
          title="Delete snapshot"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

// ---------- SceneManager (now ViewManager) ----------

export function SceneManager() {
  const { views, activeViewId, snapshots, createView, deleteView, switchView, renameView, duplicateView, saveSnapshot, deleteSnapshot, restoreSnapshot } = useMapViewStore()
  const [newViewName, setNewViewName] = useState("")
  const [snapshotName, setSnapshotName] = useState("")

  function handleCreateView() {
    const view = createView(newViewName)
    setNewViewName("")
    toast.success(`View "${view.name}" created`)
  }

  function handleSaveSnapshot() {
    saveSnapshot(snapshotName)
    setSnapshotName("")
    toast.success("Snapshot saved")
  }

  function handleDeleteView(id: string) {
    const view = views.find((v) => v.id === id)
    if (views.length <= 1) {
      toast.error("Cannot delete the last view")
      return
    }
    deleteView(id)
    toast.success(`View "${view?.name}" deleted`)
  }

  function handleRestoreSnapshot(index: number) {
    restoreSnapshot(index)
    toast.success("Snapshot restored to active view")
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Map Views</h3>
        {views.length > 0 && (
          <span className="text-label text-muted-foreground/50">{views.length} view{views.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Create new view */}
      <div className="flex items-center gap-1.5 border-b px-3 py-2">
        <input
          value={newViewName}
          onChange={(e) => setNewViewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreateView() }}
          placeholder={`View ${views.length + 1}`}
          className="flex-1 min-w-0 bg-muted/50 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs gap-1 shrink-0"
          onClick={handleCreateView}
          title="Create new view"
        >
          <Plus size={11} />
          New
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* View list */}
        <div className="p-2 space-y-0.5">
          <p className="text-label-sm font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 mb-1">Views</p>
          {views.map((v) => (
            <ViewRow
              key={v.id}
              id={v.id}
              name={v.name}
              isActive={v.id === activeViewId}
              layerCount={v.state.layerStack.length}
              createdAt={v.createdAt}
              onSwitch={() => switchView(v.id)}
              onDelete={() => handleDeleteView(v.id)}
              onRename={(name) => renameView(v.id, name)}
              onDuplicate={() => {
                const dup = duplicateView(v.id, `${v.name} (copy)`)
                toast.success(`View "${dup.name}" created`)
              }}
            />
          ))}
        </div>

        {/* Snapshots section */}
        <div className="p-2 space-y-0.5 border-t">
          <div className="flex items-center justify-between px-2 mb-1">
            <p className="text-label-sm font-semibold uppercase tracking-wider text-muted-foreground/60">Snapshots</p>
            {snapshots.length > 0 && (
              <span className="text-label text-muted-foreground/50">{snapshots.length}</span>
            )}
          </div>

          {/* Save snapshot */}
          <div className="flex items-center gap-1.5 px-2 mb-1">
            <input
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveSnapshot() }}
              placeholder={`Snapshot ${snapshots.length + 1}`}
              className="flex-1 min-w-0 bg-muted/50 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs gap-1 shrink-0"
              onClick={handleSaveSnapshot}
              title="Save current view as snapshot"
            >
              <Save size={11} />
            </Button>
          </div>

          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-4 text-muted-foreground/50">
              <Film size={20} strokeWidth={1.2} />
              <p className="text-xs text-center">No snapshots yet.</p>
            </div>
          ) : (
            [...snapshots].reverse().map((s, reverseIdx) => {
              const actualIdx = snapshots.length - 1 - reverseIdx
              return (
                <SnapshotRow
                  key={`${s.createdAt}-${actualIdx}`}
                  name={s.name}
                  createdAt={s.createdAt}
                  onRestore={() => handleRestoreSnapshot(actualIdx)}
                  onDelete={() => { deleteSnapshot(actualIdx); toast.success("Snapshot deleted") }}
                />
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
