import { GISPulseLogo } from "@/components/GISPulseLogo"

interface LoadingScreenProps {
  /** Optional message below the logo */
  message?: string
}

/**
 * Full-screen loading state with animated GISPulse logo.
 * Used as app-level Suspense fallback and splash screen.
 */
export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background">
      <GISPulseLogo animated size={64} className="text-foreground" />
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-semibold text-foreground">GISPulse</span>
        <span className="text-xs text-muted-foreground">{message}</span>
      </div>
    </div>
  )
}

/** Lightweight spinner for lazy-loaded route Suspense boundaries */
export function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-full py-12">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  )
}
