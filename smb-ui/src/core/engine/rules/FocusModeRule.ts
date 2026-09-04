// ==========================================================================
// FocusModeRule — blocks platforms during active focus sessions.
// ==========================================================================

import type { BlockingDecision, EvaluationContext } from "../../types"
import { Rule, NOT_BLOCKED } from "./Rule"

export class FocusModeRule implements Rule {
  readonly name = "FocusModeRule"

  evaluate(platformId: string, ctx: EvaluationContext): BlockingDecision {
    if (ctx.activeFocusSessions.length === 0) return NOT_BLOCKED

    for (const session of ctx.activeFocusSessions) {
      // Empty platformIds = block ALL platforms
      const blocksAll = session.platformIds.length === 0
      const blocksThis = session.platformIds.includes(platformId)

      if (!blocksAll && !blocksThis) continue

      const remaining = Math.max(
        0,
        Math.round((new Date(session.endsAt).getTime() - ctx.now.getTime()) / 1000)
      )

      return {
        isBlocked: true,
        reason: {
          type: "FOCUS_MODE",
          focusSessionId: session.id,
          remainingSeconds: remaining,
        },
        unblockAt: session.endsAt,
        activeRules: [this.name],
      }
    }

    return NOT_BLOCKED
  }
}
