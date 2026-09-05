// ==========================================================================
// DailyResetManager — detects day boundaries per user timezone.
//
// In production, the Edge Function provides the authoritative server time
// and the client corrects for drift. For the MVP, client time is used
// directly (with a warning that a server-time adapter should be plugged in).
// ==========================================================================

import type { DayBoundary } from "../types"

/**
 * Compute the UTC offset (as +HH:MM) for a given timezone at a given instant.
 * Falls back to UTC if the timezone is unknown.
 */
function getUTCOffset(timezone: string, date: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    }) as Intl.DateTimeFormat & { resolvedOptions(): { timeZone: string } }
    const parts = fmt.formatToParts(date)
    const tzPart = parts.find((p) => p.type === "timeZoneName")
    if (tzPart) {
      // e.g. "GMT+5:00" or "GMT-8:00" or "GMT"
      const match = tzPart.value.match(/GMT([+-]?\d{1,2}(?::\d{2})?)?/)
      if (match) {
        const offset = match[1] ?? "+0:00"
        if (offset.startsWith("+") || offset.startsWith("-")) {
          const [h, m = "00"] = offset.slice(1).split(":").map(Number)
          const sign = offset[0]
          const hh = String(Math.abs(h)).padStart(2, "0")
          const mm = String(m).padStart(2, "0")
          return `${sign}${hh}:${mm}`
        }
        return "+00:00"
      }
    }
  } catch {
    // timezone not recognised — fall through to UTC
  }
  return "+00:00"
}

/**
 * Format a Date to a "YYYY-MM-DD" string in the given timezone.
 */
function formatDateInTimezone(date: Date, timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    const parts = fmt.formatToParts(date)
    const y = parts.find((p) => p.type === "year")!.value
    const m = parts.find((p) => p.type === "month")!.value
    const d = parts.find((p) => p.type === "day")!.value
    return `${y}-${m}-${d}`
  } catch {
    // Fallback to UTC date
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, "0")
    const d = String(date.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
}

export class DailyResetManager {
  /** Cache last seen date per timezone to avoid recomputation */
  private cache: Map<string, { date: string; boundary: DayBoundary }> = new Map()

  /**
   * Returns the day boundary (local midnight) for the given instant
   * in the given timezone.
   */
  getDayBoundary(date: Date, timezone: string): DayBoundary {
    const dayStr = formatDateInTimezone(date, timezone)
    const offset = getUTCOffset(timezone, date)

    const currentDayStart = new Date(`${dayStr}T00:00:00${offset}`)
    const nextDayStart = new Date(currentDayStart.getTime() + 86_400_000)

    const result: DayBoundary = { currentDayStart, nextDayStart }

    // Cache (only when stable)
    const cached = this.cache.get(timezone)
    if (!cached || cached.date !== dayStr) {
      this.cache.set(timezone, { date: dayStr, boundary: result })
    }

    return result
  }

  /**
   * Returns true if the date (in the user's timezone) has changed
   * between the previous check and `now`.
   */
  hasDayBoundaryPassed(previousCheck: Date, now: Date, timezone: string): boolean {
    const prev = this.getDayBoundary(previousCheck, timezone)
    const curr = this.getDayBoundary(now, timezone)
    return prev.currentDayStart.getTime() !== curr.currentDayStart.getTime()
  }

  /**
   * Returns the date key string (YYYY-MM-DD) for a given instant
   * in the user's local timezone.
   */
  getLocalDateKey(date: Date, timezone: string): string {
    return formatDateInTimezone(date, timezone)
  }
}
