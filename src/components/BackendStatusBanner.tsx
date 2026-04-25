import { useState } from "react"
import { WifiOff, RefreshCw } from "lucide-react"
import { useHealthCheck, useHealthStore } from "@/hooks/useHealthCheck"

export function BackendStatusBanner() {
  const [checking, setChecking] = useState(false)
  // Mount the shared health check poller (#206)
  const { check } = useHealthCheck()
  const backendDown = !useHealthStore((s) => s.alive)

  const handleRetry = async () => {
    setChecking(true)
    await check()
    setChecking(false)
  }

  if (!backendDown) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center justify-center gap-2 bg-destructive/10 border-b border-destructive/20 px-4 py-1.5 text-xs text-destructive shrink-0"
    >
      <WifiOff size={14} aria-hidden="true" />
      <span className="font-medium">Backend unreachable</span>
      <span className="text-destructive/70">API calls will fail until connection is restored.</span>
      <button
        onClick={handleRetry}
        disabled={checking}
        aria-label="Retry backend connection"
        className="ml-2 flex items-center gap-1 rounded px-2 py-0.5 bg-destructive/10 hover:bg-destructive/20 transition-colors disabled:opacity-50"
      >
        <RefreshCw size={10} className={checking ? "animate-spin" : ""} aria-hidden="true" />
        {checking ? "Checking..." : "Retry"}
      </button>
    </div>
  )
}
