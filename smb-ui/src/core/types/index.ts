// ==========================================================================
// Shared types for the core domain layer.
// These interfaces contain NO imports from React, Supabase, or any
// platform-specific library. They are plain TypeScript.
// ==========================================================================

/** A social media platform the user manages. */
export interface Platform {
  id: string
  name: string
  /** e.g. "social", "video" — for future filtering */
  category: string
  /** Minutes per day */
  dailyLimitMinutes: number
  /** Whether the platform is actively managed */
  isActive: boolean
}

/** Per-day-of-week override for a platform's limit. */
export interface LimitOverride {
  platformId: string
  /** 0=Sun…6=Sat; null = applies to every day */
  dayOfWeek: number | null
  limitMinutes: number
}

// ---- Usage ----

/** Raw usage session recorded for a platform. */
export interface UsageLog {
  id: string
  userId: string
  platformId: string
  /** ISO-8601 start timestamp */
  startedAt: string
  /** ISO-8601 end timestamp */
  endedAt: string
  /** Computed duration in seconds: endedAt - startedAt */
  durationSec: number
  /** "manual" | "extension" | "import" */
  source: "manual" | "extension" | "import"
  createdAt: string
}

// ---- Blocking ----

/** Why a platform is (or isn't) currently blocked. */
export type BlockingReason =
  | { type: "DAILY_LIMIT_EXCEEDED"; platformId: string; usedMinutes: number; limitMinutes: number }
  | { type: "FOCUS_MODE"; focusSessionId: string; remainingSeconds: number }
  | { type: "SCHEDULED_BLOCK"; blockId: string; blockName: string }
  | { type: "NAMAZ_MODE"; prayerName: string; windowEnd: string }
  | { type: "NONE" }

export interface BlockingDecision {
  isBlocked: boolean
  reason: BlockingReason | null
  /** ISO timestamp when the block lifts (if known) */
  unblockAt: string | null
  /** Names of rules that fire, in priority order */
  activeRules: string[]
}

// ---- Evaluation context ----

export interface EvaluationContext {
  userId: string
  /** IANA timezone, e.g. "Asia/Karachi" */
  userTimezone: string
  /** Authoritative "now" (server-validated in production) */
  now: Date
  platforms: Platform[]
  /** platformId → minutes used today (accumulated) */
  dailyUsage: Map<string, number>
  activeFocusSessions: FocusSession[]
  scheduledBlocks: ScheduledBlock[]
  namazWindows: NamazWindow[] | null
}

// ---- Focus Mode ----

export interface FocusSession {
  id: string
  userId: string
  platformIds: string[]
  startedAt: string
  endsAt: string
  reason: "user_activated" | "manual_end" | "expired"
}

// ---- Scheduled Blocks ----

export interface ScheduledBlock {
  id: string
  userId: string
  platformIds: string[]
  name?: string
  /** Daily start time in user's timezone */
  startTime: string // HH:MM
  /** Daily end time in user's timezone */
  endTime: string // HH:MM
  /** 0=Sun … 6=Sat */
  daysOfWeek: number[]
  isActive: boolean
}

// ---- Namaz Mode ----

export interface NamazWindow {
  name: string
  start: Date
  end: Date
}

// ---- Daily Reset ----

export interface DayBoundary {
  /** Midnight in the user's timezone for the current day */
  currentDayStart: Date
  /** Midnight of the next day */
  nextDayStart: Date
}

// ---- Analytics ----

export interface DailyStats {
  date: string // ISO date YYYY-MM-DD
  platformId: string
  platformName: string
  totalMinutes: number
  sessions: number
  limitMinutes: number
  wasBlocked: boolean
}

export interface WeeklySummary {
  totalMinutes: number
  dailyAverage: number
  mostUsedPlatformId: string | null
  mostUsedPlatformMinutes: number
  limitBreaches: number
  daysWithinLimit: number
}
