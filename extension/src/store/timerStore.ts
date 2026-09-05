import { create } from "zustand"

export interface TrackingSession {
  id: string
  platformId: string
  platformName: string
  startedAt: number
  elapsedSec: number
  isRunning: boolean
}

interface TimerState {
  sessions: TrackingSession[]
  activeTimerId: string | null

  startSession: (platformId: string, platformName: string) => void
  stopSession: (id: string) => void
  tick: () => void
  getElapsed: (id: string) => number
}

export const useTimerStore = create<TimerState>((set, get) => ({
  sessions: [],
  activeTimerId: null,

  startSession: (platformId, platformName) => {
    const id = crypto.randomUUID()
    set({
      sessions: [
        ...get().sessions,
        {
          id,
          platformId,
          platformName,
          startedAt: Date.now(),
          elapsedSec: 0,
          isRunning: true,
        },
      ],
      activeTimerId: id,
    })
  },

  stopSession: (id) =>
    set((s) => ({
      sessions: s.sessions.map((sesh) =>
        sesh.id === id ? { ...sesh, isRunning: false } : sesh
      ),
      activeTimerId: s.activeTimerId === id ? null : s.activeTimerId,
    })),

  tick: () =>
    set((s) => ({
      sessions: s.sessions.map((sesh) =>
        sesh.isRunning ? { ...sesh, elapsedSec: sesh.elapsedSec + 1 } : sesh
      ),
    })),

  getElapsed: (id) => get().sessions.find((s) => s.id === id)?.elapsedSec ?? 0,
}))
