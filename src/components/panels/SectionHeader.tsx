import { Badge } from "@/components/ui/badge"

export function SectionHeader({
  title,
  count,
  onAdd,
  extraActions,
}: {
  title: string
  count?: number
  onAdd?: () => void
  extraActions?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b px-3 py-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {count !== undefined && count > 0 && (
          <Badge variant="secondary" className="text-label-sm h-4 px-1.5">{count}</Badge>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {extraActions}
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={`Add ${title.toLowerCase()}`}
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}
