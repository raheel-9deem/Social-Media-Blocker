// ==========================================================================
// ScheduledBlockRule — blocks during user-defined time windows.
// ==========================================================================

import type { BlockingDecision, EvaluationContext } from "../../types"
import { Rule, NOT_BLOCKED } from "./Rule"

export class ScheduledBlockRule implements Rule {
  readonly name = "ScheduledBlockRule"

  evaluate(platformId: string, ctx: EvaluationContext): BlockingDecision {
    if (ctx.scheduledBlocks.length === 0) return NOT_BLOCKED

    const now = ctx.now
    const currentDay = now.getDay()

    for (const block of ctx.scheduledBlocks) {
      if (!block.isActive) continue
      if (!block.daysOfWeek.includes(currentDay)) continue

      const blocksAll = block.platformIds.length === 0
      const blocksThis = block.platformIds.includes(platformId)
      if (!blocksAll && !blocksThis) continue

      // Parse start/end time strings (HH:MM) in user's timezone
      const [sh, sm] = block.startTime.split(":").map(Number)
      const [eh, em] = block.endTime.split(":").map(Number)

      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const startMinutes = sh * 60 + sm
      const endMinutes = eh * 60 + em

      const isInWindow =
        endMinutes >= startMinutes
          ? currentMinutes >= startMinutes && currentMinutes < endMinutes
          : currentMinutes >= startMinutes || currentMinutes < endMinutes // crosses midnight

      if (isInWindow) {
        return {
          isBlocked: true,
          reason: {
            type: "SCHEDULED_BLOCK",
            blockId: block.id,
            blockName: block.name ?? "Scheduled block",
          },
          unblockAt: null,
          activeRules: [this.name],
        }
      }
    }

    return NOT_BLOCKED
  }
}
