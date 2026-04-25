import { memo, useState, useCallback } from "react"
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react"

const COLOR_PRESETS: Record<string, { border: string; bg: string; text: string; handle: string }> = {
  blue: {
    border: "border-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-600 dark:text-blue-400",
    handle: "!bg-blue-500",
  },
  green: {
    border: "border-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-600 dark:text-emerald-400",
    handle: "!bg-emerald-500",
  },
  orange: {
    border: "border-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-600 dark:text-orange-400",
    handle: "!bg-orange-500",
  },
}

export const GroupNode = memo(function GroupNode({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>
  const [name, setName] = useState<string>((d.label as string) ?? "Group")
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const colorKey = (d.color as string) ?? "blue"
  const colors = COLOR_PRESETS[colorKey] ?? COLOR_PRESETS.blue
  const childCount = (d.childCount as number) ?? 0

  const commitName = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) setName("Group")
    setEditing(false)
  }, [name])

  if (collapsed) {
    return (
      <div
        className={`rounded-lg border-2 ${colors.border} ${colors.bg} px-4 py-3 shadow-sm min-w-[140px]`}
      >
        <Handle
          type="target"
          position={Position.Left}
          className={`!w-3 !h-3 ${colors.handle} !border-2 !border-white dark:!border-gray-900`}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(false)}
            className={`text-xs ${colors.text} hover:opacity-80`}
            title="Expand group"
          >
            {"\u25B6"}
          </button>
          <span className={`text-xs font-semibold ${colors.text}`}>{name}</span>
          <span className="text-label text-muted-foreground ml-auto">
            {childCount} node{childCount !== 1 ? "s" : ""}
          </span>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className={`!w-3 !h-3 ${colors.handle} !border-2 !border-white dark:!border-gray-900`}
        />
      </div>
    )
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineClassName="!border-blue-400"
        handleClassName="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
      />
      <div
        className={`rounded-xl border-2 ${colors.border} ${colors.bg} h-full w-full min-w-[200px] min-h-[120px]`}
      >
        <Handle
          type="target"
          position={Position.Left}
          className={`!w-3 !h-3 ${colors.handle} !border-2 !border-white dark:!border-gray-900`}
        />
        {/* Header bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-inherit">
          <button
            onClick={() => setCollapsed(true)}
            className={`text-xs ${colors.text} hover:opacity-80`}
            title="Collapse group"
          >
            {"\u25BC"}
          </button>
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              colorKey === "blue"
                ? "bg-blue-500"
                : colorKey === "green"
                  ? "bg-emerald-500"
                  : "bg-orange-500"
            }`}
          />
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName()
                if (e.key === "Escape") {
                  setName((d.label as string) ?? "Group")
                  setEditing(false)
                }
              }}
              autoFocus
              className="nodrag text-xs font-semibold bg-transparent border-b border-current outline-none px-0.5 min-w-[60px] text-foreground"
            />
          ) : (
            <button
              onDoubleClick={() => setEditing(true)}
              className={`text-xs font-semibold ${colors.text} cursor-text`}
              title="Double-click to rename"
            >
              {name}
            </button>
          )}
        </div>
        {/* Body is empty — child nodes render inside via ReactFlow parentId */}
        <Handle
          type="source"
          position={Position.Right}
          className={`!w-3 !h-3 ${colors.handle} !border-2 !border-white dark:!border-gray-900`}
        />
      </div>
    </>
  )
})
