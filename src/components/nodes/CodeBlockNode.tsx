import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react"
import { PORT_COLORS } from "./portTypes"
import { StatusBadge } from "./StatusBadge"
import type { NodeExecStatus } from "@/stores/editorStore"
import { nodeContainerClass, nodeHeaderClass } from "./nodeStyles"
import { Code } from "lucide-react"

const LANGUAGES = ["Python", "SQL", "Expression"] as const

export function CodeBlockNode({ id, data }: NodeProps) {
  const d = data as Record<string, unknown>
  const { setNodes } = useReactFlow()

  const language = (d.language as string) ?? "Python"
  const code = (d.code as string) ?? ""

  const update = (key: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) => n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n)
    )
  }

  // Show first meaningful line as preview
  const preview = code.split("\n").find((l) => l.trim() && !l.trim().startsWith("#"))?.trim() ?? ""

  return (
    <div className={nodeContainerClass("code")}>
      <Handle type="target" position={Position.Left} className={`!w-3 !h-3 ${PORT_COLORS.any} !border-2 !border-white dark:!border-gray-900`} />

      <div className={nodeHeaderClass("code")}>
        <Code className="h-3 w-3 inline mr-1 -mt-0.5" />
        Code
      </div>
      <div className="text-xs font-semibold text-foreground truncate">
        {(d.label as string) ?? "Code Block"}
      </div>

      {/* Language selector */}
      <div className="mt-1.5 flex gap-0.5 rounded border border-[var(--gp-node-code)]/30 p-0.5">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={(e) => { e.stopPropagation(); update("language", lang) }}
            className={`nodrag flex-1 px-1.5 py-0.5 text-label-sm font-medium rounded transition-colors ${
              language === lang
                ? "bg-[var(--gp-node-code)] text-white"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {lang}
          </button>
        ))}
      </div>

      {/* Code preview — full editor in property panel */}
      {preview && (
        <p className="mt-1 text-label-sm text-muted-foreground font-mono truncate" title={code}>
          {preview}
        </p>
      )}
      {!preview && (
        <p className="mt-1 text-label-sm text-muted-foreground italic">
          Click to edit in properties
        </p>
      )}

      <StatusBadge status={d.status as NodeExecStatus | undefined} featureCount={d.featureCount as number | undefined} />
      <Handle type="source" position={Position.Right} className={`!w-3 !h-3 ${PORT_COLORS.any} !border-2 !border-white dark:!border-gray-900`} />
    </div>
  )
}
