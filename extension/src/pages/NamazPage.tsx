// ==========================================================================
// Namaz Mode — auto-block platforms during prayer windows.
// ==========================================================================
//
// Prayer times are approximate. They are computed from the Aladhan API
// using the selected calculation method and the browser's detected timezone.
// Times can vary by location, method, and local convention — this feature
// does NOT present them as religiously authoritative.
//
// Blocking runs through the existing NamazModeRule in the engine;
// this page only configures the settings. No separate blocking logic.
// ==========================================================================

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Moon, Sun, Clock, ShieldCheck, Settings2,
  MapPin, RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Toggle } from "@/components/ui/Toggle"
import { inMemoryStorage } from "@/adapters/storage/InMemoryStorageAdapter"
import { useEngine } from "@/hooks/useEngine"
import {
  getPrayerTimeProvider,
  CALCULATION_METHODS,
  type PrayerTimes,
  type PrayerWindow,
} from "@/core/services/PrayerTimeProvider"
import { type NamazSettings } from "@/adapters/storage/StorageAdapter"
import { reportError } from "@/lib/errors/AppError"
import { cn } from "@/lib/utils"
import type { Platform } from "@/core/types"

// ---- Helpers ----

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

/** Approximate lat/lng for known timezones (fallback for API) */
function timezoneToApproxCoord(tz: string): { lat: number; lng: number } {
  const map: Record<string, { lat: number; lng: number }> = {
    "Asia/Karachi":        { lat: 24.86, lng: 67.01 },
    "Asia/Dubai":          { lat: 25.20, lng: 55.27 },
    "Asia/Riyadh":         { lat: 24.71, lng: 46.68 },
    "Asia/Kolkata":        { lat: 19.08, lng: 72.88 },
    "Asia/Dhaka":          { lat: 23.81, lng: 90.41 },
    "Asia/Jakarta":        { lat: -6.21, lng: 106.85 },
    "America/New_York":    { lat: 40.71, lng: -74.01 },
    "America/Chicago":     { lat: 41.88, lng: -87.63 },
    "America/Denver":      { lat: 39.74, lng: -104.99 },
    "America/Los_Angeles": { lat: 34.05, lng: -118.24 },
    "Europe/London":       { lat: 51.51, lng: -0.13 },
    "Europe/Paris":        { lat: 48.86, lng: 2.35 },
    "Australia/Sydney":    { lat: -33.87, lng: 151.21 },
  }
  return map[tz] ?? { lat: 21.42, lng: 39.83 }
}

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
}

const PRAYER_METHODS = ["MWL", "ISNA", "EGAS", "UmmAlQura", "Karachi"] as const
const PRAYER_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const
const PRAYER_ICONS: Record<string, string> = {
  Fajr: "🌅", Dhuhr: "☀️", Asr: "🌤", Maghrib: "🌇", Isha: "🌙",
}

// ===========================================================================
// Component
// ===========================================================================

function NamazPage() {
  const engine = useEngine()
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [settings, setSettings] = useState<NamazSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null)
  const [windows, setWindows] = useState<PrayerWindow[]>([])
  const [fetchingTimes, setFetchingTimes] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detectedTz = useMemo(() => detectTimezone(), [])

  // ---- Load platforms ----
  useEffect(() => {
    inMemoryStorage.listPlatforms()
      .then(setPlatforms)
      .catch(() => {})
  }, [])

  // ---- Load settings ----
  useEffect(() => {
    let cancelled = false
    inMemoryStorage.getNamazSettings().then((s) => {
      if (cancelled) return
      setSettings(s)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [engine.lastEvaluated])

  // ---- Fetch prayer times when settings change ----
  useEffect(() => {
    if (!settings?.isEnabled) {
      setPrayerTimes(null)
      setWindows([])
      return
    }

    const coords = timezoneToApproxCoord(detectedTz)

    let cancelled = false
    setFetchingTimes(true)
    setError(null)

    const provider = getPrayerTimeProvider()
    const todayDate = new Date()

    provider.getPrayerTimes(todayDate, coords.lat, coords.lng, settings.calculationMethod as typeof PRAYER_METHODS[number])
      .then((times) => {
        if (cancelled) return
        setPrayerTimes(times)

        // Compute blocking windows
        const wins = provider.computeWindows(times, {
          preBlockMinutes: settings.preBlockMinutes,
          postBlockMinutes: settings.postBlockMinutes,
        })
        setWindows(wins)

        // Persist windows to storage so the engine can use them
        const windowEntries = wins.map((w) => ({
          start: w.startStr,
          end: w.endStr,
          prayerName: w.prayerName,
        }))

        return inMemoryStorage.updateNamazSettings({ prayerWindows: windowEntries })
      })
      .then(() => {
        engine.evaluate()
      })
      .catch(() => {
        if (cancelled) return
        setError("Could not load prayer times. Check your connection.")
      })
      .finally(() => {
        if (!cancelled) setFetchingTimes(false)
      })

    return () => { cancelled = true }
  }, [settings?.isEnabled, settings?.calculationMethod, settings?.preBlockMinutes, settings?.postBlockMinutes, detectedTz, engine])

  // ---- Save settings ----
  const saveSettings = useCallback(async (updates: Partial<NamazSettings>) => {
    setSaving(true)
    try {
      await inMemoryStorage.updateNamazSettings(updates)
      const updated = await inMemoryStorage.getNamazSettings()
      if (updated) {
        setSettings(updated)
      }
    } catch {
      reportError(new Error("Failed to save namaz settings"))
    } finally {
      setSaving(false)
    }
  }, [])

  // ---- Determine next prayer from windows ----
  const nextPrayer = useMemo(() => {
    if (windows.length === 0) return null
    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    let upcoming: { name: string; isActive: boolean; time: string; windowStart: string; windowEnd: string } | null = null

    for (const win of windows) {
      const [sh, sm] = win.startStr.split(":").map(Number)
      const startMin = sh * 60 + sm
      const [eh, em] = win.endStr.split(":").map(Number)
      let endMin = eh * 60 + em
      if (endMin < startMin) endMin += 24 * 60 // crosses midnight

      const isActive = currentTime >= startMin && (endMin > 24 * 60 || currentTime < endMin % (24 * 60))
      const isUpcoming = startMin > currentTime

      if (isActive || isUpcoming) {
        const timeVal = prayerTimes?.[win.prayerName as keyof PrayerTimes] ?? win.startStr
        upcoming = {
          name: win.prayerName,
          isActive,
          time: String(timeVal),
          windowStart: win.startStr,
          windowEnd: win.endStr,
        }
        break
      }
    }

    // Past all prayers — next is tomorrow's first
    if (!upcoming && prayerTimes && windows.length > 0) {
      upcoming = {
        name: windows[0].prayerName,
        isActive: false,
        time: String(prayerTimes[windows[0].prayerName as keyof PrayerTimes]),
        windowStart: windows[0].startStr,
        windowEnd: windows[0].endStr,
      }
    }

    return upcoming
  }, [windows, prayerTimes])

  // ---- Blocked platforms ----
  const selectedPlatformIds = settings?.blockedPlatformIds ?? []

  // ---- Loading ----
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ---- Compute current method label for footer ----

  // ---- Render ----
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Namaz Mode</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Auto-block platforms at prayer times
          </p>
        </div>
        {settings?.isEnabled && (
          <Badge variant="brand">
            <Moon className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )}
      </div>

      {/* ==================================================================
          ENABLE / DISABLE
          ================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              settings?.isEnabled ? "bg-brand-50" : "bg-slate-100"
            )}>
              <Moon className={cn(
                "h-5 w-5",
                settings?.isEnabled ? "text-brand-600" : "text-slate-400"
              )} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Namaz Mode</p>
              <p className="text-xs text-slate-500">
                {settings?.isEnabled
                  ? `Blocking ${selectedPlatformIds.length} platform(s) during prayers`
                  : "Enable to block platforms during prayer windows"}
              </p>
            </div>
          </div>
          <Toggle
            checked={settings?.isEnabled ?? false}
            onCheckedChange={(v) => saveSettings({ isEnabled: v })}
          />
        </div>
      </div>

      {settings?.isEnabled && (
        <>
          {/* ==================================================================
              CALCULATION SETTINGS
              ================================================================== */}
          <CalculationSection
            timezone={detectedTz}
            method={settings.calculationMethod}
            timeFormat={settings.timeFormat}
            preBlockMinutes={settings.preBlockMinutes}
            postBlockMinutes={settings.postBlockMinutes}
            onMethodChange={(m) => saveSettings({ calculationMethod: m })}
            onTimeFormatChange={(f) => saveSettings({ timeFormat: f })}
            onPreBlockChange={(v) => saveSettings({ preBlockMinutes: v })}
            onPostBlockChange={(v) => saveSettings({ postBlockMinutes: v })}
            saving={saving}
          />

          {/* ==================================================================
              PLATFORMS TO BLOCK
              ================================================================== */}
          <PlatformSection
            platforms={platforms}
            selectedIds={selectedPlatformIds}
            onToggle={(id) => {
              const next = selectedPlatformIds.includes(id)
                ? selectedPlatformIds.filter((x) => x !== id)
                : [...selectedPlatformIds, id]
              saveSettings({ blockedPlatformIds: next })
            }}
            onBlockAll={() => saveSettings({ blockedPlatformIds: platforms.map((p) => p.id) })}
            onBlockNone={() => saveSettings({ blockedPlatformIds: [] })}
          />

          {/* ==================================================================
              TODAY'S PRAYER TIMES
              ================================================================== */}
          <PrayerTimesSection
            prayerTimes={prayerTimes}
            windows={windows}
            timeFormat={settings.timeFormat}
            nextPrayer={nextPrayer}
            fetching={fetchingTimes}
            error={error}
            methodLabel={CALCULATION_METHODS.find((m) => m.value === settings.calculationMethod)?.label ?? "selected"}
            onRefresh={() => {
              const coords = timezoneToApproxCoord(detectedTz)
              const provider = getPrayerTimeProvider()
              setFetchingTimes(true)
              setError(null)
              provider.getPrayerTimes(new Date(), coords.lat, coords.lng, settings.calculationMethod as typeof PRAYER_METHODS[number])
                .then((times) => {
                  setPrayerTimes(times)
                  const wins = provider.computeWindows(times, {
                    preBlockMinutes: settings.preBlockMinutes,
                    postBlockMinutes: settings.postBlockMinutes,
                  })
                  setWindows(wins)
                  return inMemoryStorage.updateNamazSettings({
                    prayerWindows: wins.map((w) => ({
                      start: w.startStr, end: w.endStr, prayerName: w.prayerName,
                    })),
                  })
                })
                .then(() => engine.evaluate())
                .catch(() => setError("Could not refresh prayer times."))
                .finally(() => setFetchingTimes(false))
            }}
          />
        </>
      )}
    </div>
  )
}

// ===========================================================================
// Sub-components
// ===========================================================================

interface CalculationProps {
  timezone: string
  method: string
  timeFormat: "12h" | "24h"
  preBlockMinutes: number
  postBlockMinutes: number
  onMethodChange: (m: string) => void
  onTimeFormatChange: (f: "12h" | "24h") => void
  onPreBlockChange: (v: number) => void
  onPostBlockChange: (v: number) => void
  saving: boolean
}

function CalculationSection({
  timezone, method, timeFormat, preBlockMinutes, postBlockMinutes,
  onMethodChange, onTimeFormatChange, onPreBlockChange, onPostBlockChange, saving,
}: CalculationProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="p-5 pb-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-brand-600" />
          Calculation Settings
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Approximate method — times can vary by location and convention
        </p>
      </div>
      <div className="px-5 pb-5 space-y-5">
        {/* Detected timezone */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin className="h-4 w-4 text-slate-400" />
          <span>Detected: <span className="font-medium text-slate-900">{timezone.replace("_", " ")}</span></span>
          <span className="text-xs text-slate-400" title="Detected from your browser settings">ⓘ</span>
        </div>

        {/* Calculation method */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Calculation Method
          </label>
          <select
            value={method}
            onChange={(e) => onMethodChange(e.target.value)}
            disabled={saving}
            className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
          >
            {CALCULATION_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label} ({m.description})
              </option>
            ))}
          </select>
        </div>

        {/* Time format */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Time Format
          </label>
          <div className="flex gap-2">
            {(["12h", "24h"] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onTimeFormatChange(val)}
                disabled={saving}
                className={cn(
                  "flex-1 h-9 rounded-lg border text-sm font-medium transition-colors",
                  timeFormat === val
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50",
                  "disabled:opacity-50"
                )}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Pre / Post block minutes */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Block before prayer
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={0} max={30} step={1}
                value={preBlockMinutes}
                onChange={(e) => onPreBlockChange(Number(e.target.value))}
                disabled={saving}
                className="flex-1 accent-brand-600"
              />
              <span className="text-sm text-slate-600 w-10 text-right tabular-nums">{preBlockMinutes}m</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Block after prayer
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={0} max={30} step={1}
                value={postBlockMinutes}
                onChange={(e) => onPostBlockChange(Number(e.target.value))}
                disabled={saving}
                className="flex-1 accent-brand-600"
              />
              <span className="text-sm text-slate-600 w-10 text-right tabular-nums">{postBlockMinutes}m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Platform selection ----

interface PlatformProps {
  platforms: Platform[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onBlockAll: () => void
  onBlockNone: () => void
}

function PlatformSection({ platforms, selectedIds, onToggle, onBlockAll, onBlockNone }: PlatformProps) {
  const activePlatforms = platforms.filter((p) => p.isActive)

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="p-5 pb-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          Platforms to Block
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">
          {selectedIds.length === 0
            ? "Select platforms to block during prayer windows"
            : `${selectedIds.length} platform(s) selected for blocking`}
        </p>
      </div>
      <div className="px-5 pb-5 space-y-3">
        {activePlatforms.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No active platforms. Add some in Platforms.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onBlockAll} className="text-xs">
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={onBlockNone} className="text-xs">
                Clear
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {activePlatforms.map((p) => {
                const isSelected = selectedIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onToggle(p.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                      isSelected
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {isSelected && <span className="mr-1">🛡</span>}
                    {p.name}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---- Prayer times display ----

interface PrayerTimesProps {
  prayerTimes: PrayerTimes | null
  windows: PrayerWindow[]
  timeFormat: "12h" | "24h"
  nextPrayer: { name: string; isActive: boolean; time: string; windowStart: string; windowEnd: string } | null
  fetching: boolean
  error: string | null
  methodLabel: string
  onRefresh: () => void
}

function PrayerTimesSection({ prayerTimes, windows, timeFormat, nextPrayer, fetching, error, methodLabel, onRefresh }: PrayerTimesProps) {
  if (!prayerTimes) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="text-center py-8">
          <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Enable Namaz Mode to load prayer times</p>
        </div>
      </div>
    )
  }

  const fmtTime = (t: string) => timeFormat === "12h" ? formatTime12(t) : t

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="p-5 pb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" />
            Today's Prayer Schedule
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Blocking windows shown in your local time ({timeFormat})
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={fetching} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", fetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Next prayer highlight */}
      {nextPrayer && (
        <div className="mx-5 mb-4 p-3 rounded-lg bg-brand-50 border border-brand-200 flex items-center gap-3">
          <span className="text-2xl">{PRAYER_ICONS[nextPrayer.name]}</span>
          <div>
            <p className="text-sm font-medium text-brand-800">
              {nextPrayer.isActive ? "Currently during" : "Next prayer"}: {nextPrayer.name}
            </p>
            <p className="text-xs text-brand-600">
              {nextPrayer.isActive
                ? `Blocked until ${fmtTime(nextPrayer.windowEnd)}`
                : `Window: ${fmtTime(nextPrayer.windowStart)} – ${fmtTime(nextPrayer.windowEnd)}`}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-5 mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700 flex items-start gap-1.5">
            <span className="shrink-0">ⓘ</span>
            {error}
          </p>
        </div>
      )}

      {/* Prayer list */}
      <div className="px-5 pb-5">
        <div className="space-y-2">
          {PRAYER_ORDER.map((prayer) => {
            const timeVal = prayerTimes[prayer as keyof PrayerTimes]
            const timeStr = typeof timeVal === "number" ? String(timeVal) : timeVal
            const win = windows.find((w) => w.prayerName === prayer)
            const isNext = !!(nextPrayer && nextPrayer.name === prayer && !nextPrayer.isActive)
            const isActive = !!(nextPrayer && nextPrayer.name === prayer && nextPrayer.isActive)

            return (
              <div
                key={prayer}
                className={cn(
                  "flex items-center justify-between rounded-lg px-4 py-3 transition-colors",
                  isActive && "bg-red-50 border border-red-200",
                  isNext && !isActive && "bg-brand-50 border border-brand-200",
                  !isActive && !isNext && "bg-slate-50 border border-slate-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{PRAYER_ICONS[prayer]}</span>
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      isActive ? "text-red-800" : isNext ? "text-brand-800" : "text-slate-700"
                    )}>
                      {prayer}
                      {isActive && <span className="ml-2 text-xs text-red-600 font-normal">Blocking now</span>}
                      {isNext && !isActive && <span className="ml-2 text-xs text-brand-600 font-normal">Next</span>}
                    </p>
                    {win && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Window: {fmtTime(win.startStr)} – {fmtTime(win.endStr)}
                      </p>
                    )}
                  </div>
                </div>
                <p className={cn(
                  "text-sm font-medium tabular-nums",
                  isActive ? "text-red-700" : isNext ? "text-brand-700" : "text-slate-900"
                )}>
                  {fmtTime(timeStr)}
                </p>
              </div>
            )
          })}
        </div>

        {/* Footer info */}
        <div className="mt-4 flex items-start gap-2 text-xs text-slate-400">
          <span className="shrink-0">ⓘ</span>
          <p>
            Prayer times are approximate, computed via the {methodLabel} method.
            They can vary by location, calculation method, and local convention — not religiously authoritative.
          </p>
        </div>
      </div>
    </div>
  )
}

export default NamazPage
