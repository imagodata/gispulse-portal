import * as React from "react"

const MOBILE_BREAKPOINT = 768
const COMPACT_BREAKPOINT = 1024

function useMediaQuery(maxWidth: number): boolean {
  const [matches, setMatches] = React.useState<boolean>(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth - 1}px)`)
    const onChange = () => setMatches(mql.matches)
    mql.addEventListener("change", onChange)
    setMatches(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [maxWidth])

  return matches
}

export function useIsMobile() {
  return useMediaQuery(MOBILE_BREAKPOINT)
}

/** True when viewport is below `lg` (1024px) — panels should auto-collapse */
export function useIsCompact() {
  return useMediaQuery(COMPACT_BREAKPOINT)
}
