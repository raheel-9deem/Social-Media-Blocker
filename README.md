# Social Media Blocker

A calm, minimal, and modern digital-wellbeing Chrome extension. No account, no database, no setup required.

> **Status:** MVP — Standalone Chrome extension with Focus Mode, Namaz Mode, and Analytics

---

## What It Does

| Feature | Description |
|---|---|
| **Smart Blocking** | Set daily time limits per platform. Automatically block when you hit your cap. |
| **Focus Mode** | Activate deep-work sessions that block selected platforms for a set duration. |
| **Namaz Mode** | Auto-pause social media during prayer windows (Fajr, Dhuhr, Asr, Maghrib, Isha). |
| **Clean Analytics** | Minimal, calm charts showing your usage patterns. |
| **Manual Timer** | Track platform sessions manually. |

### Supported Platforms
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

---

## Architecture

The entire app lives in **one folder** — `extension/`. No servers, no separate web app, no account system.

```
extension/                       ← ONE FOLDER, EVERYTHING INSIDE
├── manifest.json                # Chrome Extension Manifest V3
├── background.js                # Service worker (heartbeat, blocking rules)
├── content.js                   # Content script — injects block overlay
├── icons/                       # Extension icons (16/48/128)
├── package.json                 # npm config
├── vite.config.ts               # Build configuration
├── tsconfig.json                # TypeScript config
├── index.html                   # Popup entry (built React app)
├── assets/                      # Bundled React app (node_modules not required)
└── src/                         # React source code
    ├── main.tsx                 # Entry point
    ├── App.tsx                  # Routing + layout
    ├── core/                    # Blocking engine (platform-independent)
    ├── components/              # UI components
    ├── pages/                   # Dashboard, Focus, Namaz, etc.
    ├── store/                   # Zustand state
    ├── hooks/                   # Custom hooks
    └── adapters/                # Storage, tracking, notifications
```

### How It Works

1. **Popup** — Click the extension icon in Chrome toolbar. A full React SPA opens.
2. **Blocking** — When blocked, `background.js` + `content.js` inject a full-screen overlay.
3. **Storage** — Data lives in-memory. No server, no sync, no account.

---

## Install for Development

```bash
cd extension
npm install
npm run dev
```

Opens a dev server at `http://localhost:5173/`.

## Build the Extension

```bash
npm run build:extension
```

This compiles TypeScript + Vite build, then copies the output into the `extension/` root (preserving `manifest.json`, `background.js`, `content.js`, and `icons/`).

## Load in Chrome

1. Open **chrome://extensions**
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the **`extension/`** folder

Click the extension icon to open the app. After code changes, run `npm run build:extension` and click **Reload**.

## Core Engine (`src/core/`)

Zero dependencies on React or any browser/Node API. Platform-independent domain logic.

| Module | Responsibility |
|---|---|
| `BlockingEvaluator` | Orchestrates all rules → returns per-platform decisions |
| `DailyLimitRule` | Checks daily time budget |
| `FocusModeRule` | Blocks during active Focus sessions |
| `ScheduledBlockRule` | Blocks during user-defined time windows |
| `NamazModeRule` | Blocks during prayer windows |
| `UsageAccumulator` | Aggregates usage logs into per-platform minute totals |
| `DailyResetManager` | Timezone-aware day boundary detection |

---

## License

MIT

---

*Made with ❤, by Raheel Nadeem*
