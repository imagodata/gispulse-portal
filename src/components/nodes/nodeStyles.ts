/**
 * Shared node styling using CSS custom properties (--gp-node-*).
 * All nodes use this for consistent borders, backgrounds, and text colors.
 */

export type NodeCategory = "source" | "transform" | "output" | "trigger" | "control" | "code" | "ops_table" | "ops_spatial" | "ops_aggregate" | "ops_validation" | "ops_custom" | "pointcloud"

interface NodeStyle {
  border: string
  bg: string
  text: string
  label: string
}

/**
 * Node styles using --gp-node-* CSS variables defined in index.css.
 * Falls back to Tailwind colors for bg/dark variants.
 */
export const NODE_STYLES: Record<NodeCategory, NodeStyle> = {
  source: {
    border: "border-[var(--gp-node-source)]",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    text: "text-[var(--gp-node-source)]",
    label: "Source",
  },
  transform: {
    border: "border-[var(--gp-node-transform)]",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    text: "text-[var(--gp-node-transform)]",
    label: "Transform",
  },
  output: {
    border: "border-[var(--gp-node-output)]",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    text: "text-[var(--gp-node-output)]",
    label: "Output",
  },
  trigger: {
    border: "border-[var(--gp-node-trigger)]",
    bg: "bg-rose-50 dark:bg-rose-950/50",
    text: "text-[var(--gp-node-trigger)]",
    label: "Trigger",
  },
  control: {
    border: "border-[var(--gp-node-control)]",
    bg: "bg-violet-50 dark:bg-violet-950/50",
    text: "text-[var(--gp-node-control)]",
    label: "Control",
  },
  code: {
    border: "border-[var(--gp-node-code)]",
    bg: "bg-slate-50 dark:bg-slate-900/50",
    text: "text-[var(--gp-node-code)]",
    label: "Code",
  },
  ops_table: {
    border: "border-[var(--gp-node-trigger)]",
    bg: "bg-rose-50 dark:bg-rose-950/50",
    text: "text-[var(--gp-node-trigger)]",
    label: "Table",
  },
  ops_spatial: {
    border: "border-[var(--gp-node-transform)]",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    text: "text-[var(--gp-node-transform)]",
    label: "Spatial",
  },
  ops_aggregate: {
    border: "border-[var(--gp-node-output)]",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    text: "text-[var(--gp-node-output)]",
    label: "Aggregate",
  },
  ops_validation: {
    border: "border-[var(--gp-node-control)]",
    bg: "bg-violet-50 dark:bg-violet-950/50",
    text: "text-[var(--gp-node-control)]",
    label: "Validation",
  },
  ops_custom: {
    border: "border-[var(--gp-node-code)]",
    bg: "bg-slate-50 dark:bg-slate-900/50",
    text: "text-[var(--gp-node-code)]",
    label: "Custom",
  },
  // Reuses --gp-node-transform (blue) — pointcloud capabilities are spatial
  // transforms semantically (LAZ in/out + scalar fields). Avoids a new
  // CSS variable until a dedicated 3D theme is decided.
  pointcloud: {
    border: "border-[var(--gp-node-transform)]",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    text: "text-[var(--gp-node-transform)]",
    label: "Point Cloud",
  },
}

/** Base node container class string */
export function nodeContainerClass(category: NodeCategory): string {
  const s = NODE_STYLES[category]
  return `rounded-lg border-2 ${s.border} ${s.bg} px-3 py-2.5 shadow-sm min-w-[160px] max-w-[220px]`
}

/** Node header label class string */
export function nodeHeaderClass(category: NodeCategory): string {
  const s = NODE_STYLES[category]
  return `text-label-sm font-bold uppercase tracking-wider ${s.text} mb-0.5`
}
