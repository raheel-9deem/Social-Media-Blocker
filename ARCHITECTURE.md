# Social Media Blocker — Technical Architecture

> **Status:** Blueprint — not yet implemented  
> **Scope:** Web MVP, with clean extension points for browser extension, desktop, and mobile  
> **Last updated:** 2026-09-04

---

## 1. Technology Stack

### 1.1 Frontend

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 18 + TypeScript | Mature ecosystem, excellent TypeScript support, large talent pool |
| Build Tool | Vite | Fast HMR, first-class TS support, minimal config |
| Styling | Tailwind CSS 3 + shadcn/ui | Rapid, consistent UI development; accessible primitives |
| State | Zustand | Lightweight, no boilerplate, works well with React Query |
| Data Fetching | TanStack Query (React Query) | Caching, background sync, optimistic updates |
| Charts | Recharts | Declarative, React-native, easy theming |
| Routing | React Router v6 | Industry standard, matches React patterns |
| Notifications | Sonner (toast) | Minimal, accessible, non-blocking |
| Date/Time | date-fns | Tree-shakeable, smaller than Moment.js |
| Prayer Calculations | adhan (JS port) | Battle-tested, supports multiple calculation methods |
| Validation | Zod | Runtime + TypeScript type inference |
| Testing (future) | Vitest + Testing Library | Co-located tests, fast execution |

### 1.2 Backend

| Layer | Choice | Rationale |
|---|---|---|
| Backend-as-a-Service | Supabase | Auth, Postgres, Edge Functions, Realtime — all in one |
| Database | PostgreSQL (via Supabase) | Relational integrity for users, limits, usage logs |
| Auth | Supabase Auth (Email/Password) | Handles hashing, session management, password reset |
| Edge Functions | Deno-based (Supabase) | Prayer-time sync, daily batch jobs, webhook handlers |
| File Storage (future) | Supabase Storage | Exporting analytics CSVs, avatar uploads (not needed in MVP) |

### 1.3 Infrastructure

| Component | Choice |
|---|---|
| Hosting | Vercel or Netlify (static frontend) + Supabase cloud |
| CI/CD | GitHub Actions (lint, test, deploy) |
| Monitoring | Supabase dashboard + basic error boundaries in-app |
| Environment | `.env` with Supabase URL and anon key (public by design) |

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
│                                                                 │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │  UI Layer    │  │  State Layer  │  │  Adapter Layer      │  │
│  │  (React +    │  │  (Zustand +   │  │  (Web Tracking,     │  │
│  │   Tailwind)  │  │  TanStack)    │  │   Notification)     │  │
│  └──────┬───────┘  └──────┬────────┘  └──────────┬──────────┘  │
│         │                 │                      │             │
│         └─────────────────┼──────────────────────┘             │
│                           │                                    │
│         ┌─────────────────▼────────────────────┐               │
│         │      CORE DOMAIN LAYER               │               │
│         │  (Platform-Independent TypeScript)    │               │
│         │  • LimitEngine                       │               │
│         │  • BlockingEvaluator                  │               │
│         │  • UsageTracker                       │               │
│         │  • PrayerEngine                       │               │
│         │  • DailyResetScheduler                │               │
│         │  • AnalyticsAggregator                │               │
│         └──────────────────────────────────────┘               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Supabase Client                        │  │
│  │  (auth, db queries via RPC, realtime subscriptions)      │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │ HTTPS/RPC                         │
└─────────────────────────────┼─────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                    SUPABASE BACKEND                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │   Auth       │  │  PostgreSQL   │  │  Edge Functions    │   │
│  │              │  │  + RLS        │  │  (batch/reset,     │   │
│  │              │  │              │  │   prayer sync)     │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Separation of Concerns

```
Platform-Independent              Platform-Specific (Web MVP)
───────────────────              ───────────────────────────

• LimitEngine                     • WebTrackingAdapter
  - "Is platform X over limit?"      - Monitors active tab URL
                                    - Manages session timers
• PrayerEngine                     • WebNotificationAdapter
  - "Compute prayer times"           - Browser notifications, toast
• BlockingEvaluator                • WebBlockingDisplay
  - "Should this be blocked?"        - Renders block overlay/page
• UsageTracker                     • StorageAdapter
  - "Record usage event"             - Maps to Supabase mutations
• AnalyticsAggregator              • AuthAdapter
                                   - Wraps Supabase Auth calls
• DailyResetScheduler
  - "Is a new day for user TZ?"
```

When the product expands to browser extensions, desktop apps, or mobile, each target platform provides its own **Adapter** implementations. The Core Domain Layer is shared as-is (published as an npm package or monorepo workspace).

---

## 3. Data Model

### 3.1 Entity Relationship Diagram (Conceptual)

```
  ┌──────────┐      1:N      ┌──────────────┐
  │ profiles │──────────────►│ platforms     │
  │ (users)  │              │ (per-user)    │
  └──────────┘              └──────┬───────┘
                                    │ 1:N
                                    ▼
                            ┌───────────────┐
                            │ usage_logs     │
                            │ (time-series)  │
                            └──────┬────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │ 1:N                │ 1:N                │ 1:N
              ▼                    ▼                    ▼
       ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
       │ limit_config  │   │ focus_sessions│   │ analytics_daily│
       │ (daily caps)  │   │ (manual mode)│   │ (aggregates)  │
       └──────────────┘   └──────────────┘   └──────────────┘

  ┌──────────┐      1:1      ┌──────────────────┐
  │ profiles │──────────────►│ namaz_settings    │
  │ (users)  │              │ (opt-in config)   │
  └──────────┘              └──────────────────┘

  ┌──────────┐      1:N      ┌──────────────────┐
  │ profiles │──────────────►│ scheduled_blocks  │
  │ (users)  │              │ (time windows)    │
  └──────────┘              └──────────────────┘
```

### 3.2 Table Definitions

```sql
-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT,
  timezone        TEXT NOT NULL DEFAULT 'UTC',          -- IANA tz, e.g. 'Asia/Karachi'
  locale          TEXT NOT NULL DEFAULT 'en',
  theme           TEXT NOT NULL DEFAULT 'system',       -- 'light' | 'dark' | 'system'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PLATFORMS (user's chosen platforms with limits)
-- ============================================================
CREATE TABLE platforms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                          -- 'YouTube', 'Instagram', …
  category        TEXT NOT NULL DEFAULT 'social',         -- allows future filtering
  daily_limit_min INT NOT NULL DEFAULT 60,                -- minutes per day
  is_active       BOOLEAN NOT NULL DEFAULT true,          -- soft-delete / toggle
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_platform UNIQUE (user_id, name)
);

CREATE INDEX idx_platforms_user ON platforms(user_id);

-- ============================================================
-- USAGE_LOGS (raw time entries)
-- ============================================================
CREATE TABLE usage_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_id     UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ NOT NULL,
  duration_sec    INT NOT NULL,                            -- computed: ended - started
  source          TEXT NOT NULL DEFAULT 'manual',          -- 'manual' | 'extension' | 'import'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_logs_user_date
  ON usage_logs(user_id, (DATE(created_at AT TIME ZONE timezone)));
-- Composite index for daily rollup queries

-- ============================================================
-- LIMIT_CONFIG (granular per-platform limit overrides)
-- Future: per-day-of-week, exception dates, grace periods
-- ============================================================
CREATE TABLE limit_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id     UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  day_of_week     INT,                                     -- 0=Sun … 6=Sat, NULL=all days
  limit_min       INT NOT NULL,
  UNIQUE (platform_id, day_of_week)
);

-- ============================================================
-- FOCUS_SESSIONS (user-initiated blocking sessions)
-- ============================================================
CREATE TABLE focus_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_ids    UUID[] NOT NULL DEFAULT '{}',            -- empty = all platforms
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at         TIMESTAMPTZ NOT NULL,
  reason          TEXT,                                     -- 'user_activated' | 'manual_end'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_focus_sessions_user ON focus_sessions(user_id, ends_at);

-- ============================================================
-- SCHEDULED_BLOCKS (recurring or one-off time windows)
-- ============================================================
CREATE TABLE scheduled_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_ids    UUID[] NOT NULL DEFAULT '{}',
  name            TEXT,
  start_time      TIME NOT NULL,                            -- daily start (UTC adjusted by tz)
  end_time        TIME NOT NULL,                            -- daily end
  days_of_week    INT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sun … 6=Sat
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_blocks_user ON scheduled_blocks(user_id);

-- ============================================================
-- NAMAZ_SETTINGS (per-user prayer-window config)
-- ============================================================
CREATE TABLE namaz_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_enabled            BOOLEAN NOT NULL DEFAULT false,
  calculation_method    TEXT NOT NULL DEFAULT 'MWL',        -- pluggable method code
  time_format           TEXT NOT NULL DEFAULT '12h',        -- '12h' | '24h'
  prayer_windows        JSONB NOT NULL DEFAULT '[]',        -- computed: [{start,end,prayer_name}]
  pre_block_min         INT NOT NULL DEFAULT 5,             -- block N min before each fardh
  post_block_min        INT NOT NULL DEFAULT 5,             -- block N min after each fardh
  blocked_platforms     UUID[] NOT NULL DEFAULT '{}',       -- which platforms during windows
  last_computed_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_namaz UNIQUE (user_id)
);

-- ============================================================
-- ANALYTICS_DAILY (pre-aggregated daily stats for fast queries)
-- ============================================================
CREATE TABLE analytics_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_id     UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  day             DATE NOT NULL,                            -- UTC-normalized date
  total_minutes   INT NOT NULL DEFAULT 0,
  sessions_count  INT NOT NULL DEFAULT 0,
  limit_min       INT NOT NULL,                            -- snapshot of limit that day
  was_blocked     BOOLEAN NOT NULL DEFAULT false,           -- did limit fire today?
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_platform_day UNIQUE (user_id, platform_id, day)
);

CREATE INDEX idx_analytics_daily_user_day
  ON analytics_daily(user_id, day DESC);

-- ============================================================
-- ROW LEVEL SECURITY (all tables)
-- ============================================================
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE limit_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_blocks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE namaz_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily    ENABLE ROW LEVEL SECURITY;

-- Each user can only see their own data
CREATE POLICY "Users manage own profiles"         ON profiles           FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own platforms"        ON platforms          FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own usage_logs"       ON usage_logs         FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own limit_config"     ON limit_config       FOR ALL USING (auth.uid() = (
  SELECT user_id FROM platforms WHERE platforms.id = limit_config.platform_id
));
CREATE POLICY "Users manage own focus_sessions"   ON focus_sessions     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own scheduled_blocks" ON scheduled_blocks   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own namaz_settings"   ON namaz_settings     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own analytics_daily"  ON analytics_daily    FOR ALL USING (auth.uid() = user_id);
```

---

## 4. Core Domain Layer (Platform-Independent)

This is the heart of the system. None of these modules import Supabase, browser APIs, or any platform-specific code. They operate on plain TypeScript types.

```
src/
├── core/
│   ├── types/                    # Shared TypeScript interfaces
│   │   ├── User.ts
│   │   ├── Platform.ts
│   │   ├── UsageLog.ts
│   │   ├── BlockingDecision.ts
│   │   ├── PrayerTimes.ts
│   │   ├── FocusSession.ts
│   │   ├── ScheduledBlock.ts
│   │   └── Analytics.ts
│   │
│   ├── engine/
│   │   ├── LimitEngine.ts        # Evaluates daily-limit rules
│   │   ├── BlockingEvaluator.ts  # Combines all blocking sources into a decision
│   │   ├── DailyResetManager.ts  # Detects day boundaries per timezone
│   │   └── UsageAccumulator.ts   # Sums usage_logs for a platform-day
│   │
│   ├── prayer/
│   │   ├── PrayerEngine.ts       # Interface: calculates prayer times
│   │   ├── PrayerTimeProvider.ts # Base class / config
│   │   └── methods/              # Pluggable calculation methods (MWL, ISNA, …)
│   │
│   ├── analytics/
│   │   └── StatsAggregator.ts    # Computes daily/weekly averages, trends
│   │
│   └── rules/
│       ├── Rule.ts               # Base interface: { evaluate(ctx) → BlockingDecision }
│       ├── DailyLimitRule.ts     # RL: platform over daily limit?
│       ├── FocusModeRule.ts      # RL: is an active focus session blocking this?
│       ├── ScheduledBlockRule.ts # RL: is now in a scheduled window?
│       └── NamazModeRule.ts      # RL: is now in a prayer window?
```

### 4.1 Key Core Types

```typescript
// core/types/BlockingDecision.ts

/** Why a platform is currently blocked. Empty = not blocked. */
export type BlockingDecision = {
  isBlocked: boolean;
  reason: BlockingReason | null;
  /** Remaining seconds until block lifts (if known) */
  unblockAt: string | null; // ISO timestamp
  /** Sources of blocking, in priority order (highest wins) */
  activeRules: string[];
};

export type BlockingReason =
  | { type: 'DAILY_LIMIT_EXCEEDED'; platformId: string; usedMinutes: number; limitMinutes: number }
  | { type: 'FOCUS_MODE'; focusSessionId: string; remainingSeconds: number }
  | { type: 'SCHEDULED_BLOCK'; blockId: string; blockName: string }
  | { type: 'NAMAZ_MODE'; prayerName: string; windowEnd: string }
  | { type: 'NONE' };
```

```typescript
// core/types/Platform.ts

export interface Platform {
  id: string;
  name: string;
  category: string;
  dailyLimitMinutes: number;
  isActive: boolean;
}

/** Granular overrides (by day-of-week, exceptions) */
export interface LimitOverride {
  platformId: string;
  dayOfWeek: number | null; // 0-6, null = applies all days
  limitMinutes: number;
}
```

```typescript
// core/engine/BlockingEvaluator.ts

import { BlockingDecision, BlockingReason } from '../types';

export interface EvaluationContext {
  userId: string;
  userTimezone: string;
  now: Date; // authoritative time (server-validated)
  platforms: Platform[];
  dailyUsage: Map<string, number>; // platformId → minutes used today
  activeFocusSessions: FocusSession[];
  scheduledBlocks: ScheduledBlock[];
  namazWindows: PrayerWindow[] | null;
}

export class BlockingEvaluator {
  private rules: Rule[];

  constructor(rules: Rule[]) {
    // Order matters: higher-priority rules first
    this.rules = rules;
  }

  evaluate(platformId: string, ctx: EvaluationContext): BlockingDecision {
    for (const rule of this.rules) {
      const result = rule.evaluate(platformId, ctx);
      if (result.isBlocked) return result;
    }
    return { isBlocked: false, reason: { type: 'NONE' }, unblockAt: null, activeRules: [] };
  }
}

export interface Rule {
  name: string;
  evaluate(platformId: string, ctx: EvaluationContext): BlockingDecision;
}
```

```typescript
// core/prayer/PrayerEngine.ts

export interface PrayerTimes {
  date: string;
  timezone: string;
  prayers: {
    fajr: Date;
    sunrise: Date;
    dhuhr: Date;
    asr: Date;
    maghrib: Date;
    isha: Date;
  };
}

export interface PrayerWindow {
  name: string;
  start: Date;
  end: Date;
}

export interface PrayerEngineConfig {
  latitude: number;
  longitude: number;
  calculationMethod: string;      // 'MWL', 'ISNA', 'Karachi', 'Egyptian', …
  timeFormat: '12h' | '24h';
  /** Additional minutes to block before/after each fardh prayer */
  preBlockMinutes: number;
  postBlockMinutes: number;
}

export interface IPrayerEngine {
  computeTimes(date: Date, config: PrayerEngineConfig): PrayerTimes;
  getPrayerWindows(times: PrayerTimes, config: PrayerEngineConfig): PrayerWindow[];
}
```

```typescript
// core/engine/DailyResetManager.ts

export interface DayBoundary {
  currentDayStart: Date; // midnight in user's timezone
  nextDayStart: Date;
}

export class DailyResetManager {
  /** Returns the start-of-day for the given timezone on the given date */
  getDayBoundary(date: Date, timezone: string): DayBoundary {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '0', minute: '0', second: '0', hour12: false,
    });
    const dayStr = formatter.format(date); // "YYYY-MM-DD" in that tz
    const currentDayStart = new Date(`${dayStr}T00:00:00${getUTCOffset(date, timezone)}`);
    const nextDayStart = new Date(currentDayStart.getTime() + 86400000);
    return { currentDayStart, nextDayStart };
  }

  /** Returns true if the date crosses into a new day in the user's timezone */
  hasDayBoundaryPassed(previousCheck: Date, now: Date, timezone: string): boolean {
    const prev = this.getDayBoundary(previousCheck, timezone);
    const curr = this.getDayBoundary(now, timezone);
    return prev.currentDayStart.getTime() !== curr.currentDayStart.getTime();
  }
}
```

```typescript
// core/analytics/StatsAggregator.ts

export interface DailyStats {
  date: string;        // ISO date
  platformId: string;
  platformName: string;
  totalMinutes: number;
  sessions: number;
  limitMinutes: number;
  wasBlocked: boolean;
}

export interface WeeklySummary {
  totalMinutes: number;
  perPlatform: Map<string, number>;
  dailyAverage: number;
  mostUsedPlatform: string | null;
  limitBreaches: number;
}
```

---

## 5. Adapter Layer (Web-Specific)

The Adapter Layer is the **only** part of the frontend that touches browser and Supabase APIs. It bridges the core domain to the outside world.

```
src/
├── adapters/
│   ├── tracking/
│   │   └── WebTrackingAdapter.ts   # Manual session timer; tab-URL detection (MVP: manual)
│   ├── notifications/
│   │   └── WebNotificationAdapter.ts # Browser Notification API + in-app toast
│   ├── storage/
│   │   ├── SupabaseStorageAdapter.ts  # CRUD against Supabase PostgREST
│   │   └── OfflineQueue.ts            # Buffers mutations when offline
│   ├── auth/
│   │   └── SupabaseAuthAdapter.ts     # Wraps Supabase Auth
│   └── time/
│       └── WebTimeAdapter.ts          # Client clock + periodic server-time drift correction
```

### 5.1 Storage Adapter

All data access goes through this adapter. The rest of the app depends only on the interface, not Supabase directly — making it easy to swap data backends or mock for tests.

```typescript
// adapters/storage/StorageAdapter.ts (interface)

export interface StorageAdapter {
  // Profile
  getProfile(): Promise<UserProfile | null>;
  updateProfile(data: Partial<UserProfile>): Promise<UserProfile>;

  // Platforms
  listPlatforms(): Promise<Platform[]>;
  addPlatform(name: string, category: string, limitMinutes: number): Promise<Platform>;
  updatePlatform(id: string, data: Partial<Platform>): Promise<Platform>;
  removePlatform(id: string): Promise<void>;

  // Usage
  recordUsageLog(entry: CreateUsageLog): Promise<UsageLog>;
  getUsageLogs(startDate: Date, endDate: Date): Promise<UsageLog[]>;

  // Focus
  startFocusSession(session: CreateFocusSession): Promise<FocusSession>;
  endFocusSession(id: string): Promise<FocusSession>;
  getActiveFocusSession(): Promise<FocusSession | null>;

  // Scheduled Blocks
  listScheduledBlocks(): Promise<ScheduledBlock[]>;
  upsertScheduledBlock(block: ScheduledBlock): Promise<ScheduledBlock>;
  removeScheduledBlock(id: string): Promise<void>;

  // Namaz
  getNamazSettings(): Promise<NamazSettings | null>;
  updateNamazSettings(data: Partial<NamazSettings>): Promise<NamazSettings>;

  // Analytics
  getDailyAnalytics(startDate: Date, endDate: Date): Promise<DailyStats[]>;

  // Realtime (optional)
  subscribeToChanges(callback: () => void): UnsubscribeFn;
}
```

### 5.2 Usage Tracking Adapter

In the web MVP, cross-origin usage tracking is impossible without a browser extension. The adapter therefore offers a **manual timer** UI — the user clicks "Start" when they visit the platform and "Stop" when they leave. It also supports future extension integration.

```typescript
// adapters/tracking/WebTrackingAdapter.ts

export interface TrackingSession {
  platformId: string;
  startedAt: Date;
  isRunning: boolean;
  elapsedMs: number;
}

export class WebTrackingAdapter {
  private sessions: Map<string, TrackingSession> = new Map();
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  startSession(platformId: string): void { /* … */ }
  stopSession(platformId: string): UsageLog | null { /* … */ }
  getElapsed(platformId: string): number { /* … */ } // seconds
  stopAll(): UsageLog[] { /* … */ }
}
```

---

## 6. State Management

Global state is kept minimal — most state lives in TanStack Query caches (server state), with a thin Zustand layer for UI state that needs to be shared across components.

```
src/
├── store/
│   ├── appStore.ts          # UI state: sidebar open, current view, modals
│   ├── timerStore.ts        # Active tracking sessions (client-side only)
│   └── blockingStore.ts     # Derived: which platforms are currently blocked (cached)
```

**Principles:**
- Server state → TanStack Query (auto-cached, background-refetched)
- Transient UI state → Zustand
- No prop-drilling beyond one level; use hooks composed in feature modules

---

## 7. Feature Module Map

Each feature lives in its own directory under `src/features/`. Components, hooks, and logic are colocated.

```
src/
├── features/
│   ├── auth/                  # Login, Signup, Password Reset
│   │   ├── components/
│   │   ├── hooks/
│   │   └── __tests__/
│   │
│   ├── dashboard/             # Overview cards, blocking status, quick timer
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── platforms/             # Platform manager: add, edit, set limits
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── tracker/               # Manual session timer, active sessions bar
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── focus-mode/            # Focus Mode toggle, duration picker, platform selector
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── schedule/              # Scheduled blocking: CRUD for time windows
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── namaz/                 # Namaz Mode: enable/disable, location, window display
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── analytics/             # Charts: 7-day bars, per-platform breakdown, trends
│   │   ├── components/
│   │   └── hooks/
│   │
│   └── settings/              # Timezone, theme, Namaz config, data export, account
│       ├── components/
│       └── hooks/
│
├── app/                       # Layout shell, route definitions, error boundaries
│   ├── Layout.tsx
│   └── routes.tsx
│
├── adapters/                  # Platform-specific implementations
└── core/                      # Platform-independent domain logic
```

---

## 8. Blocking Evaluation Flow

This is the most important runtime flow — it runs on every meaningful state change (timer tick, focus toggle, midnight crossing, Namaz window change).

```
  Trigger: timer tick / focus toggle / schedule change / Namaz window change
       │
       ▼
  BlockingEvaluator.evaluateAll(userId, now)
       │
       │  For each active platform:
       │    1. Accumulate today's usage (from usage_logs)
       │    2. Evaluate rules in priority order:
       │       a. DailyLimitRule   → exceeded?
       │       b. FocusModeRule    → in active focus?
       │       c. ScheduledRule    → in time window?
       │       d. NamazModeRule    → in prayer window?
       │    3. Cache result in blockingStore
       │
       ▼
  UI reads blockingStore → renders available / blocked state per platform
```

**Priority order rationale:**
1. **Daily Limit** — Most specific to the user's behavior; fire first.
2. **Focus Mode** — User's conscious override, intentionally blocking everything.
3. **Scheduled Blocks** — User-planned in advance.
4. **Namaz Mode** — Optional, platform-aware middleware layer.

If multiple rules fire, the highest-priority one's `unblockAt` timestamp governs when the block lifts.

---

## 9. Daily Reset Mechanism

```
  ┌─────────────────────────────────────────┐
  │  DailyResetManager                       │
  │                                         │
  │  • Runs on app load                     │
  │  • Runs every 60 seconds client-side    │
  │  • Validates against server-time via    │
  │    Edge Function (lightweight)           │
  │                                         │
  │  If day boundary crossed:               │
  │    1. Zero out in-progress timer UI     │
  │    2. Mark yesterday's analytics_daily   │
  │       rows as finalized                  │
  │    3. Re-evaluate all blocking decisions │
  │    4. Show "Day reset. Fresh start!"     │
  └─────────────────────────────────────────┘
```

A Supabase Edge Function (`reset-daily`) runs once per UTC day per user as a safety net, ensuring that even if the client is closed, usage is rolled over correctly.

---

## 10. Namaz Mode — Architecture Details

```
  NamazSettings
       │
       │ feeds into
       ▼
  PrayerEngine.computeTimes(date, config)
       │
       │ produces
       ▼
  PrayerTimes { fajr, sunrise, dhuhr, asr, maghrib, isha }
       │
       │ transformed by
       ▼
  NamazModeRule.generateWindows(times, preBlockMin, postBlockMin)
       │
       │ produces
       ▼
  PrayerWindow[] [{ name, start, end }, …]
       │
       │ fed into
       ▼
  BlockingEvaluator (as rule #4 in priority chain)
       │
       │ returns
       ▼
  BlockingDecision { isBlocked, reason: NAMAZ_MODE }
```

**Key design decisions:**
- Prayer times are recomputed once per day (cache the result in `namaz_settings.last_computed_at`).
- The `calculation_method` field stores a string code (`'MWL'`, `'ISNA'`, etc.) mapped to `adhan`'s `CalculationMethod` enum. Adding a new method is a code change, not a data migration.
- The `prayer_windows` JSONB field caches computed windows — this avoids recomputation on every UI render.
- **Grace period:** If Namaz Mode is enabled mid-day, existing windows are backfilled, but **today's usage is not retroactively blocked**. Transparency: show a note "Namaz Mode enabled — blocking starts from tomorrow's windows unless you activate immediately."

---

## 11. Future Browser Extension Integration Points

The core domain layer is designed to be consumed by a browser extension with minimal glue code.

| Extension Need | Core Module to Consume | Adapter to Implement |
|---|---|---|
| Track real time on social sites | `UsageTracker` | `ExtensionTrackingAdapter` (listens to `webNavigation` / `tabs`) |
| Evaluate blocking in real-time | `BlockingEvaluator` + all Rules | `ExtensionBlockingAdapter` (intercepts requests, shows block page) |
| Send usage heartbeats | `UsageAccumulator` | `ExtensionStorageAdapter` (IndexedDB queue + Supabase batch) |
| Prayer-time popup | `PrayerEngine` | Extension popup UI component |
| Notifications | Notifications module | `ExtensionNotificationAdapter` (chrome.notifications API) |
| Sync state | All query functions | `MessagingAdapter` (extension ↔ service worker ↔ background) |

When building the extension, the team would create a separate project that imports `@social-media-blocker/core` and implements the relevant adapters. No changes to the core would be necessary.

---

## 12. Security & Privacy Architecture

### 12.1 Data Minimization

| Stored Data | Justification | Retention |
|---|---|---|
| User email + hash (via Supabase Auth) | Authentication only | Until account deletion |
| Timezone, locale, theme | UX personalization | Until account deletion |
| Platform names + daily limits | Core product logic | Until account deletion |
| Usage timestamps + durations | Limit enforcement + analytics | Indefinite (user can delete) |
| Focus mode sessions | Limit enforcement | Transient (purge after 30 days) |
| Analytics aggregates | Daily rollups for charts | Indefinite (user can delete) |

**Explicitly NOT stored:** Passwords (handled by Supabase), message contents, browsing history, URLs visited, profile pictures, social connections.

### 12.2 RLS Policies

All tables have Row Level Security enabled. Every query is scoped to `auth.uid()`. An attacker with access to the database cannot see other users' data.

### 12.3 API Surface

| Endpoint Type | Protection |
|---|---|
| Auth operations | Supabase Auth (rate-limited, hashed passwords) |
| CRUD operations | RLS + Bearer token (Anon key is public, RLS is the authority) |
| Edge Functions | JWT verification via Supabase |
| Realtime channels | Per-user channel authorization |

---

## 13. Testing Strategy

| Layer | Approach |
|---|---|
| **Core domain** | Unit tests (Vitest) — pure functions, deterministic, no mocks of Supabase |
| **Adapters** | Integration tests with a mock `StorageAdapter` — test adapter logic without Supabase |
| **API/Edge Functions** | Supabase local dev stack + Deno test runner |
| **E2E** | Playwright (future phase) — critical user flows |
| **Blocking Evaluator** | Table-driven tests covering all rule combinations |
| **Prayer Engine** | Snapshot tests against known prayer times for fixed dates/locations |

---

## 14. Development Toolchain

```
┌──────────────────────────────────────────────┐
│                   Developer                   │
│                                              │
│  npm run dev          →  Start Vite dev server│
│  npm run dev:db       →  Start Supabase local │
│  npm run db:reset     →  Reset local DB      │
│  npm run db:seed      →  Seed test data      │
│  npm run lint         →  ESLint + Prettier   │
│  npm run typecheck    →  tsc --noEmit         │
│  npm run test:core    →  Vitest on core/ only│
│  npm run test:unit    →  Vitest all          │
│  npm run build        →  Production Vite     │
│  npm run preview      →  Preview build       │
└──────────────────────────────────────────────┘
```

### Lint / Format Enforcement

```
- ESLint + @typescript-eslint + react-hooks plugin
- Prettier (format on save)
- Husky pre-commit: lint-staged (eslint --fix + prettier --write)
- TypeScript strict mode (no implicit any, strictNullChecks)
```

---

## 15. Summary of Key Principles

| # | Principle | How Enforced |
|---|---|---|
| 1 | **Core logic is platform-agnostic** | No browser/Node/Supabase imports in `src/core/` |
| 2 | **All data access through adapters** | No `supabase.from()` calls outside `src/adapters/` |
| 3 | **Server-authoritative time for decisions** | Edge Function provides timestamp; client corrects drift |
| 4 | **Minimal data collection** | Schema audit: every column must have a justifying comment |
| 5 | **RLS everywhere** | Every table has RLS; no service_role key in client code |
| 6 | **Feature flags for sensitive features** | Namaz Mode, Focus Mode toggled per-user, not globally |
| 7 | **Colocated feature modules** | `features/<name>/` contains components, hooks, tests for that feature |
| 8 | **Extension-ready from day one** | Core published as workspace package; extension project imports it |

---

This architecture is ready for phased implementation. Awaiting your approval or questions before we begin building.
