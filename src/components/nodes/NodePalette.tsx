/**
 * Categorized, draggable node palette for the NodeEditor sidebar.
 *
 * Sprint R-4 updates:
 *   #132 — 6 categories: Sources, Processing, Output, Logic, Triggers, Code
 *   #135 — "My Rules" section: rules from store drag as pre-configured capability nodes
 */

import { useEffect, useState } from "react"
import {
  Database, Cog, Download, Zap, GitBranch, Code,
  Search, ChevronDown, BookOpen, Star, Trash2,
  Table2, MapPin, BarChart3, Target, ShieldCheck, FileCode, Layers, Calculator,
  Sparkles,
} from "lucide-react"
import type { NodeCategory } from "./nodeStyles"
import { useProjectStore } from "@/stores/projectStore"
import { listCapabilities } from "@/api/datasets"
import type { CapabilitySchema } from "@/types/dataset"

interface PaletteNode {
  type: string
  label: string
  description: string
  category: NodeCategory
  icon: React.ComponentType<{ className?: string }>
  defaultData?: Record<string, unknown>
}

const PALETTE_NODES: PaletteNode[] = [
  // Sources
  { type: "datasetSource", label: "Dataset", description: "Load a dataset layer", category: "source", icon: Database },

  // Processing (renamed from Transforms, extended)
  { type: "capability", label: "Buffer", description: "Create buffer zones", category: "transform", icon: Cog, defaultData: { capability: "buffer", label: "Buffer" } },
  { type: "capability", label: "Clip", description: "Clip to polygon mask", category: "transform", icon: Cog, defaultData: { capability: "clip", label: "Clip" } },
  { type: "capability", label: "Intersect", description: "Spatial intersection", category: "transform", icon: Cog, defaultData: { capability: "intersect", label: "Intersect" } },
  { type: "capability", label: "Union", description: "Spatial union of layers", category: "transform", icon: Cog, defaultData: { capability: "union", label: "Union" } },
  { type: "capability", label: "Difference", description: "Subtract one layer from another", category: "transform", icon: Cog, defaultData: { capability: "difference", label: "Difference" } },
  { type: "capability", label: "Spatial Join", description: "Join by location", category: "transform", icon: Cog, defaultData: { capability: "spatial_join", label: "Spatial Join" } },
  { type: "capability", label: "Filter", description: "SQL WHERE filter", category: "transform", icon: Cog, defaultData: { capability: "filter", label: "Filter" } },
  { type: "capability", label: "Dissolve", description: "Merge by attribute", category: "transform", icon: Cog, defaultData: { capability: "dissolve", label: "Dissolve" } },
  { type: "capability", label: "Reproject", description: "Change CRS", category: "transform", icon: Cog, defaultData: { capability: "reproject", label: "Reproject" } },
  { type: "capability", label: "Classify", description: "Field classification", category: "transform", icon: Cog, defaultData: { capability: "classify", label: "Classify" } },
  { type: "capability", label: "Centroid", description: "Extract centroids", category: "transform", icon: Cog, defaultData: { capability: "centroid", label: "Centroid" } },
  { type: "capability", label: "Simplify", description: "Reduce vertex count", category: "transform", icon: Cog, defaultData: { capability: "simplify", label: "Simplify" } },

  // Logic (was "control")
  { type: "branch", label: "Branch", description: "If/Else condition", category: "control", icon: GitBranch },

  // Triggers
  { type: "trigger", label: "DML Trigger", description: "React to INSERT/UPDATE/DELETE", category: "trigger", icon: Zap, defaultData: { triggerType: "On DML", label: "DML Trigger" } },
  { type: "trigger", label: "Schedule", description: "Cron-based trigger", category: "trigger", icon: Zap, defaultData: { triggerType: "On Schedule", label: "Schedule" } },
  { type: "trigger", label: "Threshold", description: "Metric threshold", category: "trigger", icon: Zap, defaultData: { triggerType: "On Threshold", label: "Threshold" } },

  // Code
  { type: "codeBlock", label: "Python", description: "Custom Python code", category: "code", icon: Code, defaultData: { language: "Python", label: "Python" } },
  { type: "codeBlock", label: "SQL Block", description: "Custom SQL query", category: "code", icon: Code, defaultData: { language: "SQL", label: "SQL Block" } },
  { type: "codeBlock", label: "Expression", description: "Field expression", category: "code", icon: Code, defaultData: { language: "Expression", label: "Expression" } },

  // Output
  { type: "output", label: "Output", description: "Export results", category: "output", icon: Download },

  // Point clouds (4 OSS + 2 Pro). Pro entries carry `(Pro)` in description; the
  // backend tier gate (persistence.tier.check_tier) raises TierError at runtime
  // for Community licences — palette stays advertising the upgrade path.
  { type: "capability", label: "Load LAS/LAZ", description: "Load LAS/LAZ as Point Z layer", category: "pointcloud", icon: Database, defaultData: { capability: "pointcloud_load_las", label: "Load LAS/LAZ" } },
  { type: "capability", label: "Filter Classes", description: "Keep ASPRS class codes (e.g. 2, 6)", category: "pointcloud", icon: Cog, defaultData: { capability: "pointcloud_filter_classification", label: "Filter Classes" } },
  { type: "capability", label: "Zonal Height", description: "Height stats per polygon zone", category: "pointcloud", icon: BarChart3, defaultData: { capability: "pointcloud_zonal_height", label: "Zonal Height" } },
  { type: "capability", label: "Grid Summary", description: "Gridded point cloud summary", category: "pointcloud", icon: Calculator, defaultData: { capability: "pointcloud_grid_summary", label: "Grid Summary" } },
  { type: "capability", label: "IGN Download", description: "(Pro) Download IGN LiDAR HD by bbox", category: "pointcloud", icon: Download, defaultData: { capability: "pointcloud_ign_download", label: "IGN Download" } },
  { type: "capability", label: "Enrich", description: "(Pro) Add normals/curvature/density features", category: "pointcloud", icon: Sparkles, defaultData: { capability: "pointcloud_enrich", label: "Enrich" } },

  // ── Trigger Operations ──────────────────────────────────
  // Tables
  { type: "tableSource", label: "Table Source", description: "DML event source (INSERT/UPDATE/DELETE)", category: "ops_table", icon: Table2, defaultData: { nodeKind: "tableSource", label: "Table Source", schema: "", table: "", event: "INSERT" } },

  // Spatial (BEFORE)
  { type: "spatialOp", label: "ST_Within", description: "Find parent zone (FK spatiale)", category: "ops_spatial", icon: MapPin, defaultData: { nodeKind: "spatialOp", label: "ST_Within", operation: "st_within", phase: "before", field: "", coalesce: false } },
  { type: "spatialOp", label: "ST_Intersects", description: "Find intersecting features", category: "ops_spatial", icon: MapPin, defaultData: { nodeKind: "spatialOp", label: "ST_Intersects", operation: "st_intersects", phase: "before", field: "", coalesce: false } },
  { type: "spatialOp", label: "ST_Contains", description: "Find contained features", category: "ops_spatial", icon: MapPin, defaultData: { nodeKind: "spatialOp", label: "ST_Contains", operation: "st_contains", phase: "before", field: "", coalesce: false } },
  { type: "spatialOp", label: "ST_Nearest", description: "Find nearest feature", category: "ops_spatial", icon: MapPin, defaultData: { nodeKind: "spatialOp", label: "ST_Nearest", operation: "st_nearest", phase: "before", field: "", coalesce: false } },
  { type: "spatialOp", label: "ST_DWithin Start", description: "Nearest to line start point (polymorphic)", category: "ops_spatial", icon: MapPin, defaultData: { nodeKind: "spatialOp", label: "ST_DWithin Start", operation: "st_dwithin_startpoint", phase: "before", field: "", coalesce: false, distance: 50 } },
  { type: "spatialOp", label: "ST_DWithin End", description: "Nearest to line end point (polymorphic)", category: "ops_spatial", icon: MapPin, defaultData: { nodeKind: "spatialOp", label: "ST_DWithin End", operation: "st_dwithin_endpoint", phase: "before", field: "", coalesce: false, distance: 50 } },
  { type: "spatialOp", label: "ST_Length", description: "Calculate geometry length", category: "ops_spatial", icon: MapPin, defaultData: { nodeKind: "spatialOp", label: "ST_Length", operation: "st_length", phase: "before", field: "length_m", coalesce: false } },
  { type: "spatialOp", label: "ST_Area", description: "Calculate geometry area", category: "ops_spatial", icon: MapPin, defaultData: { nodeKind: "spatialOp", label: "ST_Area", operation: "st_area", phase: "before", field: "area_m2", coalesce: false } },
  { type: "spatialOp", label: "Centroid", description: "Calculate centroid point", category: "ops_spatial", icon: MapPin, defaultData: { nodeKind: "spatialOp", label: "Centroid", operation: "centroid", phase: "before", field: "centroid", coalesce: false } },

  // Aggregate (AFTER)
  { type: "aggregate", label: "COUNT Contains", description: "Count features contained in zone", category: "ops_aggregate", icon: BarChart3, defaultData: { nodeKind: "aggregate", label: "COUNT Contains", operation: "count_st_contains", phase: "after", distantSchema: "", distantTable: "", distantField: "" } },
  { type: "aggregate", label: "SUM Contains", description: "Sum field of contained features", category: "ops_aggregate", icon: BarChart3, defaultData: { nodeKind: "aggregate", label: "SUM Contains", operation: "sum_st_contains", phase: "after", distantSchema: "", distantTable: "", distantField: "" } },
  { type: "aggregate", label: "COUNT Within", description: "Count features within zone", category: "ops_aggregate", icon: BarChart3, defaultData: { nodeKind: "aggregate", label: "COUNT Within", operation: "count_st_within", phase: "after", distantSchema: "", distantTable: "", distantField: "" } },
  { type: "aggregate", label: "SUM Within", description: "Sum field of features within", category: "ops_aggregate", icon: BarChart3, defaultData: { nodeKind: "aggregate", label: "SUM Within", operation: "sum_st_within", phase: "after", distantSchema: "", distantTable: "", distantField: "" } },
  { type: "aggregate", label: "COUNT Intersects", description: "Count intersecting features", category: "ops_aggregate", icon: BarChart3, defaultData: { nodeKind: "aggregate", label: "COUNT Intersects", operation: "count_st_intersects", phase: "after", distantSchema: "", distantTable: "", distantField: "" } },
  { type: "aggregate", label: "SUM Intersects", description: "Sum intersecting features", category: "ops_aggregate", icon: BarChart3, defaultData: { nodeKind: "aggregate", label: "SUM Intersects", operation: "sum_st_intersects", phase: "after", distantSchema: "", distantTable: "", distantField: "" } },

  // Target
  { type: "target", label: "Target Table", description: "UPDATE distant table field", category: "ops_aggregate", icon: Target, defaultData: { nodeKind: "target", label: "Target", distantSchema: "", distantTable: "", distantField: "" } },

  // Validation
  { type: "validation", label: "Validation", description: "Data quality checks (BEFORE)", category: "ops_validation", icon: ShieldCheck, defaultData: { nodeKind: "validation", label: "Validation", rules: [] } },

  // Composite
  { type: "composite", label: "Composite", description: "Ordered list of operations on one table", category: "ops_spatial", icon: Layers, defaultData: { nodeKind: "composite", label: "Composite", ops: [] } },

  // Business Rule
  { type: "businessRule", label: "Business Rule", description: "Domain logic with dependencies", category: "ops_custom", icon: Calculator, defaultData: { nodeKind: "businessRule", label: "Business Rule", phase: "before", field: "", expression: "", dependencies: [], coalesce: false } },

  // Custom Expression
  { type: "customExpression", label: "Custom SQL", description: "Free-form SQL expression", category: "ops_custom", icon: FileCode, defaultData: { nodeKind: "customExpression", label: "Custom SQL", phase: "before", field: "", expression: "", coalesce: false } },
]

const CATEGORIES: { id: NodeCategory; label: string; icon: React.ComponentType<{ className?: string }>; group?: string }[] = [
  // Trigger operations (shown first)
  { id: "ops_table", label: "Tables", icon: Table2, group: "Operations" },
  { id: "ops_spatial", label: "Spatial Ops", icon: MapPin, group: "Operations" },
  { id: "ops_aggregate", label: "Aggregate", icon: BarChart3, group: "Operations" },
  { id: "ops_validation", label: "Validation", icon: ShieldCheck, group: "Operations" },
  { id: "ops_custom", label: "Custom SQL", icon: FileCode, group: "Operations" },
  // Pipeline nodes
  { id: "source", label: "Sources", icon: Database, group: "Pipeline" },
  { id: "transform", label: "Processing", icon: Cog, group: "Pipeline" },
  { id: "pointcloud", label: "Point Cloud", icon: Layers, group: "Pipeline" },
  { id: "control", label: "Logic", icon: GitBranch, group: "Pipeline" },
  { id: "trigger", label: "Triggers", icon: Zap, group: "Pipeline" },
  { id: "code", label: "Code", icon: Code, group: "Pipeline" },
  { id: "output", label: "Output", icon: Download, group: "Pipeline" },
]

const CAT_COLORS: Record<NodeCategory, string> = {
  source: "text-[var(--gp-node-source)]",
  transform: "text-[var(--gp-node-transform)]",
  output: "text-[var(--gp-node-output)]",
  trigger: "text-[var(--gp-node-trigger)]",
  control: "text-[var(--gp-node-control)]",
  code: "text-[var(--gp-node-code)]",
  ops_table: "text-[var(--gp-node-trigger)]",
  ops_spatial: "text-[var(--gp-node-transform)]",
  ops_aggregate: "text-[var(--gp-node-output)]",
  ops_validation: "text-[var(--gp-node-control)]",
  ops_custom: "text-[var(--gp-node-code)]",
  pointcloud: "text-[var(--gp-node-transform)]",
}

// ---------------------------------------------------------------------------
// My Rules section (R-4 #135)
// ---------------------------------------------------------------------------

function MyRulesSection({ search }: { search: string }) {
  const rules = useProjectStore((s) => s.rules)
  const [collapsed, setCollapsed] = useState(false)

  const filtered = rules.filter(
    (r) =>
      r.enabled &&
      (search === "" ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.capability.toLowerCase().includes(search.toLowerCase())),
  )

  if (filtered.length === 0) return null

  const onDragStart = (event: React.DragEvent, rule: typeof rules[number]) => {
    // Drop a pre-configured capability node from this rule (#135)
    const payload = {
      type: "capability",
      label: rule.name,
      data: {
        capability: rule.capability,
        label: rule.name,
        config: rule.config,
        // Attach rule metadata so the node can be identified as a rule template
        rule_id: rule.id,
        rule_name: rule.name,
      },
    }
    event.dataTransfer.setData("application/reactflow", JSON.stringify(payload))
    event.dataTransfer.effectAllowed = "move"
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-label font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent transition-colors"
      >
        <Star className="h-3 w-3 text-amber-500" />
        <span className="flex-1 text-left">My Rules</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && (
        <div className="px-1.5 pb-1.5 space-y-0.5">
          {filtered.map((rule) => (
            <div
              key={rule.id}
              draggable
              onDragStart={(e) => onDragStart(e, rule)}
              title={`${rule.capability} — drag to canvas`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-accent transition-colors group"
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-amber-500 opacity-70 group-hover:opacity-100" />
              <div className="min-w-0">
                <p className="text-label-lg font-medium text-foreground truncate">{rule.name}</p>
                <p className="text-label-sm text-muted-foreground truncate">{rule.capability}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Templates section (#172) — built-in + user templates
// ---------------------------------------------------------------------------

import { useTemplateStore } from "@/stores/templateStore"
import { toast } from "sonner"

const DOMAIN_COLORS: Record<string, string> = {
  ftth: "text-blue-500",
  urbanisme: "text-amber-500",
  environnement: "text-green-500",
  transport: "text-orange-500",
  hydrologie: "text-cyan-500",
  generic: "text-muted-foreground",
  custom: "text-purple-500",
}

const DOMAIN_LABELS: Record<string, string> = {
  ftth: "FTTH / Telecom",
  urbanisme: "Urbanisme",
  environnement: "Environnement",
  transport: "Transport",
  hydrologie: "Hydrologie",
  generic: "Generic",
  custom: "Custom",
}

/** Ordered list of domain families for grouping */
const DOMAIN_ORDER = ["ftth", "urbanisme", "environnement", "transport", "hydrologie", "generic", "custom"] as const

function TemplatesSection({ search }: { search: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(new Set())
  const userTemplates = useTemplateStore((s) => s.userTemplates)
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate)

  // Lazy import built-in templates (useEffect to avoid re-triggering on every render)
  const [builtInTemplates, setBuiltInTemplates] = useState<
    Array<{ id: string; name: string; description: string; domain: string; nodes: any[]; edges: any[]; builtIn?: boolean }>
  >([])

  useEffect(() => {
    let cancelled = false
    import("@/data/workflowTemplates").then((m) => {
      if (!cancelled) {
        setBuiltInTemplates(
          m.WORKFLOW_TEMPLATES.map((t: any) => ({ ...t, builtIn: true })),
        )
      }
    })
    return () => { cancelled = true }
  }, [])

  // Merge: user templates first, then built-in
  const allTemplates = [
    ...userTemplates.map((t) => ({ ...t, builtIn: false })),
    ...builtInTemplates,
  ]

  const filtered = allTemplates.filter(
    (t) =>
      search === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.domain.toLowerCase().includes(search.toLowerCase()),
  )

  if (filtered.length === 0 && !search) return null

  // Group by domain family
  const grouped = new Map<string, typeof filtered>()
  for (const tpl of filtered) {
    const domain = tpl.domain || "generic"
    if (!grouped.has(domain)) grouped.set(domain, [])
    grouped.get(domain)!.push(tpl)
  }

  // Sort families by DOMAIN_ORDER
  const sortedFamilies = DOMAIN_ORDER.filter((d) => grouped.has(d))

  const toggleFamily = (domain: string) => {
    setCollapsedFamilies((prev) => {
      const next = new Set(prev)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }

  const onDragStart = (event: React.DragEvent, tpl: typeof allTemplates[number]) => {
    const payload = {
      type: "__template",
      nodes: tpl.nodes,
      edges: tpl.edges,
      label: tpl.name,
    }
    event.dataTransfer.setData("application/reactflow", JSON.stringify(payload))
    event.dataTransfer.effectAllowed = "move"
  }

  const handleDelete = (e: React.MouseEvent, tpl: typeof allTemplates[number]) => {
    e.stopPropagation()
    e.preventDefault()
    deleteTemplate(tpl.id)
    toast.success(`Deleted template "${tpl.name}"`)
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-label font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent transition-colors"
      >
        <Zap className="h-3 w-3 text-purple-500" />
        <span className="flex-1 text-left">Templates</span>
        <span className="text-label-sm font-normal tabular-nums">{filtered.length}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && (
        <div className="pb-1">
          {sortedFamilies.map((domain) => {
            const familyItems = grouped.get(domain)!
            const isFamilyCollapsed = collapsedFamilies.has(domain)
            const domainColor = DOMAIN_COLORS[domain] || "text-muted-foreground"
            const domainLabel = DOMAIN_LABELS[domain] || domain

            return (
              <div key={domain}>
                {/* Family header */}
                <button
                  type="button"
                  onClick={() => toggleFamily(domain)}
                  className="w-full flex items-center gap-1 px-3.5 py-1 text-label-sm font-semibold uppercase tracking-wider hover:bg-accent/50 transition-colors"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${domainColor.replace("text-", "bg-")}`} />
                  <span className={`flex-1 text-left ${domainColor}`}>{domainLabel}</span>
                  <span className="text-label-xs font-normal text-muted-foreground tabular-nums">{familyItems.length}</span>
                  <ChevronDown className={`h-2.5 w-2.5 text-muted-foreground transition-transform ${isFamilyCollapsed ? "-rotate-90" : ""}`} />
                </button>
                {!isFamilyCollapsed && (
                  <div className="px-1.5 pb-0.5 space-y-0.5">
                    {familyItems.map((tpl) => (
                      <div
                        key={tpl.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, tpl)}
                        title={`${tpl.description}${tpl.builtIn ? " (built-in)" : ""}\nDrag to canvas to load`}
                        tabIndex={0}
                    role="option"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-accent focus:bg-accent focus:outline-none transition-colors group"
                      >
                        <Zap className={`h-3.5 w-3.5 shrink-0 ${domainColor} opacity-70 group-hover:opacity-100`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <p className="text-label-lg font-medium text-foreground truncate">{tpl.name}</p>
                            {!tpl.builtIn && (
                              <span className="text-label-xs px-1 py-0.5 rounded bg-purple-500/10 text-purple-500 font-medium shrink-0">
                                user
                              </span>
                            )}
                          </div>
                          <p className="text-label-sm text-muted-foreground truncate">{tpl.description}</p>
                        </div>
                        {!tpl.builtIn && (
                          <button
                            onClick={(e) => handleDelete(e, tpl)}
                            className="hidden group-hover:block p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            title="Delete template"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Registry-driven capabilities section (#441)
// ---------------------------------------------------------------------------

/**
 * Bucket a capability name into a coarse category for UI grouping.
 * Falls back to "Other" so every registry entry surfaces.
 */
function _categorizeCapability(name: string): string {
  if (
    /^(add_field|drop_field|select_columns|rename_field|cast_field|attribute_join|pivot|unpivot|lookup_table|coalesce_fields|case_when|describe)$/.test(
      name,
    )
  ) {
    return "Schema & attrs"
  }
  if (/^(overlay_|erase|clip|intersects|spatial_join|dissolve|symmetric_difference|vector_diff)$/.test(name)) {
    return "Overlay & spatial joins"
  }
  if (
    /^(multipart_to_singleparts|singleparts_to_multipart|boundary|extract_holes|force_geometry_type|affine_transform|swap_xy|reverse_lines|add_z|drop_z|add_m|drop_m|assign_projection|reproject|simplify|alpha_shape|concave_hull|convex_hull|offset_curve|snap_to_grid|delaunay|voronoi|polygon_fix_gaps|classify_by_ring)$/.test(
      name,
    )
  ) {
    return "Geometry transforms"
  }
  if (/^(buffer|union|difference|centroid|area_length|isochrone|nearest_neighbor|od_matrix|mst|spatial_weights)$/.test(name)) {
    return "Vector ops"
  }
  if (/^temporal_/.test(name)) {
    return "Temporal"
  }
  if (/^(cluster_|morans_i|getis_ord|head_tail_breaks|normalize|kde_heatmap)/.test(name)) {
    return "Stats & clustering"
  }
  if (/^(grid_create|hexgrid_create|spatial_aggregate|sort|deduplicate|random_sample|top_n)$/.test(name)) {
    return "Aggregation & sampling"
  }
  if (/^(classify|bivariate_choropleth|graduated_size|continuous_ramp)/.test(name)) {
    return "Classification & viz"
  }
  if (/^pointcloud_/.test(name)) {
    return "Point cloud"
  }
  if (/^raster_|zonal_stats/.test(name)) {
    return "Raster"
  }
  if (/_validation$|^validation_/.test(name)) {
    return "Validation"
  }
  if (/^postgis_sql$|^calculate$/.test(name)) {
    return "Custom expressions"
  }
  return "Other capabilities"
}

const CATEGORY_ORDER = [
  "Schema & attrs",
  "Vector ops",
  "Geometry transforms",
  "Overlay & spatial joins",
  "Aggregation & sampling",
  "Classification & viz",
  "Stats & clustering",
  "Temporal",
  "Validation",
  "Raster",
  "Point cloud",
  "Custom expressions",
  "Other capabilities",
] as const

function RegistryCapabilitiesSection({ search }: { search: string }) {
  const [collapsed, setCollapsed] = useState(true)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [caps, setCaps] = useState<CapabilitySchema[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (caps.length > 0 || loading) return
    setLoading(true)
    listCapabilities()
      .then((data) => {
        if (cancelled) return
        setCaps(data ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDragStart = (event: React.DragEvent, cap: CapabilitySchema) => {
    const payload = {
      type: "capability",
      label: cap.name,
      data: { capability: cap.name, label: cap.name },
    }
    event.dataTransfer.setData("application/reactflow", JSON.stringify(payload))
    event.dataTransfer.effectAllowed = "move"
  }

  const filteredCaps = caps.filter((c) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(s) ||
      (c.description?.toLowerCase().includes(s) ?? false)
    )
  })

  // Group by inferred category, keep CATEGORY_ORDER stable
  const grouped = new Map<string, CapabilitySchema[]>()
  for (const cap of filteredCaps) {
    const cat = _categorizeCapability(cap.name)
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(cap)
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }
  const orderedCats = CATEGORY_ORDER.filter((c) => grouped.has(c))

  const toggleCat = (cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-label font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent transition-colors border-t mt-1"
      >
        <Sparkles className="h-3 w-3 text-cyan-500" />
        <span className="flex-1 text-left">
          All capabilities{caps.length > 0 ? ` (${caps.length})` : ""}
        </span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>
      {!collapsed && (
        <div>
          {loading && (
            <p className="px-2.5 py-2 text-label-sm text-muted-foreground">
              Loading registry…
            </p>
          )}
          {error && (
            <p className="px-2.5 py-2 text-label-sm text-destructive">
              {error}
            </p>
          )}
          {!loading && !error && orderedCats.length === 0 && (
            <p className="px-2.5 py-2 text-label-sm text-muted-foreground">
              {search ? "No match." : "No capabilities returned by API."}
            </p>
          )}
          {orderedCats.map((cat) => {
            const items = grouped.get(cat) ?? []
            const catCollapsed = collapsedCats.has(cat)
            return (
              <div key={cat}>
                <button
                  type="button"
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center gap-1.5 px-3 py-1 text-label-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                >
                  <span className="flex-1 text-left">
                    {cat}{" "}
                    <span className="text-muted-foreground/60">
                      ({items.length})
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${
                      catCollapsed ? "-rotate-90" : ""
                    }`}
                  />
                </button>
                {!catCollapsed && (
                  <div className="px-1.5 pb-1.5 space-y-0.5">
                    {items.map((cap) => (
                      <div
                        key={cap.name}
                        draggable
                        onDragStart={(e) => onDragStart(e, cap)}
                        title={cap.description ?? cap.name}
                        tabIndex={0}
                        role="option"
                        className="flex items-center gap-2 rounded-md px-2 py-1 cursor-grab active:cursor-grabbing hover:bg-accent focus:bg-accent focus:outline-none transition-colors group"
                      >
                        <Cog className="h-3.5 w-3.5 shrink-0 text-cyan-500/70 group-hover:text-cyan-500" />
                        <div className="min-w-0">
                          <p className="text-label-lg font-mono text-foreground truncate">
                            {cap.name}
                          </p>
                          {cap.description && (
                            <p className="text-label-sm text-muted-foreground truncate">
                              {cap.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NodePalette
// ---------------------------------------------------------------------------

export function NodePalette({ className }: { className?: string }) {
  const [search, setSearch] = useState("")
  const [collapsed, setCollapsed] = useState<Set<NodeCategory>>(new Set())
  const [compact, setCompact] = useState(false)
  const [activeCompactCat, setActiveCompactCat] = useState<NodeCategory | null>(null)

  const filtered = search
    ? PALETTE_NODES.filter((n) =>
        n.label.toLowerCase().includes(search.toLowerCase()) ||
        n.description.toLowerCase().includes(search.toLowerCase())
      )
    : PALETTE_NODES

  const toggleCategory = (cat: NodeCategory) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const onDragStart = (event: React.DragEvent, node: PaletteNode) => {
    const payload = {
      type: node.type,
      label: node.label,
      data: node.defaultData,
    }
    event.dataTransfer.setData("application/reactflow", JSON.stringify(payload))
    event.dataTransfer.effectAllowed = "move"
  }

  // ---- Compact mode: icon-only sidebar with flyout ----
  if (compact) {
    return (
      <div className="flex shrink-0 h-full">
        {/* Icon rail */}
        <div className="w-10 border-r bg-background flex flex-col items-center py-2 gap-1">
          {/* Toggle to expanded */}
          <button
            onClick={() => setCompact(false)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground mb-2"
            title="Expand palette"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
          </button>
          {CATEGORIES.map((cat) => {
            const items = PALETTE_NODES.filter((n) => n.category === cat.id)
            if (items.length === 0) return null
            const CatIcon = cat.icon
            const isActive = activeCompactCat === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCompactCat(isActive ? null : cat.id)}
                className={`p-1.5 rounded transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent text-muted-foreground"
                }`}
                title={cat.label}
              >
                <CatIcon className={`h-3.5 w-3.5 ${CAT_COLORS[cat.id]}`} />
              </button>
            )
          })}
        </div>
        {/* Flyout panel */}
        {activeCompactCat && (
          <div className="w-[200px] border-r bg-background flex flex-col shrink-0 animate-in slide-in-from-left-2">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {CATEGORIES.find((c) => c.id === activeCompactCat)?.label}
              </span>
              <button
                onClick={() => setActiveCompactCat(null)}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground"
              >
                <ChevronDown className="h-3 w-3 rotate-90" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {PALETTE_NODES.filter((n) => n.category === activeCompactCat).map((node, idx) => {
                const Icon = node.icon
                return (
                  <div
                    key={`${node.type}-${idx}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, node)}
                    title={node.description}
                    tabIndex={0}
                    role="option"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-accent focus:bg-accent focus:outline-none transition-colors group"
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${CAT_COLORS[node.category]} opacity-70 group-hover:opacity-100`} />
                    <div className="min-w-0">
                      <p className="text-label-lg font-medium text-foreground truncate">{node.label}</p>
                      <p className="text-label-sm text-muted-foreground truncate">{node.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---- Expanded mode (original) ----
  return (
    <div className={className ?? "w-[200px] border-r bg-background flex flex-col shrink-0"}>
      {/* Search + compact toggle */}
      <div className="p-2 border-b flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-7 pr-2 py-1 text-label-lg rounded border bg-background outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={() => setCompact(true)}
          className="p-1 rounded hover:bg-accent text-muted-foreground shrink-0"
          title="Compact mode"
        >
          <ChevronDown className="h-3.5 w-3.5 rotate-90" />
        </button>
      </div>

      {/* Categories + My Rules */}
      <div className="flex-1 overflow-y-auto">
        {/* Templates (#172) */}
        <TemplatesSection search={search} />

        {/* My Rules (R-4 #135) */}
        <MyRulesSection search={search} />

        {/* Registry-driven capabilities (#441) */}
        <RegistryCapabilitiesSection search={search} />

        {/* Grouped categories: Forge then Pipeline */}
        {(() => {
          let lastGroup = ""
          return CATEGORIES.map((cat) => {
            const items = filtered.filter((n) => n.category === cat.id)
            if (items.length === 0) return null
            const isCollapsed = collapsed.has(cat.id)
            const CatIcon = cat.icon
            const showGroupHeader = cat.group && cat.group !== lastGroup
            if (cat.group) lastGroup = cat.group

            return (
              <div key={cat.id}>
                {showGroupHeader && (
                  <div className="px-2.5 pt-2 pb-0.5 text-label-sm font-bold uppercase tracking-widest text-muted-foreground/50 border-t mt-1">
                    {cat.group}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-label font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent transition-colors"
                >
                  <CatIcon className={`h-3 w-3 ${CAT_COLORS[cat.id]}`} />
                  <span className="flex-1 text-left">{cat.label}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                </button>
                {!isCollapsed && (
                  <div className="px-1.5 pb-1.5 space-y-0.5">
                    {items.map((node, idx) => {
                      const Icon = node.icon
                      return (
                        <div
                          key={`${node.type}-${idx}`}
                          draggable
                          onDragStart={(e) => onDragStart(e, node)}
                          title={node.description}
                          tabIndex={0}
                    role="option"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-accent focus:bg-accent focus:outline-none transition-colors group"
                        >
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${CAT_COLORS[node.category]} opacity-70 group-hover:opacity-100`} />
                          <div className="min-w-0">
                            <p className="text-label-lg font-medium text-foreground truncate">{node.label}</p>
                            <p className="text-label-sm text-muted-foreground truncate">{node.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}
