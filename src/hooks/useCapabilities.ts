import { useEffect, useMemo, useState } from "react"
import { listCapabilities } from "@/api/datasets"
import type { CapabilitySchema } from "@/types/dataset"

type State = {
  caps: CapabilitySchema[]
  loading: boolean
  error: string | null
}

let cache: CapabilitySchema[] | null = null
let inflight: Promise<CapabilitySchema[]> | null = null
const subscribers = new Set<(s: State) => void>()
let lastError: string | null = null

function notify(state: State) {
  for (const fn of subscribers) fn(state)
}

function load(): Promise<CapabilitySchema[]> {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight
  inflight = listCapabilities()
    .then((data) => {
      cache = data ?? []
      lastError = null
      notify({ caps: cache, loading: false, error: null })
      return cache
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      lastError = msg
      notify({ caps: [], loading: false, error: msg })
      return []
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useCapabilities(): State & { byName: Record<string, CapabilitySchema> } {
  const [state, setState] = useState<State>(() => ({
    caps: cache ?? [],
    loading: cache === null,
    error: lastError,
  }))

  useEffect(() => {
    subscribers.add(setState)
    if (cache === null) {
      void load()
    }
    return () => {
      subscribers.delete(setState)
    }
  }, [])

  const byName = useMemo(() => {
    const map: Record<string, CapabilitySchema> = {}
    for (const c of state.caps) map[c.name] = c
    return map
  }, [state.caps])

  return { ...state, byName }
}

export function _resetCapabilitiesCacheForTests() {
  cache = null
  inflight = null
  lastError = null
  subscribers.clear()
}
