// ==========================================================================
// NamazModeRule — blocks platforms during prayer windows.
// ==========================================================================

import type { BlockingDecision } from "@/core/types"
import type { Rule } from "./Rule"
import { NOT_BLOCKED } from "./Rule"

export class NamazModeRule implements Rule {
  readonly name = "NamazModeRule"

  evaluate(
    _platformId: string,
    ctx: {
      namazWindows: Array<{ name: string; start: Date; end: Date }> | null
      now: Date
    }
  ): BlockingDecision {
    if (!ctx.namazWindows || ctx.namazWindows.length === 0) return NOT_BLOCKED

    for (const window of ctx.namazWindows) {
      const start = window.start
      const end = window.end

      // Standard window (start < end) vs window crossing midnight (end <= start)
      const isInside = end > start
        ? (ctx.now >= start && ctx.now < end)
        : (ctx.now >= start || ctx.now < end)

      if (isInside) {
        return {
          isBlocked: true,
          reason: {
            type: "NAMAZ_MODE",
            prayerName: window.name,
            windowEnd: window.end.toISOString(),
          },
          unblockAt: window.end.toISOString(),
          activeRules: [this.name],
        }
      }
    }

    return NOT_BLOCKED
  }
}
