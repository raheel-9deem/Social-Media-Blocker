// ==========================================================================
// useEngine — React hook that wires the core domain engine to live data
// from the storage adapter and Zustand stores.
// ==========================================================================

import { useMemo, useCallback, useEffect, useRef, useState } from "react"
import {
  BlockingEvaluator,
  DailyLimitRule,
  FocusModeRule,
  ScheduledBlockRule,
  NamazModeRule,
  UsageAccumulator,
  DailyResetManager,
  type Platform,
  type EvaluationContext,
  type EvaluationResult,
  type FocusSession,
  type ScheduledBlock,
  type NamazWindow,
} from "@/core"
import { inMemoryStorage, profile } from "@/adapters/storage/InMemoryStorageAdapter"
import { useTimerStore } from "@/store/timerStore"
import { useBlockingStore } from "@/store/blockingStore"
import { notificationAdapter } from "@/adapters/notifications/WebNotificationAdapter"
import { reportError } from "@/lib/errors/AppError"

// Build override map from platform dailyLimitMinutes
function buildOverrideMap(plats: Platform[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of plats) {
    map.set(`*:${p.id}`, p.dailyLimitMinutes)
  }
  return map
}

/** Evaluated result cached until dependencies change */
export interface EngineState {
  evaluator: BlockingEvaluator
  accumulator: UsageAccumulator
  resetManager: DailyResetManager
  lastResult: EvaluationResult | null
  evaluate: () => Promise<EvaluationResult>
  ingestLogs: () => Promise<void>
  lastEvaluated: Date | null
}

export function useEngine(): EngineState {
  const timerStore = useTimerStore()
  const { setAllBlocks } = useBlockingStore()

  const accumulatorRef = useRef<UsageAccumulator>(new UsageAccumulator())
  const platformsRef = useRef<Platform[]>([])
  const focusSessionsRef = useRef<FocusSession[]>([])
  const scheduledBlocksRef = useRef<ScheduledBlock[]>([])
  const namazRef = useRef<NamazWindow[] | null>(null)
  const lastResultRef = useRef<EvaluationResult | null>(null)
  const [lastEvaluated, setLastEvaluated] = useState<Date | null>(null)

  // Evaluator — created once
  const evaluator = useMemo<BlockingEvaluator>(() => {
    const overrides = buildOverrideMap(platformsRef.current)

    return new BlockingEvaluator([
      new DailyLimitRule({
        overrides,
        onLimitExceeded: (platformId: string) => {
          const plat = platformsRef.current.find((p: Platform) => p.id === platformId)
          if (plat) notificationAdapter.notifyLimitExceeded(plat.name)
        },
      }),
      new FocusModeRule(),
      new ScheduledBlockRule(),
      new NamazModeRule(),
    ])
  }, [])

  const resetManager = useMemo(() => new DailyResetManager(), [])

  // Load data from storage into accumulator on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [plats, logs] = await Promise.all([
          inMemoryStorage.listPlatforms(),
          inMemoryStorage.getUsageLogs(new Date(0), new Date()),
        ])
        if (cancelled) return
        platformsRef.current = plats

        const acc = accumulatorRef.current
        acc.ingest(profile.id, logs)
      } catch (e) {
        reportError(e)
      }
    }

    load()

    const unsub = inMemoryStorage.subscribeToChanges(async () => {
      const plats = await inMemoryStorage.listPlatforms()
      platformsRef.current = plats
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  // Reload usage logs when timer sessions change
  useEffect(() => {
    const hasActive = timerStore.sessions.some((s) => s.isRunning)
    if (!hasActive) return

    const interval = setInterval(async () => {
      const hasStillActive = timerStore.sessions.some((s) => s.isRunning)
      if (!hasStillActive) return

      const logs = await inMemoryStorage.getUsageLogs(new Date(0), new Date())
      const newAcc = new UsageAccumulator()
      newAcc.ingest(profile.id, logs)
      accumulatorRef.current = newAcc
    }, 5000)

    return () => clearInterval(interval)
  }, [timerStore.sessions])

  // Load auxiliary data (focus, schedule, namaz)
  useEffect(() => {
    let cancelled = false

    async function loadAux() {
      try {
        const [focus, blocks, namazSettings] = await Promise.all([
          inMemoryStorage.getActiveFocusSession().then((s) => (s ? [s] : [])),
          inMemoryStorage.listScheduledBlocks(),
          inMemoryStorage.getNamazSettings(),
        ])
        if (cancelled) return
        focusSessionsRef.current = focus
        scheduledBlocksRef.current = blocks

        // Convert stored prayer window strings to NamazWindow[] for the engine
        if (namazSettings?.prayerWindows && namazSettings.prayerWindows.length > 0) {
          const today = new Date()
          const windows: NamazWindow[] = namazSettings.prayerWindows.map((w) => ({
            name: w.prayerName,
            start: new Date(`${today.toISOString().slice(0, 10)}T${w.start}:00`),
            end: new Date(`${today.toISOString().slice(0, 10)}T${w.end}:00`),
          }))
          namazRef.current = windows
        } else {
          namazRef.current = null
        }
      } catch {
        // ignore
      }
    }

    loadAux()

    const unsub = inMemoryStorage.subscribeToChanges(async () => {
      const [focus, blocks, namazSettings] = await Promise.all([
        inMemoryStorage.getActiveFocusSession().then((s) => (s ? [s] : [])),
        inMemoryStorage.listScheduledBlocks(),
        inMemoryStorage.getNamazSettings(),
      ])
      if (cancelled) return
      focusSessionsRef.current = focus
      scheduledBlocksRef.current = blocks

      if (namazSettings?.prayerWindows && namazSettings.prayerWindows.length > 0) {
        const today = new Date()
        const windows: NamazWindow[] = namazSettings.prayerWindows.map((w) => ({
          name: w.prayerName,
          start: new Date(`${today.toISOString().slice(0, 10)}T${w.start}:00`),
          end: new Date(`${today.toISOString().slice(0, 10)}T${w.end}:00`),
        }))
        namazRef.current = windows
      } else {
        namazRef.current = null
      }
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  // Track the last sent blocking key to avoid duplicate APPLY_BLOCK messages.
  // Using a ref (not state) because we don't want re-renders when it changes.
  const lastSentKeyRef = useRef<string>("")

  const evaluate = useCallback(async (): Promise<EvaluationResult> => {
    try {
      // Fetch latest platforms
      const plats = await inMemoryStorage.listPlatforms()
      platformsRef.current = plats

      // Build daily usage map from accumulator
      const now = new Date()
      const resetCheck = resetManager.getDayBoundary(now, profile.timezone)
      const dayDate = new Date(resetCheck.currentDayStart)
      const usageMap = accumulatorRef.current.getDayUsage(profile.id, dayDate)

      // Ensure all active platforms appear in usage map (even with 0)
      for (const p of plats) {
        if (!usageMap.has(p.id)) usageMap.set(p.id, 0)
      }

      const ctx: EvaluationContext = {
        userId: profile.id,
        userTimezone: profile.timezone,
        now,
        platforms: platformsRef.current,
        dailyUsage: usageMap,
        activeFocusSessions: focusSessionsRef.current,
        scheduledBlocks: scheduledBlocksRef.current,
        namazWindows: namazRef.current,
      }

      const result = evaluator.evaluateAll(ctx)
      lastResultRef.current = result

      // Update blocking store (triggers UI re-render)
      type BlockEntry = { status: "blocked" | "allowed"; reason: string | null; unblockAt: string | null; activeRules: string[] }
      const blockMap: Record<string, BlockEntry> = {}
      for (const [pid, decision] of result.decisions) {
        const reason = decision.reason
        let reasonStr: string | null = null
        if (reason?.type === "DAILY_LIMIT_EXCEEDED") reasonStr = "Daily limit reached"
        else if (reason?.type === "FOCUS_MODE") reasonStr = "Focus Mode active"
        else if (reason?.type === "SCHEDULED_BLOCK") reasonStr = reason.blockName
        else if (reason?.type === "NAMAZ_MODE") reasonStr = `Namaz: ${reason.prayerName}`

        blockMap[pid] = {
          status: decision.isBlocked ? "blocked" : "allowed",
          reason: reasonStr,
          unblockAt: decision.unblockAt,
          activeRules: decision.activeRules,
        }
      }
      setAllBlocks(blockMap as Record<string, { status: "blocked" | "allowed"; reason: string | null; unblockAt: string | null; activeRules: string[] }>)
      setLastEvaluated(now)

      // ---- Bridge: sync blocking decisions to background service worker ----
      // BUG FIX: Previously sent platform IDs (UUIDs) as blockedHosts.
      // Content script and declarativeNetRequest need actual domain hostnames.
      // Now we collect all hosts from blocked platforms.
      const blockedHosts: string[] = []
      for (const [pid, decision] of result.decisions) {
        if (decision.isBlocked) {
          const platform = plats.find(p => p.id === pid)
          if (platform?.hosts) {
            blockedHosts.push(...platform.hosts)
          }
        }
      }

      // Find earliest unblock timestamp (e.g. Focus session endsAt)
      let minUnblockAt: number | null = null
      for (const [, decision] of result.decisions) {
        if (decision.isBlocked && decision.unblockAt) {
          const t = new Date(decision.unblockAt).getTime()
          if (!isNaN(t) && (!minUnblockAt || t < minUnblockAt)) {
            minUnblockAt = t
          }
        }
      }

      // Deduplicate: only send APPLY_BLOCK if the blocked hosts list or expiration changed
      const newKey = `${blockedHosts.sort().join(",")}|${minUnblockAt || 0}`
      if (newKey !== lastSentKeyRef.current) {
        lastSentKeyRef.current = newKey
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: "APPLY_BLOCK",
            isBlocked: blockedHosts.length > 0,
            blockedHosts: blockedHosts,
            expiresAt: minUnblockAt,
          }).catch(function () {
            // Extension context may not be available (dev mode)
          })
        }
      }

      return result
    } catch (e) {
      reportError(e)
      return { decisions: new Map(), hasAnyBlock: false }
    }
  }, [evaluator, resetManager, setAllBlocks])

  const ingestLogs = useCallback(async () => {
    const logs = await inMemoryStorage.getUsageLogs(new Date(0), new Date())
    accumulatorRef.current.ingest(profile.id, logs)
  }, [])

  return useMemo(() => ({
    evaluator,
    accumulator: accumulatorRef.current,
    resetManager,
    lastResult: lastResultRef.current,
    evaluate,
    ingestLogs,
    lastEvaluated,
  }), [evaluator, resetManager, evaluate, ingestLogs, lastEvaluated])
}
