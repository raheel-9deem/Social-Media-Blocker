// ==========================================================================
// PersistentStorageAdapter — in-memory cache backed by chrome.storage.local
// (with localStorage fallback for dev), seeded with default platforms.
//
// This ensures platforms, focus sessions, namaz settings, and logs
// persist across extension popup opens and closes.
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

const STORAGE_PREFIX = "mediaBlocker_"

// ---- Default data ----

// Default platforms seeded on first launch.
// Each platform includes its domain hostnames for URL-level blocking.
const DEFAULT_PLATFORMS: Omit<Platform, "id">[] = [
  { name: "YouTube", category: "Video", dailyLimitMinutes: 90, isActive: true, hosts: ["youtube.com", "www.youtube.com", "m.youtube.com"] },
  { name: "Instagram", category: "Social", dailyLimitMinutes: 60, isActive: true, hosts: ["instagram.com", "www.instagram.com"] },
  { name: "TikTok", category: "Video", dailyLimitMinutes: 45, isActive: true, hosts: ["tiktok.com", "www.tiktok.com"] },
  { name: "Twitter / X", category: "Social", dailyLimitMinutes: 45, isActive: true, hosts: ["twitter.com", "x.com", "www.twitter.com"] },
  { name: "Facebook", category: "Social", dailyLimitMinutes: 30, isActive: true, hosts: ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"] },
  { name: "Reddit", category: "Social", dailyLimitMinutes: 30, isActive: true, hosts: ["reddit.com", "www.reddit.com", "old.reddit.com"] },
]

let profile: UserProfile = {
  id: "local",
  displayName: null,
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
const namazSettings: NamazSettings = {
  id: "namaz-1",
  userId: "local",
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

// ---- Change listeners ----

const changeListeners = new Set<() => void>()
function notify(): void {
  for (const cb of changeListeners) cb()
}

// ---- Storage persistence helpers ----

function isChromeStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage?.local
}

async function persistAll(): Promise<void> {
  const data = {
    [`${STORAGE_PREFIX}platforms`]: platforms,
    [`${STORAGE_PREFIX}focusSessions`]: focusSessions,
    [`${STORAGE_PREFIX}namazSettings`]: namazSettings,
    [`${STORAGE_PREFIX}scheduledBlocks`]: scheduledBlocks,
    [`${STORAGE_PREFIX}usageLogs`]: usageLogs,
    [`${STORAGE_PREFIX}profile`]: profile,
  }

  if (isChromeStorage()) {
    try {
      await chrome.storage.local.set(data)
    } catch (e) {
      console.warn("[MediaBlocker] Failed to save to chrome.storage.local:", e)
    }
  }

  if (typeof localStorage !== "undefined") {
    try {
      for (const [k, v] of Object.entries(data)) {
        localStorage.setItem(k, JSON.stringify(v))
      }
    } catch (e) {
      console.warn("[MediaBlocker] Failed to save to localStorage:", e)
    }
  }
}

// Synchronous sync from localStorage on startup if present
function syncFromLocalStorage(): void {
  if (typeof localStorage === "undefined") return
  try {
    const p = localStorage.getItem(`${STORAGE_PREFIX}platforms`)
    if (p) {
      const parsed = JSON.parse(p)
      if (Array.isArray(parsed) && parsed.length > 0) {
        platforms.length = 0
        platforms.push(...parsed)
      }
    }
    const fs = localStorage.getItem(`${STORAGE_PREFIX}focusSessions`)
    if (fs) {
      const parsed = JSON.parse(fs)
      if (Array.isArray(parsed)) {
        focusSessions.length = 0
        focusSessions.push(...parsed)
      }
    }
    const ns = localStorage.getItem(`${STORAGE_PREFIX}namazSettings`)
    if (ns) {
      Object.assign(namazSettings, JSON.parse(ns))
    }
    const sb = localStorage.getItem(`${STORAGE_PREFIX}scheduledBlocks`)
    if (sb) {
      const parsed = JSON.parse(sb)
      if (Array.isArray(parsed)) {
        scheduledBlocks.length = 0
        scheduledBlocks.push(...parsed)
      }
    }
    const ul = localStorage.getItem(`${STORAGE_PREFIX}usageLogs`)
    if (ul) {
      const parsed = JSON.parse(ul)
      if (Array.isArray(parsed)) {
        usageLogs.length = 0
        usageLogs.push(...parsed)
      }
    }
    const pr = localStorage.getItem(`${STORAGE_PREFIX}profile`)
    if (pr) {
      profile = JSON.parse(pr)
    }
  } catch (e) {
    console.warn("[MediaBlocker] syncFromLocalStorage error:", e)
  }
}

// Initial sync
syncFromLocalStorage()
if (usageLogs.length === 0) {
  seedMockLogs()
}

// Asynchronous hydration from chrome.storage.local
async function hydrateFromChromeStorage(): Promise<void> {
  if (!isChromeStorage()) return
  try {
    const keys = [
      `${STORAGE_PREFIX}platforms`,
      `${STORAGE_PREFIX}focusSessions`,
      `${STORAGE_PREFIX}namazSettings`,
      `${STORAGE_PREFIX}scheduledBlocks`,
      `${STORAGE_PREFIX}usageLogs`,
      `${STORAGE_PREFIX}profile`,
    ]
    const res = await chrome.storage.local.get(keys)
    let changed = false

    if (res[`${STORAGE_PREFIX}platforms`] && Array.isArray(res[`${STORAGE_PREFIX}platforms`])) {
      platforms.length = 0
      platforms.push(...res[`${STORAGE_PREFIX}platforms`])
      changed = true
    }
    if (res[`${STORAGE_PREFIX}focusSessions`] && Array.isArray(res[`${STORAGE_PREFIX}focusSessions`])) {
      focusSessions.length = 0
      focusSessions.push(...res[`${STORAGE_PREFIX}focusSessions`])
      changed = true
    }
    if (res[`${STORAGE_PREFIX}namazSettings`]) {
      Object.assign(namazSettings, res[`${STORAGE_PREFIX}namazSettings`])
      changed = true
    }
    if (res[`${STORAGE_PREFIX}scheduledBlocks`] && Array.isArray(res[`${STORAGE_PREFIX}scheduledBlocks`])) {
      scheduledBlocks.length = 0
      scheduledBlocks.push(...res[`${STORAGE_PREFIX}scheduledBlocks`])
      changed = true
    }
    if (res[`${STORAGE_PREFIX}usageLogs`] && Array.isArray(res[`${STORAGE_PREFIX}usageLogs`])) {
      usageLogs.length = 0
      usageLogs.push(...res[`${STORAGE_PREFIX}usageLogs`])
      changed = true
    }
    if (res[`${STORAGE_PREFIX}profile`]) {
      profile = { ...res[`${STORAGE_PREFIX}profile`] }
      changed = true
    }

    if (changed) {
      notify()
    }
  } catch (e) {
    console.warn("[MediaBlocker] hydrateFromChromeStorage error:", e)
  }
}

void hydrateFromChromeStorage()

// Listen for external storage changes (e.g. background worker or options page)
if (isChromeStorage()) {
  chrome.storage.onChanged.addListener((changes) => {
    let shouldNotify = false
    if (changes[`${STORAGE_PREFIX}platforms`]?.newValue) {
      platforms.length = 0
      platforms.push(...changes[`${STORAGE_PREFIX}platforms`].newValue)
      shouldNotify = true
    }
    if (changes[`${STORAGE_PREFIX}focusSessions`]?.newValue) {
      focusSessions.length = 0
      focusSessions.push(...changes[`${STORAGE_PREFIX}focusSessions`].newValue)
      shouldNotify = true
    }
    if (changes[`${STORAGE_PREFIX}namazSettings`]?.newValue) {
      Object.assign(namazSettings, changes[`${STORAGE_PREFIX}namazSettings`].newValue)
      shouldNotify = true
    }
    if (changes[`${STORAGE_PREFIX}scheduledBlocks`]?.newValue) {
      scheduledBlocks.length = 0
      scheduledBlocks.push(...changes[`${STORAGE_PREFIX}scheduledBlocks`].newValue)
      shouldNotify = true
    }
    if (shouldNotify) {
      notify()
    }
  })
}

// ---- Adapter implementation ----

export const inMemoryStorage: StorageAdapter = {
  async getProfile(): Promise<UserProfile | null> {
    return { ...profile }
  },

  async updateProfile(data: UpdateProfile): Promise<UserProfile> {
    profile = { ...profile, ...data }
    await persistAll()
    notify()
    return { ...profile }
  },

  async listPlatforms(): Promise<Platform[]> {
    return platforms.map((p) => ({ ...p }))
  },

  async addPlatform(data: CreatePlatform): Promise<Platform> {
    const p: Platform = {
      id: crypto.randomUUID(),
      ...data,
      hosts: data.hosts && data.hosts.length > 0 ? data.hosts : [data.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com"],
      isActive: true,
    }
    platforms.push(p)
    await persistAll()
    notify()
    return { ...p }
  },

  async updatePlatform(id: ID, data: UpdatePlatform): Promise<Platform> {
    const idx = platforms.findIndex((p) => p.id === id)
    if (idx === -1) throw new AppStorageError(`Platform ${id} not found`, "STORAGE_NOT_FOUND")
    platforms[idx] = { ...platforms[idx], ...data }
    await persistAll()
    notify()
    return { ...platforms[idx] }
  },

  async removePlatform(id: ID): Promise<void> {
    const idx = platforms.findIndex((p) => p.id === id)
    if (idx === -1) throw new AppStorageError(`Platform ${id} not found`, "STORAGE_NOT_FOUND")
    platforms.splice(idx, 1)
    await persistAll()
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
    await persistAll()
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
    await persistAll()
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
    await persistAll()
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
        await persistAll()
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
    await persistAll()
    notify()
    return { ...b }
  },

  async removeScheduledBlock(id: ID): Promise<void> {
    const idx = scheduledBlocks.findIndex((b) => b.id === id)
    if (idx === -1) throw new AppStorageError(`Block ${id} not found`, "STORAGE_NOT_FOUND")
    scheduledBlocks.splice(idx, 1)
    await persistAll()
    notify()
  },

  async getNamazSettings(): Promise<NamazSettings | null> {
    if (!namazSettings) return null
    return { ...namazSettings }
  },

  async updateNamazSettings(data: UpdateNamazSettings): Promise<NamazSettings> {
    if (!namazSettings) throw new AppStorageError("Namaz settings not initialized", "STORAGE_NOT_FOUND")
    Object.assign(namazSettings, data)
    await persistAll()
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
