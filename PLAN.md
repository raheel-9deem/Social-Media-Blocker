# Plan: Remove Account System — Standalone Extension

## Goal
Remove all authentication/user-account infrastructure from the React app so the extension works standalone — no login, no database, no auth pages. Users download from GitHub, extract, load the `extension/` folder in Chrome Dev Mode, and it works.

## Scope

### Files to Remove
| File | Reason |
|---|---|
| `smb-ui/src/pages/LandingPage.tsx` | Auth entry point — no longer needed |
| `smb-ui/src/pages/LoginPage.tsx` | Auth page — remove entirely |
| `smb-ui/src/pages/SignupPage.tsx` | Auth page — remove entirely |
| `smb-ui/src/pages/OnboardingPage.tsx` | Auth page — remove entirely |
| `smb-ui/src/store/authStore.ts` (if exists) | Auth state — remove entirely |
| `smb-ui/src/adapters/auth/` (entire folder) | Auth adapter(s) — not needed |

### Files to Modify
| File | Changes |
|---|---|
| `smb-ui/src/App.tsx` | Remove auth routes (`/`, `/login`, `/signup`, `/onboarding`). Root → `/app/dashboard`. Remove auth imports. Remove `<ProtectedRoute>` wrapper — everything under `/app` is now public. |
| `smb-ui/src/components/layout/AppLayout.tsx` | Remove auth-related layout logic (redirect if not logged in). May need to pass a default profile/user object. |
| `smb-ui/src/store/appStore.ts` | Remove `user`, `profile`, `isAuthenticated` state. Add a single default `profile` (id: "local", name: "Me") generated on first load so the engine always has a profile to work with. |
| `smb-ui/src/pages/SettingsPage.tsx` | Remove account-related settings sections (email, password, delete account). Keep platform settings, limit settings. |
| `smb-ui/src/App.tsx` routes | Keep: Dashboard, Analytics, Focus, Namaz, Tracker, Platforms, Settings, Schedule |

### Engine / Storage Changes
| File | Changes |
|---|---|
| `smb-ui/src/adapters/storage/InMemoryStorageAdapter.ts` (or wherever storage is) | No auth needed — data already in-memory. Consider switching to `chrome.storage.local` for persistence across sessions (data survives browser restarts). |
| `smb-ui/src/hooks/useEngine.ts` | Ensure engine works with a hardcoded profile id (no auth user lookup). Currently creates profile if none exists — verify this path works. |

### No Changes Needed
- `extension/manifest.json` — already correct
- `extension/background.js` — already correct
- `extension/content.js` — already correct
- `smb-ui/src/core/` — domain logic is already platform-independent
- All blocking rules (DailyLimit, FocusMode, ScheduledBlock, NamazMode) — already self-contained

## Steps (Implementation Order)
1. Read and delete auth page files
2. Read and modify `App.tsx` — remove auth routes, set dashboard as entry
3. Read and modify `AppLayout.tsx` — remove auth guards
4. Read and modify `appStore.ts` — remove auth, add default profile
5. Read and modify `SettingsPage.tsx` — remove account sections
6. Delete auth adapter files
7. Verify no remaining auth imports (grep)
8. Build and verify: `cd smb-ui && npm run build`
9. Build extension: `npm run build:extension`
10. Verify `extension/` folder is self-contained
