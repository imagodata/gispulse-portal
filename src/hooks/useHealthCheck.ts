/**
 * Shared health check hook — single source of truth for backend status.
 * Both BackendStatusBanner and useLiveEvents consume this (#206).
 */
import { useEffect, useCallback } from "react"
import { create } from "zustand"
import { isBackendAlive } from "@/api/client"

// ---------------------------------------------------------------------------
// Store — shared backend alive state
// ---------------------------------------------------------------------------

interface HealthState {
  alive: boolean
  lastChecked: number
  setAlive: (v: boolean) => void
}

export const useHealthStore = create<HealthState>((set) => ({
  alive: true,
  lastChecked: 0,
  setAlive: (alive) => set({ alive, lastChecked: Date.now() }),
}))

// ---------------------------------------------------------------------------
// Hook — poll every interval ms, shared across consumers
// ---------------------------------------------------------------------------

const CHECK_INTERVAL_MS = 10_000

export function useHealthCheck() {
  const setAlive = useHealthStore((s) => s.setAlive)

  const check = useCallback(async () => {
    const alive = await isBackendAlive()
    setAlive(alive)
    return alive
  }, [setAlive])

  useEffect(() => {
    check()
    const timer = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [check])

  return { check }
}
