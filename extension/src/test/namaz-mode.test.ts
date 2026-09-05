// ==========================================================================
// NamazMode — tests for prayer windows, settings persistence,
// midnight boundaries, and engine rule integration.
// ==========================================================================

import { describe, it, expect, beforeEach } from "vitest"
import { getPrayerTimeProvider } from "@/core/services/PrayerTimeProvider"
import { NamazModeRule } from "@/core/engine/rules/NamazModeRule"
import { inMemoryStorage } from "@/adapters/storage/InMemoryStorageAdapter"
import type { NamazSettings } from "@/adapters/storage/StorageAdapter"
import { BlockingEvaluator } from "@/core/engine/BlockingEvaluator"
import type { EvaluationContext } from "@/core"
import type { NamazWindow as CoreNamazWindow } from "@/core"

// ==========================================================================
// Helpers
// ==========================================================================

function makeWindow(
  name: string,
  startMinutes: number,
  endMinutes: number,
  dateStr = "2025-06-15",
): CoreNamazWindow {
  const [sh, sm] = [Math.floor(startMinutes / 60), startMinutes % 60]
  const [eh, em] = [Math.floor(endMinutes / 60), endMinutes % 60]
  const start = new Date(`${dateStr}T${pad(sh)}:${pad(sm)}:00`)
  let end = new Date(`${dateStr}T${pad(eh)}:${pad(em)}:00`)
  if (endMinutes < startMinutes) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  }
  return {
    name,
    start,
    end,
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

async function getFreshNamazSettings(): Promise<NamazSettings> {
  // Reset namaz settings back to defaults
  const current = await inMemoryStorage.getNamazSettings()
  if (current) {
    await inMemoryStorage.updateNamazSettings({
      isEnabled: false,
      calculationMethod: "MWL",
      timeFormat: "12h",
      preBlockMinutes: 5,
      postBlockMinutes: 5,
      blockedPlatformIds: [],
      prayerWindows: [],
      lastComputedAt: null,
    })
  }
  return inMemoryStorage.getNamazSettings().then((s) => s!)
}

// ==========================================================================
// 1. PrayerWindow computation
// ==========================================================================

describe("PrayerWindow computation", () => {
  const provider = getPrayerTimeProvider()

  const sampleTimes = {
    date: "2025-06-15",
    latitude: 24.86,
    longitude: 67.01,
    method: "MWL",
    Fajr: "03:45",
    Dhuhr: "12:30",
    Asr: "16:15",
    Maghrib: "19:45",
    Isha: "21:15",
  }

  // ---- Correct pre/post block windows ----

  it("computes windows with default 5m pre/post blocks", () => {
    const windows = provider.computeWindows(sampleTimes, { preBlockMinutes: 5, postBlockMinutes: 5 })

    // Fajr: 03:40 - 03:50
    const fajr = windows.find((w) => w.prayerName === "Fajr")
    expect(fajr).toBeDefined()
    expect(fajr!.startStr).toBe("03:40")
    expect(fajr!.endStr).toBe("03:50")

    // Dhuhr: 12:25 - 12:35
    const dhuhr = windows.find((w) => w.prayerName === "Dhuhr")
    expect(dhuhr).toBeDefined()
    expect(dhuhr!.startStr).toBe("12:25")
    expect(dhuhr!.endStr).toBe("12:35")

    // Isha: 21:10 - 21:20
    const isha = windows.find((w) => w.prayerName === "Isha")
    expect(isha).toBeDefined()
    expect(isha!.startStr).toBe("21:10")
    expect(isha!.endStr).toBe("21:20")
  })

  // ---- Custom pre/post values ----

  it("computes windows with custom pre/post values", () => {
    const windows = provider.computeWindows(sampleTimes, { preBlockMinutes: 15, postBlockMinutes: 10 })

    const fajr = windows.find((w) => w.prayerName === "Fajr")
    expect(fajr!.startStr).toBe("03:30")
    expect(fajr!.endStr).toBe("03:55")
  })

  it("handles zero pre/post blocks", () => {
    const windows = provider.computeWindows(sampleTimes, { preBlockMinutes: 0, postBlockMinutes: 0 })

    const dhuhr = windows.find((w) => w.prayerName === "Dhuhr")
    expect(dhuhr!.startStr).toBe("12:30")
    expect(dhuhr!.endStr).toBe("12:30")
  })

  // ---- Midnight crossing ----

  it("handles Isha window crossing midnight (Isha + postBlock extends past midnight)", () => {
    // Simulate late Isha with 30m postBlock at 23:30 → endStr = 00:00 next day
    const lateIsha = {
      date: "2025-06-15", latitude: 24.86, longitude: 67.01, method: "MWL",
      Fajr: "03:45", Dhuhr: "12:30", Asr: "16:15", Maghrib: "19:45",
      Isha: "23:30",
    }
    const windows = provider.computeWindows(lateIsha, { preBlockMinutes: 5, postBlockMinutes: 30 })
    const isha = windows.find((w) => w.prayerName === "Isha")
    expect(isha).toBeDefined()
    expect(isha!.startStr).toBe("23:25")
    expect(isha!.endStr).toBe("00:00")
  })

  it("handles Fajr pre-block crossing midnight from previous day", () => {
    // Fajr at 03:00 with 30m preBlock → startStr = 02:30
    const earlyFajr = {
      date: "2025-06-15", latitude: 24.86, longitude: 67.01, method: "MWL",
      Fajr: "03:00", Dhuhr: "12:30", Asr: "16:15", Maghrib: "19:45",
      Isha: "21:00",
    }
    const windows = provider.computeWindows(earlyFajr, { preBlockMinutes: 30, postBlockMinutes: 5 })
    const fajr = windows.find((w) => w.prayerName === "Fajr")
    expect(fajr!.startStr).toBe("02:30")
    expect(fajr!.endStr).toBe("03:05")
  })

  it("always returns exactly 5 windows", () => {
    const windows = provider.computeWindows(sampleTimes, { preBlockMinutes: 5, postBlockMinutes: 5 })
    expect(windows).toHaveLength(5)

    const names = windows.map((w) => w.prayerName)
    expect(names).toEqual(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"])
  })

  // ---- Date objects have correct boundaries ----

  it("window start/end Date objects are at correct times", () => {
    const windows = provider.computeWindows(sampleTimes, { preBlockMinutes: 10, postBlockMinutes: 10 })
    const asr = windows.find((w) => w.prayerName === "Asr")
    expect(asr).toBeDefined()
    expect(asr!.start.getHours()).toBe(16)
    expect(asr!.start.getMinutes()).toBe(5)
    expect(asr!.end.getHours()).toBe(16)
    expect(asr!.end.getMinutes()).toBe(25)
  })
})

// ==========================================================================
// 2. Settings persistence through InMemoryStorageAdapter
// ==========================================================================

describe("NamazSettings persistence", () => {
  beforeEach(async () => {
    await getFreshNamazSettings()
  })

  it("returns default namaz settings", async () => {
    const settings = await inMemoryStorage.getNamazSettings()
    expect(settings).not.toBeNull()
    expect(settings!.isEnabled).toBe(false)
    expect(settings!.preBlockMinutes).toBe(5)
    expect(settings!.postBlockMinutes).toBe(5)
    expect(settings!.blockedPlatformIds).toEqual([])
    expect(settings!.prayerWindows).toEqual([])
  })

  it("saves and restores isEnabled", async () => {
    await inMemoryStorage.updateNamazSettings({ isEnabled: true })
    const settings = await inMemoryStorage.getNamazSettings()
    expect(settings!.isEnabled).toBe(true)
  })

  it("saves blocked platforms", async () => {
    await inMemoryStorage.updateNamazSettings({ blockedPlatformIds: ["plat-1", "plat-2"] })
    const settings = await inMemoryStorage.getNamazSettings()
    expect(settings!.blockedPlatformIds).toEqual(["plat-1", "plat-2"])
  })

  it("saves pre/post block minutes", async () => {
    await inMemoryStorage.updateNamazSettings({ preBlockMinutes: 10, postBlockMinutes: 15 })
    const settings = await inMemoryStorage.getNamazSettings()
    expect(settings!.preBlockMinutes).toBe(10)
    expect(settings!.postBlockMinutes).toBe(15)
  })

  it("partial update does not wipe other fields", async () => {
    await inMemoryStorage.updateNamazSettings({ preBlockMinutes: 10 })
    await inMemoryStorage.updateNamazSettings({ isEnabled: true })
    const settings = await inMemoryStorage.getNamazSettings()
    expect(settings!.preBlockMinutes).toBe(10)
    expect(settings!.postBlockMinutes).toBe(5)
    expect(settings!.isEnabled).toBe(true)
  })
})

// ==========================================================================
// 3. NamazModeRule integration — engine blocks during window
// ==========================================================================

describe("NamazModeRule — engine integration", () => {
  let evaluator: BlockingEvaluator
  let rule: NamazModeRule

  beforeEach(() => {
    rule = new NamazModeRule()
    evaluator = new BlockingEvaluator([rule])
  })

  function buildCtx(windows: CoreNamazWindow[] = [], now = new Date("2025-06-15T12:00:00")): EvaluationContext {
    return {
      userId: "user-1",
      userTimezone: "UTC",
      now,
      platforms: [{ id: "p-1", name: "YouTube", category: "Video", dailyLimitMinutes: 90, isActive: true, hosts: ["youtube.com"] }],
      dailyUsage: new Map(),
      activeFocusSessions: [],
      scheduledBlocks: [],
      namazWindows: windows,
    }
  }

  it("returns NOT_BLOCKED when no windows exist", () => {
    const decisions = evaluator.evaluateAll(buildCtx())
    for (const [, d] of decisions.decisions) {
      expect(d.isBlocked).toBe(false)
    }
  })

  it("blocks platform during an active window", () => {
    const windows = [
      makeWindow("Dhuhr", 12 * 60, 12 * 60 + 5), // 12:00–12:05
    ]
    const decisions = evaluator.evaluateAll(buildCtx(windows))
    expect(decisions.hasAnyBlock).toBe(true)
  })

  it("allows platform right after window ends", () => {
    // Window 12:00–12:05, now 12:06
    const windows = [
      makeWindow("Dhuhr", 12 * 60, 12 * 60 + 5),
    ]
    const now = new Date("2025-06-15T12:06:00")
    const decisions = evaluator.evaluateAll(buildCtx(windows, now))
    expect(decisions.hasAnyBlock).toBe(false)
  })

  it("allows platform before window starts", () => {
    // Window 12:00–12:05, now 11:55
    const windows = [
      makeWindow("Dhuhr", 12 * 60, 12 * 60 + 5),
    ]
    const now = new Date("2025-06-15T11:55:00")
    const decisions = evaluator.evaluateAll(buildCtx(windows, now))
    expect(decisions.hasAnyBlock).toBe(false)
  })

  it("handles midnight-crossing window (postBlock extends past midnight)", () => {
    // Window crossing midnight: start 23:30, end 00:30 next day
    const midnightStart = 23 * 60 + 30
    const midnightEnd = 0 * 60 + 30
    const windows = [
      makeWindow("Isha-Midnight", midnightStart, midnightEnd),
    ]

    // 23:35 — should block
    const decisionsActive = evaluator.evaluateAll(buildCtx(windows, new Date("2025-06-15T23:35:00")))
    expect(decisionsActive.hasAnyBlock).toBe(true)

    // 00:05 — should block
    const decisionsAfter = evaluator.evaluateAll(buildCtx(windows, new Date("2025-06-16T00:05:00")))
    expect(decisionsAfter.hasAnyBlock).toBe(true)

    // 00:35 — should NOT block
    const decisionsDone = evaluator.evaluateAll(buildCtx(windows, new Date("2025-06-16T00:35:00")))
    expect(decisionsDone.hasAnyBlock).toBe(false)
  })

  it("propagates namaz decision through full evaluator chain", () => {
    const rule = new NamazModeRule()
    const evaluator = new BlockingEvaluator([rule])

    const windows = [
      makeWindow("Fajr", 3 * 60 + 30, 3 * 60 + 40), // 03:30–03:40
    ]
    const now = new Date("2025-06-15T03:35:00")

    const ctx: EvaluationContext = {
      userId: "user-1",
      userTimezone: "UTC",
      now,
      platforms: [{ id: "plat-1", name: "Instagram", category: "Social", dailyLimitMinutes: 60, isActive: true }],
      dailyUsage: new Map([["plat-1", 30]]),
      activeFocusSessions: [],
      scheduledBlocks: [],
      namazWindows: windows,
    }

    const decisions = evaluator.evaluateAll(ctx)
    expect(decisions.decisions.has("plat-1")).toBe(true)
    const d = decisions.decisions.get("plat-1")!
    expect(d.isBlocked).toBe(true)
    expect(d.reason?.type).toBe("NAMAZ_MODE")
    expect(d.reason?.prayerName).toBe("Fajr")
    expect(d.activeRules).toContain("NamazModeRule")
  })
})

// ==========================================================================
// 4. Prayer settings restore — settings persist + reload
// ==========================================================================

describe("Prayer settings round-trip", () => {
  beforeEach(async () => {
    await getFreshNamazSettings()
  })

  it("saves prayer windows alongside settings", async () => {
    const windows = [
      { start: "03:35", end: "03:50", prayerName: "Fajr" },
      { start: "12:25", end: "12:40", prayerName: "Dhuhr" },
    ]

    await inMemoryStorage.updateNamazSettings({
      isEnabled: true,
      preBlockMinutes: 10,
      postBlockMinutes: 10,
      prayerWindows: windows,
    })

    const s = await inMemoryStorage.getNamazSettings()
    expect(s!.isEnabled).toBe(true)
    expect(s!.preBlockMinutes).toBe(10)
    expect(s!.prayerWindows).toHaveLength(2)
    expect(s!.prayerWindows![0].start).toBe("03:35")
    expect(s!.prayerWindows![0].prayerName).toBe("Fajr")
  })
})
