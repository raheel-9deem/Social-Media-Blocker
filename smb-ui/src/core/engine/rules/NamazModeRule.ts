// ==========================================================================
// NamazModeRule — blocks platforms during prayer windows.
// ==========================================================================

import type { BlockingDecision, EvaluationContext } from "../../types"
import { Rule, NOT_BLOCKED } from "./Rule"

export class NamazModeRule implements Rule {
  readonly name = "NamazModeRule"

  evaluate(platformId: string, ctx: EvaluationContext): BlockingDecision {
    if (!ctx.namazWindows || ctx.namazWindows.length === 0) return NOT_BLOCKED

    for (const window of ctx.namazWindows) {
      if (ctx.now >= window.start && ctx.now < window.end) {
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
