# 21 by 21

A personal iPhone PWA for a 24-day gym and clean-eating challenge
(Day 1 = Mon 26 Oct 2026 → Day 24 = Wed 18 Nov 2026, baseline Sun 25 Oct, recap Thu 19 Nov).

It is a **pure tracker**: it records what you log, calculates from it, and compares it with targets *you* type in
Settings. It never plans, suggests, coaches or auto-generates a number. No backend, no login, no account — all data
stays on the phone (IndexedDB).

Stack: React 18 + TypeScript (strict) + Vite · HashRouter · Dexie · motion · vite-plugin-pwa · hand-written SVG charts.
`@zxing/browser`, `jszip`, `html-to-image` and `leaflet` are lazy-loaded.

## Run locally

```bash
npm i
npm run dev            # http://localhost:5173
npm run dev -- --host  # also listens on your Wi-Fi so the iPhone can open it
```

With `--host`, Vite prints a *Network* URL such as `http://192.168.1.20:5173/`. Open it in iPhone Safari (same Wi-Fi).

> iOS only allows the live camera (progress-photo overlay, barcode scanner) and service workers on **HTTPS**.
> Over plain `http://` on the LAN the app still works; the in-app camera falls back to the system camera/library
> picker and the barcode screen offers typing the number. For the full experience, test the deployed GitHub Pages URL.

```bash
npm run test       # vitest: pure logic (dates, sleep attribution, nutrition, score, todo, PRs, stats, search, report)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ (service worker active) at http://localhost:4173
```

## Deploy on GitHub Pages (GitHub Actions)

1. Create an empty GitHub repository and push this project to the `main` branch:
   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git branch -M main
   git push -u origin main
   ```
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs on every push to `main`: `npm ci` → `npm run test` →
   `npm run build` → publishes `dist/`. When it finishes, the site is at `https://<you>.github.io/<repo>/`.

`vite.config.ts` uses `base: './'` and the app uses `HashRouter`, so it works under any repository path.

## Install on the iPhone

1. Open the Pages URL in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. Launch **21 by 21** from the Home Screen. The first-run screen asks you to confirm the dates and (optionally) set
   targets, then requests persistent storage.

After the first load everything works offline except barcode lookup (Open Food Facts) and map tiles.
New versions download in the background and apply the next time you open the app.

## Back up and restore

Your data lives only in this phone's browser storage, so keep a copy.

- **Settings → Backup → Export backup (zip)** creates `21by21-backup-YYYY-MM-DD-HHmm.zip` (`data.json` plus every
  photo and thumbnail) and opens the iOS share sheet — choose **Save to Files**. Today shows a notice when the last
  backup is older than the number of days you set.
- **Settings → Backup → Import backup…** picks a zip, shows what is inside, and — after you confirm
  “This replaces all data on this phone” — restores every table and photo.
- **Report** (Stats → share icon, or Settings → Backup) produces a plain-text/Markdown summary for any date range;
  copy it or share it wherever you like.

## Using the app

- **Tabs:** Today · Train · **+** (Quick Log) · Eat · Stats. Body data lives in Stats → Body and is logged through **+**.
- **Sleep:** tap **Sleep** in **+**, choose Nap or Night. While a sleep is active the whole app is only the Wake Up
  screen until you wake up.
- **Meals** always need a photo (Bought or Cooked). Bought items are estimates (shown with `≈`); Cooked ingredients are
  exact unless you mark one as estimated.
- **Water** counts plain water only toward the water target; other drinks are logged separately.
- Every target, list, label and score weight is set by you in **Settings** (gear on Today).

## Demo data (developer tool)

Settings → About → tap **Version** five times to reveal **Load demo data** and **Wipe all data** (typed `DELETE`).
Demo data fills about ten days of made-up entries and shifts the challenge dates so today is Day 10; wiping restores
the real dates and the first-run screen.

## Project layout

```
src/db/        Dexie schema, types, defaults, backup, demo seed, reference-food loader
src/logic/     pure, unit-tested functions (dates, nutrition, score, todo, prs, stats, search, timeline, report)
src/charts/    hand-written SVG chart components
src/components/ glass UI kit, sheets, toasts, tab bar, share cards
src/screens/   today · train · eat · stats · log · settings · sleep · recap · day · search · water · onboarding
public/fooddb/ bundled reference foods (~200, approximate values; every number can be overridden)
scripts/       icon + reference-food generators, bundle-size report
```

`DECISIONS.md` records every choice made where the plan was silent and the acceptance-checklist results.
