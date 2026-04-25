/**
 * Shared protocol → Tailwind color class mapping.
 * Single source of truth — import from here, not inline.
 * Issue #200
 */
export const PROTOCOL_COLOR: Record<string, string> = {
  wms: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  wfs: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  wmts: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  tms: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  xyz: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  "ogc-features": "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "ogc-tiles": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
}
