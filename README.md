# Social Media Blocker

A calm, minimal, and modern digital-wellbeing Chrome extension. Install it from GitHub in 30 seconds — no account, no database, no setup required.

> **Status:** MVP — Standalone Chrome extension with Focus Mode, Namaz Mode, and Analytics

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
| **State Management** | Zustand 5 |
| **Routing** | React Router 7 |
| **Charts** | Recharts |
| **Notifications** | Sonner |
| **Date/Time** | date-fns |
| **Validation** | Zod |
| **Linting** | Oxlint |

---

## Architecture

The extension is fully self-contained — no server, no database, no account system. All data lives in the browser's memory during a session.

```
Social-Media-Blocker/
├── extension/                  # Chrome extension (load this folder in chrome://extensions)
│   ├── manifest.json           # Manifest V3
│   ├── background.js           # Service worker (heartbeat, state, blocking rules)
│   ├── content.js              # Content script — injects block overlay into pages
│   ├── icons/                  # Extension icons (16/48/128)
│   └── index.html              # Popup (auto-copied from smb-ui/dist/)
│
└── smb-ui/                     # React frontend application
    ├── index.html
    ├── package.json
    ├── vite.config.ts          # Vite config with path aliases (@/ → src/)
    ├── tsconfig.app.json       # TypeScript config with path mapping
    ├── scripts/                # Build helpers (copy-to-extension, generate-icons)
    └── src/
        ├── main.tsx            # Entry point
        ├── App.tsx             # Root component + routing
        ├── index.css           # Tailwind v4 + design tokens + animations
        ├── core/               # Platform-independent domain engine
        ├── components/         # UI components + layout shell
        ├── pages/              # Route-level page components
        ├── store/              # Zustand state stores
        ├── hooks/              # Custom React hooks
        └── lib/                # Utility functions + design tokens
```

### Core Domain Layer (`src/core/`)

The heart of the system. Zero dependencies on React or any browser/Node API. Designed to be shared as-is when building a browser extension.

| Module | Responsibility |
|---|---|
| `BlockingEvaluator` | Orchestrates all rules in priority order → returns per-platform `BlockingDecision` |
| `DailyLimitRule` | Checks if a platform exceeded its daily time budget |
| `FocusModeRule` | Blocks platforms during active Focus sessions |
| `ScheduledBlockRule` | Blocks during user-defined time windows (supports midnight-crossing) |
| `NamazModeRule` | Blocks during prayer windows |
| `UsageAccumulator` | Aggregates usage logs into per-platform per-day minute totals |
| `DailyResetManager` | Timezone-aware day boundary detection |

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

### Install & Run (Development)

```bash
cd smb-ui
npm install
npm run dev
```

The app opens at `http://localhost:5173/`.

### Build as Chrome Extension

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

| Route | Page | Description |
|---|---|---|
| `/app` | Dashboard | Overview: usage stats, weekly chart, Focus/Namaz widgets |
| `/app/analytics` | Analytics | 7-day usage bars, per-platform breakdown, summary stats |
| `/app/focus` | Focus Mode | Start/end sessions, circular countdown, platform selection |
| `/app/namaz` | Namaz Mode | Prayer times, block windows, calculation methods |
| `/app/tracker` | Tracker | Manual platform session timer |
| `/app/platforms` | Platforms | Manage platforms and daily limits |
| `/app/settings` | Settings | General preferences, notifications, data management |
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

### Additional context

- Standalone Chrome extension — no account, no auth, no backend
- Data is in-memory during a session (resets when browser restarts)
- All core logic in `src/core/` — platform-independent

> [!NOTE]
> When the manifest says **Version 2**, remove the explicit version and use `"manifest_version": 3`. When it says **Manifest V3**, the manifest is already correct.
> Double-check the extension copy: if there is no value, delete that section. The extension is fully self-contained — just load the `extension/` folder.

### Done
- [x] Project scaffolding (Vite + React + TypeScript)
- [x] Design system (tokens, CSS, reusable components)
- [x] Responsive layout shell (sidebar, header, mobile nav)
- [x] All pages and routing (Dashboard, Analytics, Focus, Namaz, Tracker, Settings)
- [x] Zustand stores for app UI, timer, and blocking state
- [x] Core domain engine (platform-independent)
- [x] UsageAccumulator, DailyResetManager, BlockingEvaluator
- [x] All 4 blocking rules (DailyLimit, FocusMode, ScheduledBlock, NamazMode)
- [x] Chrome extension infrastructure (manifest, background service worker, content script)
- [x] Extension build pipeline (`npm run build:extension`)
- [x] Account system removed — fully self-contained, no auth needed
- [x] TypeScript + lint checks passing (0 errors)

### Next Up
- [ ] Persist data to chrome.storage.local (survive browser restarts)
- [ ] Auto-detect active social media tabs via webNavigation API
- [ ] Real usage tracking from browser history
- [ ] Platform management CRUD
- [ ] Scheduled Blocks CRUD
- [ ] Analytics charts (7-day bars, per-platform breakdown)

---

## License

MIT

---

Made With Heart, By Raheel Nadeem
