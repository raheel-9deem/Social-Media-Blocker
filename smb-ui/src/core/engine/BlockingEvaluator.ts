// ==========================================================================
// BlockingEvaluator — the central dispatcher that evaluates all blocking
// rules for every platform and returns a BlockingDecision.
//
// Rule priority (highest first):
//   1. DailyLimitRule
//   2. FocusModeRule
//   3. ScheduledBlockRule
//   4. NamazModeRule
// ==========================================================================

import type { BlockingDecision, EvaluationContext } from "../types"
import type { Rule } from "./rules/Rule"

/**
 * A snapshot of blocking results for all active platforms.
 */
export interface EvaluationResult {
  /** platformId -> blocking decision */
  decisions: Map<string, BlockingDecision>
  /** Did any rule fire on at least one platform? */
  hasAnyBlock: boolean
}

export class BlockingEvaluator {
  private rules: Rule[]

  /**
   * @param rules Ordered by priority — highest priority first.
   *              Constructor-time so the order is immutable.
   */
  constructor(rules: Rule[]) {
    this.rules = [...rules]
  }

  /**
   * Evaluate a single platform against all rules.
   * Returns the first blocking decision found (highest priority wins).
   */
  evaluate(platformId: string, ctx: EvaluationContext): BlockingDecision {
    for (const rule of this.rules) {
      const result = rule.evaluate(platformId, ctx)
      if (result.isBlocked) return result
    }
    return {
      isBlocked: false,
      reason: { type: "NONE" },
      unblockAt: null,
      activeRules: [],
    }
  }

  /**
   * Evaluate all active platforms at once.
   *
   * @param ctx Full evaluation context (populated by the Adapter layer
   *            from live data + computed aggregations)
   */
  evaluateAll(ctx: EvaluationContext): EvaluationResult {
    const decisions = new Map<string, BlockingDecision>()
    let hasAnyBlock = false

    for (const platform of ctx.platforms) {
      if (!platform.isActive) continue
      const decision = this.evaluate(platform.id, ctx)
      decisions.set(platform.id, decision)
      if (decision.isBlocked) hasAnyBlock = true
    }

    return { decisions, hasAnyBlock }
  }
}
