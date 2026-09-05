# Social Media Blocker

A calm, minimal, and modern digital-wellbeing web app that helps you set healthy boundaries with social media. Built with a clean separation between core domain logic and platform-specific UI — ready to expand into a browser extension, desktop app, or mobile app.

> **Status:** MVP — UI foundation + core usage/limit engine complete

---

## What It Does

| Feature | Description |
|---|---|
| **Smart Blocking** | Set daily time limits per platform. Automatically block when you hit your cap. |
| **Focus Mode** | Activate deep-work sessions that block all (or selected) platforms for a set duration. |
| **Namaz Mode** | Auto-pause social media during prayer windows (Fajr, Dhuhr, Asr, Maghrib, Isha). |
| **Clean Analytics** | Minimal, calm charts showing your usage patterns — no guilt trips, just awareness. |
| **Manual Timer** | Track platform sessions manually (foundation for automatic browser-extension tracking). |

### Supported Platforms (Initial)

YouTube, Instagram, TikTok, Twitter / X, Facebook, Reddit

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + TypeScript 6 |
| **Build Tool** | Vite 8 |
| **Styling** | Tailwind CSS 4 |
| **State Management** | Zustand 5 (UI state) + TanStack Query 5 (server state) |
| **Routing** | React Router 7 |
| **Charts** | Recharts |
| **Notifications** | Sonner |
| **Date/Time** | date-fns |
| **Validation** | Zod |
| **Linting** | Oxlint |
| **Future Backend** | Supabase (auth, Postgres, edge functions) |

---

## Architecture

The codebase follows a strict layered architecture:

```
src/
├── core/                    # Platform-independent domain logic (no React/Supabase imports)
│   ├── types/               # Shared TypeScript interfaces
│   ├── engine/              # BlockingEvaluator, UsageAccumulator, DailyResetManager
│   └── engine/rules/        # DailyLimitRule, FocusModeRule, ScheduledBlockRule, NamazModeRule
│
├── components/
│   └── ui/                  # Reusable design system (Button, Card, Input, Modal, Toggle, …)
│
├── components/layout/       # Sidebar, Header, AppLayout (responsive shell)
│
├── pages/                   # Route-level pages (Landing, Login, Dashboard, Settings, …)
│
├── store/                   # Zustand stores (app UI state, timer, blocking)
│
├── hooks/                   # Custom hooks (useMediaQuery, useIsMobile, useInterval)
│
├── lib/                     # Utilities (cn(), design tokens)
│
└── App.tsx                  # Root component with routing
```

### Core Domain Layer (`src/core/`)

The heart of the system. Zero dependencies on React, Supabase, or any browser/Node API. Designed to be shared as-is when building a browser extension.

| Module | Responsibility |
|---|---|
| `BlockingEvaluator` | Orchestrates all rules in priority order → returns per-platform `BlockingDecision` |
| `DailyLimitRule` | Checks if a platform exceeded its daily time budget (with per-day-of-week overrides) |
| `FocusModeRule` | Blocks platforms during active Focus sessions |
| `ScheduledBlockRule` | Blocks during user-defined time windows (supports midnight-crossing) |
| `NamazModeRule` | Blocks during prayer windows |
| `UsageAccumulator` | Aggregates usage logs into per-platform per-day minute totals. Duplicate-safe |
| `DailyResetManager` | Timezone-aware day boundary detection using `Intl.DateTimeFormat` |

### Blocking Priority Chain

1. **Daily Limit** — Most specific to user behavior
2. **Focus Mode** — Conscious deep-work override
3. **Scheduled Blocks** — User-planned in advance
4. **Namaz Mode** — Prayer-window blocking

First match wins. When multiple rules fire, the highest-priority one governs when the block lifts.

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install & Run

```bash
cd smb-ui
npm install
npm run dev
```

The app starts at `http://localhost:5173/`.

### Load as Chrome Extension

```bash
npm run build:extension
```

Then open **chrome://extensions** → Enable **Developer mode** → **Load unpacked** → select the **`extension/`** folder (at project root).

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript check + production build |
| `npm run build:extension` | Build + package as Chrome extension (ready to load) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run Oxlint across the codebase |

---

## Project Structure

```
Social-Media-Blocker/
├── ARCHITECTURE.md           # Full technical architecture (data model, adapters, security)
├── LICENSE
├── extension/                # Chrome extension output (load this in chrome://extensions)
│   ├── manifest.json         # Manifest V3
│   ├── background.js         # Service worker (heartbeat, state, blocking rules)
│   ├── content.js            # Content script — injects block overlay into pages
│   ├── icons/                # Extension icons (16/48/128)
│   └── index.html            # Popup (auto-copied from smb-ui/dist/)
└── smb-ui/                   # Frontend application
    ├── index.html
    ├── package.json
    ├── vite.config.ts        # Vite config with path aliases (@/ → src/)
    ├── tsconfig.app.json     # TypeScript config with path mapping
    ├── scripts/              # Build helpers (copy-to-extension, generate-icons)
    ├── src/
    │   ├── main.tsx          # Entry point
    │   ├── App.tsx           # Root component + routing
    │   ├── index.css         # Tailwind v4 + design tokens + animations
    │   ├── fonts.css         # Inter font import
    │   ├── core/             # Platform-independent domain engine
    │   ├── components/       # UI components + layout shell
    │   ├── pages/            # Route-level page components
    │   ├── store/            # Zustand state stores
    │   ├── hooks/            # Custom React hooks
    │   ├── lib/              # Utility functions + design tokens
    │   └── test/             # Vitest test suite
    └── dist/                 # Vite production build output
```

---

## Routes

| Route | Page | Status |
|---|---|---|
| `/` | Landing | Hero, features grid, CTA |
| `/login` | Login | Email/password form with Zod validation |
| `/signup` | Signup | Name/email/password/confirm form |
| `/onboarding` | Onboarding | 3-step flow: pick platforms → set limits → choose modes |
| `/app/analytics` | Analytics | 7-day usage bars, per-platform breakdown, summary stats |
| `/app/focus` | Focus Mode | Start/end sessions, circular countdown, platform selection, Block All |
| `/app/namaz` | Namaz Mode | Prayer windows via Aladhan API, calculation methods, pre/post block config |
| `/app/tracker` | Tracker | Manual platform session timer |
| `/app/schedule` | Scheduled Blocks | Placeholder |

---

## Design System

### Colors

| Token | Usage |
|---|---|
| `brand-50` → `brand-900` | Primary brand (blue-indigo gradient) |
| `slate-50` → `slate-950` | Neutrals (text, borders, backgrounds) |
| `success-500/600` | Positive states, within-limit indicators |
| `warning-500/600` | Approaching-limit warnings |
| `danger-500/600` | Blocked states, limit-exceeded, destructive actions |

### Components

| Component | Variants |
|---|---|
| `Button` | primary, secondary, outline, ghost, danger — sizes: sm, default, lg, icon |
| `Input` | With label, error message, left icon |
| `Card` | Header, Title, Description, Content, Footer slots — padding: none/sm/md/lg |
| `Modal` | sizes: sm, md, lg — ESC-to-close, backdrop dismiss |
| `Toggle` | Primary style switch with label |
| `Progress` | 0–100 value, color: brand/success/warning/danger |
| `Badge` | default, brand, success, warning, danger — optional dismissible |
| `Spinner` / `LoadingOverlay` | sm, md, lg sizes |
| `Sheet` | Slide-in panel (left/right/top/bottom) |

All components are built with `class-variance-authority` (CVA), `clsx`, and `tailwind-merge` for deterministic className merging.

---

## Data Model (Planned)

```
profiles (users)
  └── platforms (per-user, with daily limits)
        └── usage_logs (time-series)
  └── focus_sessions (manual mode)
  └── scheduled_blocks (recurring time windows)
  └── namaz_settings (opt-in prayer config)
  └── analytics_daily (pre-aggregated daily stats)
  └── limit_config (per-day-of-week overrides)
```

Full schema with RLS policies is defined in `ARCHITECTURE.md`.

---

## Roadmap

### Done
- [x] Project scaffolding (Vite + React + TypeScript)
- [x] Design system (tokens, CSS, reusable components)
- [x] Responsive layout shell (sidebar, header, mobile nav)
- [x] All pages and routing (Landing, Login, Signup, Onboarding, Dashboard, Settings)
- [x] Zustand stores for app UI, timer, and blocking state
- [x] Core domain engine (platform-independent)
- [x] UsageAccumulator, DailyResetManager, BlockingEvaluator
- [x] All 4 blocking rules (DailyLimit, FocusMode, ScheduledBlock, NamazMode)
- [x] TypeScript + lint checks passing (0 errors)

### Next Up
- [ ] Supabase integration (auth, database, RLS)
- [ ] Adapter layer (storage, tracking, notifications, auth)
- [ ] Real usage tracking + persistence
- [ ] Analytics charts (7-day bars, per-platform breakdown)
- [ ] Platform management CRUD
- [ ] Focus Mode full implementation (start/end, timer)
- [ ] Namaz Mode full implementation (prayer times, windows)
- [ ] Scheduled Blocks CRUD
- [ ] Browser extension core consumption

---

## License

MIT

---

Made With Heart, By Raheel Nadeem
