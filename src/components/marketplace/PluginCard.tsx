/**
 * components/marketplace/PluginCard.tsx — Card for a marketplace plugin.
 *
 * Displays name, description, author, version, badges (Verified, Pro),
 * and Install/Uninstall/Installed action button.
 */

import { useState } from "react"
import { BadgeCheck, Sparkles, Download, Trash2, Package, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { installPlugin, uninstallPlugin } from "@/api/marketplace"
import type { Plugin } from "@/api/marketplace"

// ---------------------------------------------------------------------------
// Category colour map
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, string> = {
  geometry: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40",
  analysis: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800/40",
  export: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40",
  import: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40",
  visualization: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800/40",
  integration: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-800/40",
  utilities: "bg-muted text-muted-foreground border-border",
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PluginCardProps {
  plugin: Plugin
  installed?: boolean
  onInstalled?: (pluginId: string) => void
  onUninstalled?: (id: string) => void
}

// ---------------------------------------------------------------------------
// PluginCard
// ---------------------------------------------------------------------------

export function PluginCard({ plugin, installed = false, onInstalled, onUninstalled }: PluginCardProps) {
  const [loading, setLoading] = useState(false)

  async function handleInstall() {
    setLoading(true)
    try {
      const result = await installPlugin(plugin.id)
      if (result.ok) {
        toast.success(`${plugin.name} installed successfully`)
        onInstalled?.(plugin.id)
      } else {
        toast.error(result.message)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Install failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleUninstall() {
    if (!confirm(`Uninstall ${plugin.name}? This may affect running pipelines.`)) return
    setLoading(true)
    try {
      const result = await uninstallPlugin(plugin.id)
      if (result.ok) {
        toast.success(`${plugin.name} uninstalled`)
        onUninstalled?.(plugin.id)
      } else {
        toast.error(result.message)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Uninstall failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 hover:border-border/80 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Icon placeholder */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60">
          <Package size={16} className="text-muted-foreground" />
        </div>

        {/* Title + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate">{plugin.name}</h3>
            {plugin.verified && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary"
                title="Verified by GISPulse"
                aria-label="Verified plugin"
              >
                <BadgeCheck size={12} />
                Verified
              </span>
            )}
            {plugin.requires_pro && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40">
                <Sparkles size={10} />
                Pro
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            by <span className="font-medium">{plugin.author}</span>
            {" · "}v{plugin.version}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
        {plugin.description}
      </p>

      {/* Tags + category */}
      <div className="flex flex-wrap gap-1">
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-medium border",
            CATEGORY_STYLES[plugin.category] ?? CATEGORY_STYLES.utilities
          )}
        >
          {plugin.category}
        </span>
        {plugin.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/60"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Footer: installs + action */}
      <div className="flex items-center justify-between pt-1 mt-auto">
        <span className="text-[11px] text-muted-foreground">
          {plugin.install_count.toLocaleString()} installs
        </span>

        {installed ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gp-success font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-gp-success" />
              Installed
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUninstall}
              disabled={loading}
              className="gap-1 text-destructive hover:text-destructive hover:border-destructive/40"
              aria-label={`Uninstall ${plugin.name}`}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Remove
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={handleInstall}
            disabled={loading}
            className="gap-1.5"
            aria-label={`Install ${plugin.name}`}
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            {loading ? "Installing..." : "Install"}
          </Button>
        )}
      </div>
    </article>
  )
}
