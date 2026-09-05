// ==========================================================================
// PrayerTimeProvider — abstraction for computing daily prayer times.
// Uses the free Aladhan API (https://aladhan.com/prayer-times-api)
// with an in-memory cache for the current day.
// ==========================================================================

// ---- Result shape ----

export interface PrayerTimes {
  /** "HH:MM" (24-hour) */
  Fajr: string
  Dhuhr: string
  Asr: string
  Maghrib: string
  Isha: string
  /** "yyyy-MM-dd" */
  date: string
  /** Latitude used for calculation */
  latitude: number
  /** Longitude used for calculation */
  longitude: number
  /** Method ID that was used */
  method: string
}

/** A single prayer blocking window */
export interface PrayerWindow {
  prayerName: string
  start: Date
  end: Date
  startStr: string // "HH:MM"
  endStr: string   // "HH:MM"
}

export interface PrayerWindowConfig {
  /** Minutes before prayer to start blocking (default: 5) */
  preBlockMinutes: number
  /** Minutes after prayer to stop blocking (default: 5) */
  postBlockMinutes: number
}

// ---- Supported calculation methods ----

export const CALCULATION_METHODS = [
  { value: "MWL",  label: "Muslim World League", description: "Fajr 18°, Isha 17°" },
  { value: "ISNA", label: "ISNA (North America)", description: "Fajr 15°, Isha 15°" },
  { value: "EGAS", label: "Egyptian General Authority", description: "Fajr 19.5°, Isha 17.5°" },
  { value: "UmmAlQura", label: "Umm Al-Qura (Makkah)", description: "Used in Saudi Arabia" },
  { value: "Karachi", label: "University of Karachi", description: "Fajr 18°, Isha 18°" },
] as const

export type CalculationMethod = typeof CALCULATION_METHODS[number]["value"]

// ---- API method IDs mapping ----

const METHOD_IDS: Record<string, number> = {
  MWL: 3,
  ISNA: 2,
  EGAS: 5,
  UmmAlQura: 4,
  Karachi: 1,
}

// ---- Cache ----

let cachedTimes: { key: string; data: PrayerTimes; fetchedAt: number } | null = null
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

// ---- Provider interface ----

export interface PrayerTimeProvider {
  getPrayerTimes(date: Date, latitude: number, longitude: number, method: CalculationMethod): Promise<PrayerTimes>
  computeWindows(times: PrayerTimes, config: PrayerWindowConfig): PrayerWindow[]
}

// ---- Implementation ----

class AladhanProvider implements PrayerTimeProvider {
  async getPrayerTimes(date: Date, _lat: number, _lng: number, method: CalculationMethod): Promise<PrayerTimes> {
    const cacheKey = `${date.toISOString().slice(0, 10)}-${method}`

    // Return cached data if fresh
    if (cachedTimes && cachedTimes.key === cacheKey && Date.now() - cachedTimes.fetchedAt < CACHE_TTL_MS) {
      return cachedTimes.data
    }

    const dd = String(date.getDate()).padStart(2, "0")
    const mm = String(date.getMonth() + 1).padStart(2, "0")
    const yyyy = date.getFullYear()
    const methodId = METHOD_IDS[method] ?? 3

    // Try with coordinates; fall back to IP-based if no coordinates
    let url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?method=${methodId}&latitude=${_lat}&longitude=${_lng}`
    let resp = await fetch(url)

    // If coords-based fails, fall back to IP-based
    if (!resp.ok && _lat === 0 && _lng === 0) {
      resp = await fetch(`https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?method=${methodId}`)
    }

    if (!resp.ok) {
      throw new Error(`Prayer times API returned ${resp.status}`)
    }

    const json = await resp.json()
    const timings = json.data?.timings
    if (!timings) {
      throw new Error("Invalid prayer times response from API")
    }

    const dateStr = json.data?.date?.gregorian?.date ?? date.toISOString().slice(0, 10)

    const result: PrayerTimes = {
      Fajr: timings.Fajr,
      Dhuhr: timings.Dhuhr,
      Asr: timings.Asr,
      Maghrib: timings.Maghrib,
      Isha: timings.Isha,
      date: dateStr,
      latitude: _lat,
      longitude: _lng,
      method,
    }

    cachedTimes = { key: cacheKey, data: result, fetchedAt: Date.now() }
    return result
  }

  computeWindows(times: PrayerTimes, config: PrayerWindowConfig): PrayerWindow[] {
    const prayers: Array<{ name: string; timeStr: string }> = [
      { name: "Fajr", timeStr: times.Fajr },
      { name: "Dhuhr", timeStr: times.Dhuhr },
      { name: "Asr", timeStr: times.Asr },
      { name: "Maghrib", timeStr: times.Maghrib },
      { name: "Isha", timeStr: times.Isha },
    ]

    return prayers.map(({ name, timeStr }) => {
      const [h, m] = timeStr.split(":").map(Number)
      const [preH, preM] = subtractMinutes(h, m, config.preBlockMinutes)
      const [postH, postM] = addMinutes(h, m, config.postBlockMinutes)

      return {
        prayerName: name,
        start: new Date(times.date + "T" + String(preH).padStart(2, "0") + ":" + String(preM).padStart(2, "0") + ":00"),
        end: new Date(times.date + "T" + String(postH).padStart(2, "0") + ":" + String(postM).padStart(2, "0") + ":00"),
        startStr: `${String(preH).padStart(2, "0")}:${String(preM).padStart(2, "0")}`,
        endStr: `${String(postH).padStart(2, "0")}:${String(postM).padStart(2, "0")}`,
      }
    })
  }
}

// ---- Math helpers ----

function subtractMinutes(h: number, m: number, mins: number): [number, number] {
  const total = h * 60 + m - mins
  if (total < 0) return [24 + Math.floor(total / 60), total % 60]
  return [Math.floor(total / 60), total % 60]
}

function addMinutes(h: number, m: number, mins: number): [number, number] {
  const total = h * 60 + m + mins
  if (total >= 24 * 60) return [Math.floor(total / 60) - 24, total % 60]
  return [Math.floor(total / 60), total % 60]
}

// ---- Singleton ----

const provider = new AladhanProvider()

export function getPrayerTimeProvider(): PrayerTimeProvider {
  return provider
}
