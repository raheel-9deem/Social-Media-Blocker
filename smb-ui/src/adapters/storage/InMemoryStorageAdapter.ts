// ==========================================================================
// InMemoryStorageAdapter — complete in-memory implementation of
// StorageAdapter, with seeded mock data for development/demo.
// ==========================================================================

import type {
  StorageAdapter,
  UserProfile,
  Platform,
  UsageLog,
  FocusSession,
  ScheduledBlock,
  NamazSettings,
  DailyStats,
  ID,
  CreatePlatform,
  UpdatePlatform,
  CreateUsageLog,
  CreateFocusSession,
  UpsertScheduledBlock,
  UpdateNamazSettings,
  UpdateProfile,
} from "./StorageAdapter"
import type { LimitOverride } from "../../core/types"

// ---- Default data ----

const DEFAULT_PLATFORMS: Omit<Platform, "id">[] = [
  { name: "YouTube", category: "Video", dailyLimitMinutes: 90, isActive: true },
  { name: "Instagram", category: "Social", dailyLimitMinutes: 60, isActive: true },
  { name: "TikTok", category: "Video", dailyLimitMinutes: 45, isActive: true },
  { name: "Twitter / X", category: "Social", dailyLimitMinutes: 45, isActive: true },
  { name: "Facebook", category: "Social", dailyLimitMinutes: 30, isActive: true },
  { name: "Reddit", category: "Social", dailyLimitMinutes: 30, isActive: true },
]

let profile: UserProfile = {
  id: "user-1",
  displayName: "Sam N.",
  timezone: "Asia/Karachi",
  locale: "en",
  theme: "system",
}

const platforms: Platform[] = DEFAULT_PLATFORMS.map((p) => ({
  ...p,
  id: crypto.randomUUID(),
}))

const limitOverrides: LimitOverride[] = []
const usageLogs: UsageLog[] = []
const focusSessions: FocusSession[] = []
const scheduledBlocks: ScheduledBlock[] = []
const namazSettings: NamazSettings | null = {
  id: "namaz-1",
  userId: "user-1",
  isEnabled: false,
  calculationMethod: "MWL",
  timeFormat: "12h",
  prayerWindows: [],
  preBlockMinutes: 5,
  postBlockMinutes: 5,
  blockedPlatformIds: [],
  lastComputedAt: null,
}
const analytics: DailyStats[] = []
let nextLogNum = 1

// ---- Helper: generate mock usage logs ----

function seedMockLogs(): void {
  if (usageLogs.length > 0) return
  const now = new Date()
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const day = new Date(now)
    day.setDate(day.getDate() - daysAgo)
    day.setHours(0, 0, 0, 0)

    for (const plat of platforms) {
      if (!plat.isActive) continue
      const sessions = 1 + (daysAgo % 3)
      let remaining = plat.dailyLimitMinutes * 60 * (0.4 + (daysAgo % 5) * 0.12)
      for (let s = 0; s < sessions; s++) {
        const duration = Math.min(remaining, 300 + s * 120)
        remaining -= duration
        usageLogs.push({
          id: `log-${nextLogNum++}`,
          userId: profile.id,
          platformId: plat.id,
          startedAt: new Date(day.getTime() + s * 1800_000).toISOString(),
          endedAt: new Date(day.getTime() + s * 1800_000 + duration * 1000).toISOString(),
          durationSec: Math.round(duration),
          source: "manual",
          createdAt: new Date(day.getTime() + s * 1800_000).toISOString(),
        })
      }
    }
  }
}

seedMockLogs()

// ---- Change listeners ----

const changeListeners = new Set<() => void>()
function notify(): void {
  for (const cb of changeListeners) cb()
}

// ---- Adapter implementation ----

export const inMemoryStorage: StorageAdapter = {
  async getProfile(): Promise<UserProfile | null> {
    return { ...profile }
  },

  async updateProfile(data: UpdateProfile): Promise<UserProfile> {
    profile = { ...profile, ...data }
    notify()
    return { ...profile }
  },

  async listPlatforms(): Promise<Platform[]> {
    return platforms.map((p) => ({ ...p }))
  },

  async addPlatform(data: CreatePlatform): Promise<Platform> {
    const p: Platform = { id: crypto.randomUUID(), ...data, isActive: true }
    platforms.push(p)
    notify()
    return { ...p }
  },

  async updatePlatform(id: ID, data: UpdatePlatform): Promise<Platform> {
    const idx = platforms.findIndex((p) => p.id === id)
    if (idx === -1) throw new AppStorageError(`Platform ${id} not found`, "STORAGE_NOT_FOUND")
    platforms[idx] = { ...platforms[idx], ...data }
    notify()
    return { ...platforms[idx] }
  },

  async removePlatform(id: ID): Promise<void> {
    const idx = platforms.findIndex((p) => p.id === id)
    if (idx === -1) throw new AppStorageError(`Platform ${id} not found`, "STORAGE_NOT_FOUND")
    platforms.splice(idx, 1)
    notify()
  },

  async recordUsageLog(entry: CreateUsageLog): Promise<UsageLog> {
    const log: UsageLog = {
      id: `log-${nextLogNum++}`,
      userId: profile.id,
      ...entry,
      createdAt: new Date().toISOString(),
    }
    usageLogs.push(log)
    notify()
    return { ...log }
  },

  async getUsageLogs(_startDate?: Date, _endDate?: Date): Promise<UsageLog[]> {
    return usageLogs.map((l) => ({ ...l }))
  },

  async startFocusSession(session: CreateFocusSession): Promise<FocusSession> {
    const active = focusSessions.find(
      (s) => !s.endsAt || new Date(s.endsAt) > new Date()
    )
    if (active) {
      active.endsAt = new Date().toISOString()
      active.reason = "manual_end"
    }
    const endsAt = new Date()
    endsAt.setMinutes(endsAt.getMinutes() + session.durationMinutes)
    const fs: FocusSession = {
      id: crypto.randomUUID(),
      userId: profile.id,
      platformIds: session.platformIds,
      startedAt: new Date().toISOString(),
      endsAt: endsAt.toISOString(),
      reason: "user_activated",
    }
    focusSessions.push(fs)
    notify()
    return { ...fs }
  },

  async endFocusSession(id: ID): Promise<FocusSession> {
    const idx = focusSessions.findIndex((s) => s.id === id)
    if (idx === -1) throw new AppStorageError(`Focus session ${id} not found`, "STORAGE_NOT_FOUND")
    focusSessions[idx] = {
      ...focusSessions[idx],
      endsAt: new Date().toISOString(),
      reason: "manual_end",
    }
    notify()
    return { ...focusSessions[idx] }
  },

  async getActiveFocusSession(): Promise<FocusSession | null> {
    const now = new Date()
    const active = focusSessions.find(
      (s) => new Date(s.endsAt) > now && s.reason === "user_activated"
    )
    return active ? { ...active } : null
  },

  async listScheduledBlocks(): Promise<ScheduledBlock[]> {
    return scheduledBlocks.map((b) => ({ ...b }))
  },

  async upsertScheduledBlock(block: UpsertScheduledBlock): Promise<ScheduledBlock> {
    if (block.id) {
      const idx = scheduledBlocks.findIndex((b) => b.id === block.id)
      if (idx !== -1) {
        scheduledBlocks[idx] = { ...scheduledBlocks[idx], ...block }
        notify()
        return { ...scheduledBlocks[idx] }
      }
    }
    const b: ScheduledBlock = {
      id: block.id ?? crypto.randomUUID(),
      userId: profile.id,
      platformIds: block.platformIds,
      name: block.name,
      startTime: block.startTime,
      endTime: block.endTime,
      daysOfWeek: block.daysOfWeek,
      isActive: block.isActive ?? true,
    }
    scheduledBlocks.push(b)
    notify()
    return { ...b }
  },

  async removeScheduledBlock(id: ID): Promise<void> {
    const idx = scheduledBlocks.findIndex((b) => b.id === id)
    if (idx === -1) throw new AppStorageError(`Block ${id} not found`, "STORAGE_NOT_FOUND")
    scheduledBlocks.splice(idx, 1)
    notify()
  },

  async getNamazSettings(): Promise<NamazSettings | null> {
    if (!namazSettings) return null
    return { ...namazSettings }
  },

  async updateNamazSettings(data: UpdateNamazSettings): Promise<NamazSettings> {
    if (!namazSettings) throw new AppStorageError("Namaz settings not initialized", "STORAGE_NOT_FOUND")
    Object.assign(namazSettings, data)
    notify()
    return { ...namazSettings }
  },

  async getDailyAnalytics(): Promise<DailyStats[]> {
    return analytics.map((a) => ({ ...a }))
  },

  subscribeToChanges(callback: () => void): () => void {
    changeListeners.add(callback)
    return () => changeListeners.delete(callback)
  },
}

// App-specific error subclass for storage failures
class AppStorageError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = "AppStorageError"
    this.code = code
  }
}

// ---- Export data stores for direct engine access ----

export { profile, platforms, limitOverrides, usageLogs, focusSessions, scheduledBlocks, namazSettings }

/**
 * Build the override map for the DailyLimitRule from the current platform list.
 * Each platform's dailyLimitMinutes is keyed as "*:${platformId}" so it
 * applies to all days unless a per-day override exists.
 */
export function buildLimitOverrideMap(): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of platforms) {
    map.set(`*:${p.id}`, p.dailyLimitMinutes)
  }
  // Add per-day overrides from limitOverrides store
  for (const o of limitOverrides) {
    const key = `${o.dayOfWeek ?? "*"}:${o.platformId}`
    map.set(key, o.limitMinutes)
  }
  return map
}
