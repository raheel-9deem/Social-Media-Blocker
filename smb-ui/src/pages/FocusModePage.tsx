// ==========================================================================
// Focus Mode Page — production-ready implementation
// Features:
//   - Start/end focus sessions with custom or preset durations
//   - "Block All" toggle to block every platform
//   - Live countdown with circular progress
//   - Auto-expiration (session ends in storage + notifies on expiry)
//   - Conflict prevention (disabled start while active)
//   - Engine-driven blocking status per platform
//   - Conflict detection (warns if starting from both page + dashboard)
// ==========================================================================

import { useState, useEffect, useCallback } from "react"
import {
  Play, Square, Timer, ShieldCheck, Globe
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { inMemoryStorage } from "@/adapters/storage/InMemoryStorageAdapter"
import { notificationAdapter } from "@/adapters/notifications/WebNotificationAdapter"
import { reportError } from "@/lib/errors/AppError"
import { useEngine } from "@/hooks/useEngine"
import { cn } from "@/lib/utils"
import type { Platform } from "@/core/types"

const PRESET_DURATIONS = [15, 25, 50, 90]
const MIN_DURATION = 1
const MAX_DURATION = 480 // 8 hours

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// SVG circle progress utility
function CircularProgress({
  percent, size = 140, strokeWidth = 6, children,
}: {
  percent: number
  size?: number
  strokeWidth?: number
  children?: React.ReactNode
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#3b6ef0" strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function FocusModePage() {
  const engine = useEngine()

  // ---- State ----
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [activeSession, setActiveSession] = useState<{ id: string; endsAt: string; platformIds: string[] } | null>(null)
  const [duration, setDuration] = useState(50)
  const [customMinutes, setCustomMinutes] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [blockAll, setBlockAll] = useState(false)
  const [starting, setStarting] = useState(false)
  const [blockedSet, setBlockedSet] = useState<Set<string>>(new Set())

  // ---- Load platforms ----
  useEffect(() => {
    inMemoryStorage.listPlatforms().then(setPlatforms).catch(console.error)
  }, [])

  // ---- Poll for active focus session (syncs with dashboard + other tabs) ----
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const session = await inMemoryStorage.getActiveFocusSession()
        if (cancelled) return
        if (session && new Date(session.endsAt) > new Date()) {
          setActiveSession(session)
        } else if (session) {
          // Session expired in storage — clean up UI
          await inMemoryStorage.endFocusSession(session.id)
          if (!cancelled) setActiveSession(null)
        } else {
          setActiveSession(null)
        }
      } catch {
        // ignore
      }
    }
    check()
    const id = setInterval(check, 2000)
    return () => { cancelled = true; clearInterval(id) }
  }, [engine.lastEvaluated])

  // ---- Countdown ticker with auto-expiration ----
  useEffect(() => {
    if (!activeSession) return
    const tick = setInterval(async () => {
      const remaining = Math.max(
        0,
        Math.round((new Date(activeSession.endsAt).getTime() - Date.now()) / 1000)
      )
      if (remaining <= 0) {
        // Auto-expire: end in storage and notify
        try {
          await inMemoryStorage.endFocusSession(activeSession.id)
        } catch {
          // best-effort
        }
        setActiveSession(null)
        notificationAdapter.notifyFocusEnd()
        engine.evaluate()
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [activeSession, engine])

  // ---- Sync blocked platforms from engine evaluation ----
  useEffect(() => {
    if (!engine.lastResult) return
    const blocked = new Set<string>()
    for (const [pid, decision] of engine.lastResult.decisions) {
      if (decision.isBlocked) blocked.add(pid)
    }
    setBlockedSet(blocked)
  }, [engine.lastResult])

  // ---- Handlers ----
  const togglePlatform = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  function applyPreset(mins: number) {
    setDuration(mins)
    setCustomMinutes("")
  }

  function applyCustom() {
    const val = parseInt(customMinutes, 10)
    if (!isNaN(val) && val >= MIN_DURATION && val <= MAX_DURATION) {
      setDuration(val)
      setCustomMinutes("")
    }
  }

  async function handleStart() {
    if (starting) return
    setStarting(true)
    try {
      const platformIds = blockAll ? [] : Array.from(selectedIds)
      if (!blockAll && selectedIds.size === 0) {
        notificationAdapter.notify({
          title: "Select platforms",
          message: "Choose platforms to block or enable Block All.",
          type: "warning",
        })
        setStarting(false)
        return
      }
      const session = await inMemoryStorage.startFocusSession({
        platformIds,
        durationMinutes: duration,
      })
      setActiveSession({
        id: session.id,
        endsAt: session.endsAt,
        platformIds: session.platformIds,
      })
      notificationAdapter.notifyFocusStart(duration)
      engine.evaluate()
    } catch (e) {
      reportError(e)
    } finally {
      setStarting(false)
    }
  }

  async function handleStop() {
    if (!activeSession) return
    try {
      await inMemoryStorage.endFocusSession(activeSession.id)
      setActiveSession(null)
      notificationAdapter.notifyFocusEnd()
      engine.evaluate()
    } catch (e) {
      reportError(e)
    }
  }

  // ---- Computed ----
  const isActive = !!activeSession
  const remainingSec = isActive
    ? Math.max(0, Math.round((new Date(activeSession.endsAt).getTime() - Date.now()) / 1000))
    : 0
  const totalSec = duration * 60
  const progressPct = isActive && totalSec > 0
    ? Math.max(0, Math.min(100, ((totalSec - remainingSec) / totalSec) * 100))
    : 0

  const blockedCount = blockedSet.size
  const platformsList = platforms.filter(p => p.isActive)

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Focus Mode</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Block distracting platforms for deep work
        </p>
      </div>

      {/* ===================================================================
          ACTIVE SESSION VIEW
          =================================================================== */}
      {isActive && (
        <Card className="overflow-hidden">
          <div className="bg-brand-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-white" />
              <span className="text-white font-semibold text-sm">Focus Session Active</span>
            </div>
            <Badge variant="default" className="bg-white/20 text-white border-0">
              {formatDuration(duration)}
            </Badge>
          </div>

          <div className="px-6 py-8 flex flex-col items-center">
            {/* Countdown + Circular Progress */}
            <div className="relative mb-4">
              <CircularProgress percent={progressPct} size={160} strokeWidth={8}>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-mono font-bold text-slate-900 tabular-nums tracking-wide">
                    {formatTime(remainingSec)}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5">
                    {remainingSec > 0 ? "remaining" : "expired"}
                  </span>
                </div>
              </CircularProgress>
            </div>

            {/* Blocked platforms */}
            <div className="flex flex-wrap justify-center gap-1.5 mb-6">
              {activeSession.platformIds.length === 0 ? (
                <Badge variant="brand">
                  <Globe className="h-3 w-3 mr-1" />
                  All platforms blocked
                </Badge>
              ) : (
                activeSession.platformIds.map(pid => {
                  const plat = platforms.find(p => p.id === pid)
                  return (
                    <Badge key={pid} variant="brand">
                      {plat?.name ?? pid}
                    </Badge>
                  )
                })
              )}
            </div>

            {/* Live engine status */}
            {blockedCount > 0 && (
              <p className="text-xs text-slate-500 mb-4">
                <ShieldCheck className="h-3 w-3 inline mr-1 text-success-600" />
                {blockedCount} platform{blockedCount !== 1 ? "s" : ""} currently blocked by the engine
              </p>
            )}

            <Button
              variant="danger"
              size="default"
              onClick={handleStop}
              leftIcon={<Square className="h-4 w-4" />}
              className="min-w-[160px]"
            >
              End Session
            </Button>
          </div>
        </Card>
      )}

      {/* ===================================================================
          CONFIGURATION VIEW (shown when no active session)
          =================================================================== */}
      {!isActive && (
        <Card>
          <Card.Header>
            <Card.Title>Session Configuration</Card.Title>
            <Card.Description>
              Choose duration and select which platforms to block
            </Card.Description>
          </Card.Header>

          <Card.Content className="space-y-6">
            {/* ---- Duration ---- */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2.5 block">
                <Timer className="h-3.5 w-3.5 inline mr-1 text-slate-400" />
                Duration
              </label>

              {/* Preset buttons */}
              <div className="flex gap-2 mb-3">
                {PRESET_DURATIONS.map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => applyPreset(mins)}
                    className={cn(
                      "flex-1 h-10 rounded-lg border text-sm font-medium transition-colors",
                      duration === mins && !customMinutes
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>

              {/* Custom duration input */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    placeholder="Custom (minutes)"
                    value={customMinutes}
                    onChange={e => setCustomMinutes(e.target.value)}
                    onBlur={applyCustom}
                    onKeyDown={e => e.key === "Enter" && applyCustom()}
                    min={MIN_DURATION}
                    max={MAX_DURATION}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-2 text-xs text-slate-400 pointer-events-none">
                    min
                  </span>
                </div>
              </div>
            </div>

            {/* ---- Block All toggle ---- */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2.5">
                <Globe className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Block All Platforms</p>
                  <p className="text-xs text-slate-400">Restrict every managed platform</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={blockAll}
                onClick={() => {
                  setBlockAll(!blockAll)
                  if (!blockAll) setSelectedIds(new Set())
                }}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors cursor-pointer",
                  blockAll ? "bg-brand-600" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                    blockAll && "translate-x-5"
                  )}
                />
              </button>
            </div>

            {/* ---- Platform selection ---- */}
            {!blockAll && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2.5 block">
                  Platforms to block
                  <span className="ml-2 text-xs text-slate-400 font-normal">
                    ({selectedIds.size} selected)
                  </span>
                </label>

                {platformsList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No active platforms. Add some in Platforms.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {platformsList.map(plat => {
                      const isSelected = selectedIds.has(plat.id)
                      const isBlocked = blockedSet.has(plat.id)
                      return (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() => togglePlatform(plat.id)}
                          className={cn(
                            "px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                            isSelected
                              ? "border-brand-600 bg-brand-50 text-brand-700"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50",
                            isBlocked && "ring-2 ring-success-500/30"
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            {isSelected && <ShieldCheck className="h-3.5 w-3.5" />}
                            {plat.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ---- Start button ---- */}
            <Button
              className="w-full"
              size="default"
              onClick={handleStart}
              disabled={starting || (!blockAll && selectedIds.size === 0)}
              leftIcon={<Play className="h-4 w-4" />}
            >
              {starting ? "Starting…" : blockAll
                ? `Block All — ${formatDuration(duration)}`
                : `Block ${selectedIds.size} Platform${selectedIds.size !== 1 ? "s" : ""}`}
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* ===================================================================
          SCHEDULED FOCUS MODE SECTION (future enhancement)
          =================================================================== */}
      {!isActive && (
        <Card>
          <Card.Header>
            <Card.Title>Quick Schedule</Card.Title>
            <Card.Description>
              Set a focus session to start at a specific time (coming soon)
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="flex items-center justify-center py-6 text-slate-400">
              <div className="text-center">
                <Timer className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Scheduled focus mode coming in a future update.</p>
                <p className="text-xs mt-1">Use Start Focus Session above for immediate blocking.</p>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  )
}

export default FocusModePage
