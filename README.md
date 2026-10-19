# 21 by 21

A personal iPhone app for a 24-day gym and clean-eating challenge
(Day 1 = Mon 26 Oct 2026 → Day 24 = Wed 18 Nov 2026, baseline Sun 25 Oct, recap Thu 19 Nov).

**Live:** https://rafialaydrus.github.io/21by21/ — open it in Safari and add it to the Home Screen.

It is a **pure tracker**: it records what you log, calculates from it, and compares it with targets *you* type in
Settings. It never plans, suggests, coaches or auto-generates a number. No backend, no login, no account — all data
stays on the phone (IndexedDB).

## What it does

| Tab | Contents |
|---|---|
| **Today** | Consistency score (7-day) and per-category rings, "still to log today", gym this week, next weigh-in, upcoming reminders, calories/protein/macros, sleep, supplements, water, graphs, timeline, 24-day calendar |
| **Train** | Sessions with sets, reps and weight, last-time ghost line, instant PR badges, rest stopwatch, cardio, exercise library, history, PR wall, gyms and a gym map |
| **+** | Quick Log: meal, water, drink, supplement, workout, cardio, sleep, craving, check-in, weigh-in, measurements, progress photo, soreness, steps, day tag, note, reminder, your own custom trackers |
| **Eat** | Today's meals, food gallery, library (foods, recipes, drinks, supplements), water and drinks |
| **Stats** | Overview, Body, Train, Food and Sleep tabs; every chart is tappable (tooltip, then the day) |

Also: Wake Up lock screen while a sleep is active, day view and day-card image, Recap with before/after photo
slider, weekly text report, zip backup and restore, and full offline use.

Rules the app follows: a meal always needs a photo; bought items are estimates (`≈`); only plain water counts toward
the water target; every record stores its own `dayKey` and timezone offset, so travelling between Malaysia (UTC+8) and
Indonesia (UTC+7) never moves an entry to another day.

## Install on the iPhone

1. Open **https://rafialaydrus.github.io/21by21/** in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. Launch **21 by 21** from the Home Screen. The first-run screen asks you to confirm the dates and (optionally) set
   targets, then requests persistent storage.

After the first load everything works offline except barcode lookup (Open Food Facts) and map tiles. Updates download
in the background and apply the next time you open the app (close it from the app switcher and open it again).

## Back up and restore

Your data lives only in this phone's browser storage, so keep a copy.

- **Settings → Backup → Export backup (zip)** builds `21by21-backup-YYYY-MM-DD-HHmm.zip` (`data.json` plus every photo
  and thumbnail). Then tap **Save to Files / Share** and choose **Save to Files**. Today shows a notice when the last
  backup is older than the number of days you set.
- **Settings → Backup → Import backup…** picks a zip, shows what is inside and, after you confirm
  “This replaces all data on this phone”, restores every table and photo.
- **Report** (Stats → share icon) produces a plain-text/Markdown summary for any date range to copy or share.

## Run locally

```bash
npm ci
npm run dev            # http://localhost:5173
npm run dev -- --host  # also listens on your Wi-Fi so a phone can open it
```

> iOS only allows the live camera (progress-photo overlay, barcode scanner) and service workers on **HTTPS**. Over
> plain `http://` on the LAN the app still works; the in-app camera falls back to the system camera/library picker
> and the barcode screen offers typing the number. Use the live URL to test those.

| Command | Does |
|---|---|
| `npm run test` | Vitest: 70 tests for the pure logic (dates, sleep attribution, nutrition, score, still-to-log, PRs, stats, search, report, timeline) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run build` | Typecheck + production build into `dist/` (installable PWA with service worker) |
| `npm run preview` | Serve `dist/` at http://localhost:4173 |
| `node scripts/bundle-size.mjs` | After a build: gzipped size of the first-launch JS (currently ~153 KB, limit 200 KB) |
| `node scripts/make-icons.mjs` | Regenerate `public/icons/*` |
| `node scripts/make-fooddb.mjs` | Regenerate `public/fooddb/reference.json` (≈200 approximate reference foods; edit the table in the script) |

## Deploy (GitHub Pages)

Deployment is automatic: every push to `main` runs `.github/workflows/deploy.yml` (`npm ci` → tests → build → publish
`dist/`).

To set it up on a fresh fork: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Do **not** choose “Deploy from a branch”: that publishes the raw source (`index.html` pointing at `/src/main.tsx`)
instead of the built app, so the page is blank and there is no service worker.

The app uses `base: './'` and `HashRouter`, so it works under any repository path.

## Developer tools

Settings → About → tap **Version** five times:

- **Load demo data** — about ten days of made-up entries; shifts the challenge dates so today is Day 10.
- **Wipe all data** — type `DELETE`; restores the real dates and the first-run screen.
- **Viewport readout** — the page size, safe-area insets, display mode and status-bar setting your device reports
  (useful when a layout looks off on a particular phone).

## iPhone layout notes

- The page deliberately does **not** set `viewport-fit=cover`. On the target iPhone it moved the installed app's page
  up behind the clock while keeping the status-bar-reduced height, leaving a black strip at the bottom. Without it
  the page runs from below the status bar to the bottom edge. Safe-area insets are then 0, so paddings are fixed.
- The status bar is `black-translucent`; content fades to black at the top edge instead of being cut off.
- Overlays (sheets, toasts, camera) render into `#portal`, which is sized like `#root`.

## Stack and layout

React 18 · TypeScript (strict) · Vite · HashRouter · Dexie (IndexedDB) · motion (`LazyMotion`) · vite-plugin-pwa ·
date-fns · plain CSS · hand-written SVG charts. `@zxing/browser`, `jszip`, `html-to-image` and `leaflet` are
lazy-loaded.

```
src/db/          Dexie schema, types, defaults, backup/import, demo seed, reference-food loader
src/logic/       pure, unit-tested functions (dates, nutrition, score, todo, prs, stats, search, timeline, report)
src/charts/      SVG charts (line, bar, scatter, cell grids)
src/components/  glass UI kit, sheets, toasts, tab bar, share cards, body map
src/hooks/       data context (one live query), analysis, logger host, clock
src/lib/         portal target, image export helpers
src/screens/     today · train · eat · stats · log · settings · sleep · recap · day · search · water · onboarding
public/fooddb/   bundled reference foods (approximate values; every number can be overridden)
scripts/         icon and reference-food generators, bundle-size report
```

`DECISIONS.md` records every choice made where the original plan was silent, the bundle sizes, and the
acceptance-checklist results. The original plan and design mockups are kept locally and are not part of the repository.
