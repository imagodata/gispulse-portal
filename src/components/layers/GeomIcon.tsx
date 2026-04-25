import { Circle, Square, Minus, Shapes } from "lucide-react"

export function GeomIcon({ type }: { type: string | null }) {
  const label = type?.toLowerCase() ?? "?"
  const cls = "shrink-0 text-muted-foreground"
  if (label.includes("polygon")) return <Square size={12} className={cls} />
  if (label.includes("line")) return <Minus size={12} className={cls} />
  if (label.includes("collection")) return <Shapes size={12} className={cls} />
  return <Circle size={12} className={cls} />
}
