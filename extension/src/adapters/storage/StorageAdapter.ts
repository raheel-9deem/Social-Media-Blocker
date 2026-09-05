// ==========================================================================
// StorageAdapter interface — all data access goes through this.
// The core engine never touches Supabase directly; adapters bridge the gap.
// ==========================================================================

// Needed as return-type parameters in the interface below
import type { Platform, UsageLog, FocusSession, ScheduledBlock, DailyStats } from "../../core/types"
export type { Platform, UsageLog, FocusSession, ScheduledBlock, DailyStats } from "../../core/types"

/** Unique identifier type */
export type ID = string

/** Pagination helper */
export interface Page<T> {
  items: T[]
  nextCursor?: string
}

// ---- Profile ----

export interface UserProfile {
  id: ID
  displayName: string | null
  timezone: string
  locale: string
  theme: "light" | "dark" | "system"
}

export interface UpdateProfile {
  displayName?: string | null
  timezone?: string
  locale?: string
  theme?: "light" | "dark" | "system"
}

// ---- Platforms ----

export interface CreatePlatform {
  name: string
  category: string
  /** Minutes per day */
  dailyLimitMinutes: number
}

export interface UpdatePlatform {
  name?: string
  category?: string
  dailyLimitMinutes?: number
  isActive?: boolean
}

// ---- Usage ----

export interface CreateUsageLog {
  platformId: ID
  startedAt: string // ISO
  endedAt: string   // ISO
  durationSec: number
  source: "manual" | "extension" | "import"
}

// ---- Focus ----

export interface CreateFocusSession {
  platformIds: ID[]
  durationMinutes: number
}

// ---- Scheduled Blocks ----

export interface CreateScheduledBlock {
  name?: string
  platformIds: ID[]
  startTime: string // "HH:MM"
  endTime: string   // "HH:MM"
  daysOfWeek: number[]
}

export interface UpsertScheduledBlock {
  id?: ID
  name?: string
  platformIds: ID[]
  startTime: string
  endTime: string
  daysOfWeek: number[]
  isActive?: boolean
}

// ---- Namaz ----

export interface NamazSettings {
  id: ID
  userId: ID
  isEnabled: boolean
  calculationMethod: string
  timeFormat: "12h" | "24h"
  prayerWindows: Array<{ start: string; end: string; prayerName: string }>
  preBlockMinutes: number
  postBlockMinutes: number
  blockedPlatformIds: ID[]
  lastComputedAt: string | null
}

export interface UpdateNamazSettings {
  isEnabled?: boolean
  calculationMethod?: string
  timeFormat?: "12h" | "24h"
  preBlockMinutes?: number
  postBlockMinutes?: number
  blockedPlatformIds?: ID[]
  /** Allow updating computed prayer windows */
  prayerWindows?: Array<{ start: string; end: string; prayerName: string }>
  lastComputedAt?: string | null
}

// ---- Realtime ----

export type UnsubscribeFn = () => void

// ---- Main interface ----

export interface StorageAdapter {
  // Profile
  getProfile(): Promise<UserProfile | null>
  updateProfile(data: UpdateProfile): Promise<UserProfile>

  // Platforms
  listPlatforms(): Promise<Platform[]>
  addPlatform(data: CreatePlatform): Promise<Platform>
  updatePlatform(id: ID, data: UpdatePlatform): Promise<Platform>
  removePlatform(id: ID): Promise<void>

  // Usage
  recordUsageLog(entry: CreateUsageLog): Promise<UsageLog>
  getUsageLogs(startDate: Date, endDate: Date): Promise<UsageLog[]>

  // Focus
  startFocusSession(session: CreateFocusSession): Promise<FocusSession>
  endFocusSession(id: ID): Promise<FocusSession>
  getActiveFocusSession(): Promise<FocusSession | null>

  // Scheduled Blocks
  listScheduledBlocks(): Promise<ScheduledBlock[]>
  upsertScheduledBlock(block: UpsertScheduledBlock): Promise<ScheduledBlock>
  removeScheduledBlock(id: ID): Promise<void>

  // Namaz
  getNamazSettings(): Promise<NamazSettings | null>
  updateNamazSettings(data: UpdateNamazSettings): Promise<NamazSettings>

  // Analytics
  getDailyAnalytics(startDate: Date, endDate: Date): Promise<DailyStats[]>

  // Realtime (optional)
  subscribeToChanges(callback: () => void): UnsubscribeFn
}
