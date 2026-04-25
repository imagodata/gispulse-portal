import { Upload } from "lucide-react"

export function DragDropOverlay() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-md pointer-events-none">
      <Upload size={32} className="text-primary" />
      <span className="text-sm font-medium text-primary">Drop to import</span>
      <span className="text-xs text-muted-foreground">GeoJSON, GPKG, SHP, FGB, CSV, Parquet</span>
    </div>
  )
}
