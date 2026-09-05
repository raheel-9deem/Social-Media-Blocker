// ==========================================================================
// Rule interface — all blocking rules implement this.
// Rules are evaluated in priority order; the first match wins.
// ==========================================================================

import type {
  BlockingDecision,
  EvaluationContext,
} from "../../types"

export interface Rule {
  /** Human-readable name, e.g. "DailyLimitRule" */
  name: string
  /**
   * Evaluate this rule for a given platform.
   * @returns A BlockingDecision — isBlocked=true means higher-priority
   * rules will not be evaluated for this platform.
   */
  evaluate(platformId: string, ctx: EvaluationContext): BlockingDecision
}

/** Sentinel for "no block" — used by rules that match but don't block */
export const NOT_BLOCKED: BlockingDecision = {
  isBlocked: false,
  reason: { type: "NONE" },
  unblockAt: null,
  activeRules: [],
}
