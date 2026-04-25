/**
 * FilterPanel — Interactive spatial filtering panel.
 *
 * Inspired by FilterMate's 3-tab dock (Explore / Filter / Export).
 * Integrated as a right-side panel in the Map workspace.
 */

import { useFilterStore } from "@/stores/filterStore"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { XIcon, SearchIcon, FilterIcon, DownloadIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { FilterTab } from "./FilterTab"
import { ExploreTab } from "./ExploreTab"
import { ExportTab } from "./ExportTab"

export function FilterPanel() {
  const open = useFilterStore((s) => s.open)
  const activeTab = useFilterStore((s) => s.activeTab)
  const setActiveTab = useFilterStore((s) => s.setActiveTab)
  const setOpen = useFilterStore((s) => s.setOpen)

  if (!open) return null

  return (
    <div
      className={cn(
        "flex h-full w-80 flex-col border-l bg-background",
        "animate-in slide-in-from-right-2 duration-200",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Filter Panel</span>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
          <XIcon className="size-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="mx-2 mt-2" variant="default">
          <TabsTrigger value="explore">
            <SearchIcon className="size-3.5" />
            Explore
          </TabsTrigger>
          <TabsTrigger value="filter">
            <FilterIcon className="size-3.5" />
            Filter
          </TabsTrigger>
          <TabsTrigger value="export">
            <DownloadIcon className="size-3.5" />
            Export
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="explore" className="p-3">
            <ExploreTab />
          </TabsContent>
          <TabsContent value="filter" className="p-3">
            <FilterTab />
          </TabsContent>
          <TabsContent value="export" className="p-3">
            <ExportTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
