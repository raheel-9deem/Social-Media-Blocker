import { useState, useEffect, useCallback } from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [query])

  return matches
}

export function useIsMobile(breakpoint = 768): boolean {
  return useMediaQuery(`(max-width: ${breakpoint}px)`)
}

export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useCallback(() => callback(), [callback])

  useEffect(() => {
    if (delay === null) return
    const id = setInterval(() => savedCallback(), delay * 1000)
    return () => clearInterval(id)
  }, [delay, savedCallback])
}
