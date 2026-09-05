// ==========================================================================
// Public API barrel for the core domain engine.
// All imports from the core should go through this file.
// ==========================================================================

// Re-export everything from the types module
export * from "./types"

// Re-export engine classes
export { UsageAccumulator } from "./engine/UsageAccumulator"
export { type AccumulatorSnapshot } from "./engine/UsageAccumulator"
export { DailyResetManager } from "./engine/DailyResetManager"
export { BlockingEvaluator } from "./engine/BlockingEvaluator"
export { type EvaluationResult } from "./engine/BlockingEvaluator"

// Re-export rules — type/value split for verbatimModuleSyntax
export type { Rule } from "./engine/rules/Rule"
export { NOT_BLOCKED } from "./engine/rules/Rule"
export { DailyLimitRule } from "./engine/rules/DailyLimitRule"
export { type DailyLimitRuleOptions } from "./engine/rules/DailyLimitRule"
export { FocusModeRule } from "./engine/rules/FocusModeRule"
export { ScheduledBlockRule } from "./engine/rules/ScheduledBlockRule"
export { NamazModeRule } from "./engine/rules/NamazModeRule"
