// ==========================================================================
// DailyLimitRule — checks whether a platform has exceeded its daily
// time budget. Supports per-day-of-week overrides.
// ==========================================================================

import type {
  BlockingDecision,
  EvaluationContext,
} from "../../types"
import { Rule, NOT_BLOCKED } from "./Rule"

export interface DailyLimitRuleOptions {
  /**
   * Overrides keyed by `${dayOfWeek}:${platformId}` for quick lookup.
   * Build this once from the full LimitOverride list.
   */
  overrides: Map<string, number>
  /**
   * Called when a platform crosses its limit. Used by the UI layer to
   * persist an "was blocked" flag in analytics_daily.
   */
  onLimitExceeded?: (platformId: string) => void
}

/**
 * Rule #1 (highest priority): has this platform exceeded its daily
 * time budget?
 *
 * Day boundary is determined by the user's timezone in EvaluationContext.
 * Usage is pre-accumulated in ctx.dailyUsage.
 */
export class DailyLimitRule implements Rule {
  readonly name = "DailyLimitRule"
  private overrides: Map<string, number>
  private onLimitExceeded?: (platformId: string) => void

  constructor(opts: DailyLimitRuleOptions) {
    this.overrides = opts.overrides
    this.onLimitExceeded = opts.onLimitExceeded
  }

  evaluate(platformId: string, ctx: EvaluationContext): BlockingDecision {
    const platform = ctx.platforms.find((p) => p.id === platformId)
    if (!platform || !platform.isActive) return NOT_BLOCKED

    // ---- Resolve the effective limit ----
    const dayOfWeek = ctx.now.getDay() // 0=Sun … 6=Sat
    const overrideKey = `${dayOfWeek}:${platformId}`
    const override = this.overrides.get(overrideKey)
    const limitMinutes = override ?? platform.dailyLimitMinutes

    // Edge-case: zero or negative limit => treat as unlimited
    if (limitMinutes <= 0) return NOT_BLOCKED

    const usedMinutes = ctx.dailyUsage.get(platformId) ?? 0

    if (usedMinutes >= limitMinutes) {
      this.onLimitExceeded?.(platformId)
      return {
        isBlocked: true,
        reason: {
          type: "DAILY_LIMIT_EXCEEDED",
          platformId,
          usedMinutes,
          limitMinutes,
        },
        unblockAt: null, // lifts at next day boundary (handled by evaluator)
        activeRules: [this.name],
      }
    }

    return NOT_BLOCKED
  }
}
