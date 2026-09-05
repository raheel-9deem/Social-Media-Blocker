// ==========================================================================
// FocusModeRule — blocks platforms during active focus sessions.
// ==========================================================================

import type { BlockingDecision } from "@/core/types"
import type { Rule } from "./Rule"
import { NOT_BLOCKED } from "./Rule"

export class FocusModeRule implements Rule {
  readonly name = "FocusModeRule"

  evaluate(platformId: string, ctx: {
    userId: string
    userTimezone: string
    now: Date
    platforms: Array<{ id: string; isActive: boolean }>
    dailyUsage: Map<string, number>
    activeFocusSessions: Array<{
      id: string
      platformIds: string[]
      endsAt: string
    }>
    scheduledBlocks: any[]
    namazWindows: any[] | null
  }): BlockingDecision {
    if (ctx.activeFocusSessions.length === 0) return NOT_BLOCKED

    for (const session of ctx.activeFocusSessions) {
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
