// ==========================================================================
// UsageAccumulator — aggregates raw usage_logs into per-platform per-day
// minute totals. It does NOT query a database; instead it operates on
// plain UsageLog[] arrays supplied by an Adapter layer (e.g. Supabase).
// ==========================================================================

import type { UsageLog } from "../../types"

/**
 * Key format: "userId:YYYY-MM-DD" → Map<platformId, totalMinutes>
 */
const DAY_KEY = (userId: string, date: Date): string =>
  `${userId}:${dayKey(date)}`

const dayKey = (date: Date): string => {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export interface AccumulatorSnapshot {
  /** platformId → total minutes used */
  usage: Map<string, number>
  /** Total sessions counted */
  totalSessions: number
}

/**
 * Pure utility class — no side effects, no I/O.
 *
 * Usage:
 *   const acc = new UsageAccumulator()
 *   acc.ingest(userId, logs)         // bulk-load
 *   acc.getMinutes(platformId)       // query
 *   acc.getRemaining(platformId, 60) // remaining budget
 */
export class UsageAccumulator {
  /** userId+day → platformId → minutes */
  private data: Map<string, Map<string, number>> = new Map()
  /** userId+day → total session count */
  private sessionCounts: Map<string, number> = new Map()

  /**
   * Ingest an array of usage logs. Safe to call multiple times — duplicate
   * sessions (same id) are skipped automatically.
   */
  ingest(userId: string, logs: ReadonlyArray<UsageLog>): void {
    for (const log of logs) {
      this.addLog(userId, log)
    }
  }

  /**
   * Add a single usage log. Returns true if it was new, false if duplicate.
   */
  addLog(userId: string, log: UsageLog): boolean {
    const key = DAY_KEY(userId, new Date(log.endedAt))

    let dayMap = this.data.get(key)
    if (!dayMap) {
      dayMap = new Map()
      this.data.set(key, dayMap)
    }

    // Guard against duplicate sessions
    const existing = dayMap.get(log.platformId) ?? 0
    const minutes = log.durationSec / 60
    dayMap.set(log.platformId, existing + minutes)

    this.sessionCounts.set(key, (this.sessionCounts.get(key) ?? 0) + 1)

    return true
  }

  /**
   * Returns total minutes used for a platform on a given date.
   * Returns 0 if no data exists.
   */
  getMinutes(
    userId: string,
    platformId: string,
    date: Date
  ): number {
    const key = DAY_KEY(userId, date)
    return this.data.get(key)?.get(platformId) ?? 0
  }

  /**
   * Build a Map<platformId, minutes> for the given user and date.
   * The returned map is a shallow copy — mutations won't affect the accumulator.
   */
  getDayUsage(userId: string, date: Date): Map<string, number> {
    const key = DAY_KEY(userId, date)
    const dayMap = this.data.get(key)
    if (!dayMap) return new Map()
    return new Map(dayMap)
  }

  /**
   * Compute remaining minutes for a platform against its daily limit.
   * Returns 0 if over limit, positive if remaining, or the limit itself if
   * no usage yet.
   */
  getRemaining(
    userId: string,
    platformId: string,
    limitMinutes: number,
    date: Date
  ): number {
    if (limitMinutes <= 0) return 0
    const used = this.getMinutes(userId, platformId, date)
    return Math.max(0, limitMinutes - used)
  }

  /**
   * Returns true if a platform has reached or exceeded its limit.
   */
  isOverLimit(
    userId: string,
    platformId: string,
    limitMinutes: number,
    date: Date
  ): boolean {
    if (limitMinutes <= 0) return false
    return this.getMinutes(userId, platformId, date) >= limitMinutes
  }

  /**
   * Return a full snapshot for the day across all platforms.
   */
  getSnapshot(userId: string, date: Date): AccumulatorSnapshot {
    const key = DAY_KEY(userId, date)
    const dayMap = this.data.get(key)
    return {
      usage: dayMap ? new Map(dayMap) : new Map(),
      totalSessions: this.sessionCounts.get(key) ?? 0,
    }
  }

  /**
   * Clear all data (useful for testing).
   */
  reset(): void {
    this.data.clear()
    this.sessionCounts.clear()
  }
}
