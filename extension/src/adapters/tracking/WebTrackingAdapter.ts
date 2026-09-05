// ==========================================================================
// WebTrackingAdapter — manual session timer for the Web MVP.
//
// In the future, a browser extension will provide an ExtensionTrackingAdapter
// that listens to webNavigation/tabs API for automatic tracking.
// ==========================================================================

import type { CreateUsageLog } from "../storage/StorageAdapter"
import { useTimerStore } from "@/store/timerStore"
import { inMemoryStorage } from "../storage/InMemoryStorageAdapter"

/**
 * WebTrackingAdapter manages manual timer sessions.
 * It delegates visible state to the Zustand timer store (so the UI
 * re-renders reactively) and persists completed sessions through the
 * storage adapter.
 */
export class WebTrackingAdapter {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private readonly TICK_MS = 1000

  /**
   * Start a manual tracking session for a platform.
   * Stops any currently running session first.
   */
  async startSession(platformId: string, platformName: string): Promise<void> {
    // Stop any running session
    await this.stopAll()

    const store = useTimerStore.getState()
    store.startSession(platformId, platformName)

    // Tick every second
    if (this.intervalId) clearInterval(this.intervalId)
    this.intervalId = setInterval(() => {
      useTimerStore.getState().tick()
    }, this.TICK_MS)
  }

  /**
   * Stop the currently running session and persist it as a usage log.
   * If nothing is running, this is a no-op.
   */
  async stopSession(): Promise<CreateUsageLog | null> {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    const store = useTimerStore.getState()
    const active = store.sessions.find((s) => s.isRunning)
    if (!active) return null

    const endedAt = new Date()
    const startedAt = new Date(active.startedAt)
    const durationSec = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)

    store.stopSession(active.id)

    if (durationSec < 5) return null // ignore <5s sessions (accidental clicks)

    const logEntry: CreateUsageLog = {
      platformId: active.platformId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSec,
      source: "manual",
    }

    await inMemoryStorage.recordUsageLog(logEntry)
    return logEntry
  }

  /**
   * Stop all sessions and return the persisted logs.
   */
  async stopAll(): Promise<CreateUsageLog[]> {
    const persisted: CreateUsageLog[] = []
    const store = useTimerStore.getState()

    while (store.sessions.some((s) => s.isRunning)) {
      const active = store.sessions.find((s) => s.isRunning)
      if (!active) break
      const result = await this.stopSession()
      if (result) persisted.push(result)
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    return persisted
  }

  /** Stop the tick interval without persisting (e.g. on unmount) */
  stopTick(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}

// Singleton
export const trackingAdapter = new WebTrackingAdapter()
