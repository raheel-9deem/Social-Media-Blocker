# Social Media Blocker

A calm, minimal, and modern digital-wellbeing Chrome extension. No account, no database, no setup required.

> [!WARNING]
> **Work in Progress / Known Issues:**
> This application is currently in early active development and contains **significant bugs and UI/interaction issues** (several buttons, toggles, and UI layouts are not working properly yet). It is **NOT** ready for production use yet.
> 
> 🤝 **Contributions are fully open!** Anyone is welcome to jump in, fix bugs, improve the UI/UX, or implement features. All contributors will have their credits permanently added to this repository!

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

## ⚠️ Current Status & Known Issues

The extension is currently under active refactoring and **contains notable bugs**. If you are testing or running the extension, you may encounter:

- **Unresponsive Buttons & Toggles:** Certain interactive buttons (such as Focus Mode triggers, Namaz toggles, quick timers, and settings buttons) do not respond or fail silently due to unhandled event/bridge exceptions.
- **UI & Layout Inconsistencies:** The interface currently has styling quirks and layout constraints between Chrome's extension popup container and standalone browser viewports.
- **Build & Asset Syncing:** The build pipeline and file copy routines occasionally miss CSS outputs or entry point bindings.
- **Extension Runtime Bridge:** In-memory storage and Chrome service worker message bridging have edge-case failures when accessed outside of the extension context.

---

## 🤝 Open for Contributions!

**This project is 100% open for everyone to contribute!**

If you have experience with **React 19, TypeScript, Tailwind CSS, or Chrome Extensions (Manifest V3)**, we would love your help squashing bugs and polishing the app:

1. **Fork** the repository.
2. **Clone** your fork and create a new feature/bugfix branch:
   ```bash
   git checkout -b fix/your-bugfix-name
   ```
3. **Make your changes**, test thoroughly, and ensure the build succeeds:
   ```bash
   cd extension
   npm run build
   npm test
   ```
4. **Submit a Pull Request (PR)** with a description of the issue you fixed.

---

## 🌟 Contributors & Credits

We value and appreciate every contribution! Anyone who opens an accepted PR fixing bugs, refining the UI, or adding tests will have their name and profile permanently credited here:

| Contributor | Contribution | Profile |
|---|---|---|
| **Raheel Nadeem** | Project Creator & Initial Architecture | [@raheel-9deem](https://github.com/raheel-9deem) |
| *Your Name Here* | *Fix a bug or improve UI to be added!* | *PR link* |

---

## License

MIT

---

*Made with ❤ by Raheel Nadeem & Community Contributors*
