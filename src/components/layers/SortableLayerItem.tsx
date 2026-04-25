import { useCallback } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"

export function SortableLayerItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Set native drag data so groups can accept drops via HTML DnD
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-layer-key", id)
    e.dataTransfer.effectAllowed = "move"
  }, [id])

  return (
    <div ref={setNodeRef} style={style} {...attributes} draggable onDragStart={handleDragStart}>
      <div className="flex items-center">
        <div {...listeners} className="cursor-grab active:cursor-grabbing px-0.5 text-muted-foreground/40 hover:text-muted-foreground">
          <GripVertical size={12} />
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
