# DECISIONS.md

> `PLAN.md` and the `design/` mockups referenced below are kept locally and are not tracked in the repository.

Choices made where PLAN.md was silent or ambiguous, the bundle sizes, the acceptance checklist (§14) with how each
line was verified, and what could not be verified here.

## Decisions

### Logic
- **Days left** = whole days after today until the end date (Day 8 of 24 → 16), matching `design/Main.dc.html`; before the start it is the full length (24).
- **Sleep in the score**: a night sleep is attributed to a day by the 12:00 cut-off (01:30 on 2 Nov → 1 Nov). Sleep takes part for a day once that day is in the past, or when a night sleep is already attributed to it. *Today* with no night sleep yet is excluded (not scored 0), so the live score isn't dragged down all day.
- **Score categories** also include `carbs` and `fat` (PLAN §5.4 mentions them but its `ScoreCategory` type omits them). A target only participates when enabled **and** > 0. Numeric custom trackers without their own target are not scored.
- **Streak**: consecutive days ending today; a day still in progress does not break the run. Threshold 0 = any day with something logged (any table).
- **PRs**: the first time an exercise is ever done is the baseline, not a PR. A set counts only once marked **done**; warm-ups never count. "n PRs" in a session = number of distinct exercises that set at least one record (one heavy set often beats several metrics at once). Volume = done, non-warm-up sets.
- **Standard deviation** (bedtime/wake spread) is the population SD. Bedtimes after 12:00 are plotted as minus 24 h.
- **Challenge weeks** for Stats are 7-day buckets counted from Day 1 (Day 1 is a Monday, so they equal Mon–Sun); the last may be partial ("Wk 4 (3 d)").
- **Times** are displayed in the wall-clock of the offset they were *logged* in (`tzOffsetMin` stored on every record), never the phone's current zone. Records with a `dayKey` never recompute it.
- **Night sleeps are never marked "edited later"** — they are attributed to the previous day by design, so every wake-up would otherwise be flagged.
- **Bought ↔ Cooked** switching keeps photo, label, time; items are re-flagged (`estimated = true` for Bought, `false` for Cooked). In Cooked mode an item can be marked "Estimated amount", which lowers the meal's exact %.
- A reference-database food is **copied into the user library when the item is saved** (once per reference id), not merely when it is browsed.
- Check-in sliders start at 5/10 (the midpoint) because every field is required in the data model; a saved check-in is always deliberate.
- **Rest timer** counts down the user's own seconds, then counts up past zero; it can be dismissed.
- New **quick-water rows** are created blank (0 ml) and only appear on the Water screen once an amount is set — the app never invents a size.
- The baseline checklist logs against the baseline date even when opened earlier.
- **Recap** is locked until the recap date; a "Preview with the data so far" link is provided so numbers can be checked earlier.
- Colour semantics follow the designs: a decrease in weight/waist is green, an increase blue. These are presentational only and carry no advice.

### UI / platform
- Tab bar bottom offset is `max(28px, safe-area-bottom − 6px)`, which equals the design's 28 px on iPhones with a home indicator (PLAN's "28 px + safe area" would float it ~62 px up).
- Motion is used through `LazyMotion` + `m` (domAnimation only) to keep the initial bundle small.
- Once-per-day records (check-in, steps, soreness, day tags, day notes, custom logs, measurements, progress photos) use deterministic ids such as `checkin:2026-11-02`, so "re-open edits" is an upsert.
- JPEGs are encoded with the synchronous `canvas.toDataURL` path instead of `canvas.toBlob`: `toBlob` waits on a rendered frame and measured a flat ~1 s per call when the page was throttled, which would stall photo saving if the app is backgrounded mid-save. (Demo seed went from ~135 s to 0.4 s.)
- Backup export is **two steps** (build the zip, then a fresh tap on "Save to Files / Share") because iOS rejects `navigator.share` once the user gesture has expired during a slow zip build.
- The hidden developer tools (Load demo data / Wipe all data) appear after tapping **Version** five times in Settings → About. Demo data shifts the challenge dates so today is Day 10; wiping restores the real dates.
- **Pull-to-refresh** runs a service-worker update check and reloads into the new build when one exists (otherwise a toast says "Up to date"; with no service worker, e.g. a dev server, it simply reloads). It is limited to the four tab screens so it cannot discard a half-filled form or a running session, ignores sideways/upward drags and drags that start away from the top, and moves the page by writing styles directly (no React re-render per touch). Settings → About shows a **Build** stamp (UTC time + commit) baked in at build time.
- **Zoom and long-press are blocked on request**: `maximum-scale=1, user-scalable=no`, `touch-action: manipulation`, cancelled `gesturestart/change/end` and two-finger `touchmove`, `user-select: none` + `-webkit-touch-callout: none` on everything except form fields. This trades away pinch-zoom accessibility; it only applies to this single-user app.
- **iOS home-screen layout (no `viewport-fit=cover`)**: PLAN §10 asks for `viewport-fit=cover`, but on the target iPhone it made the installed app's page area start at the very top (behind the clock) while keeping the status-bar-reduced height (screen − 47 pt), so the app stopped 47 pt above the bottom with a black strip and the tab bar floated high. The reference app MoNy on the same phone (no `viewport-fit=cover`, `black-translucent`) lays out from below the status bar to the bottom edge, so this app now uses the same meta combination; iOS then reports 0 for the safe-area insets and the layout uses small fixed paddings instead. Glows fade out before the screen-box bottom and Settings → About (developer tools) shows the viewport values iOS reports. Overlays render into `#portal`, which is sized like `#root`.
- Reference food database: 201 items written from memory of published USDA / TKPI / MyFCD values (header says "approximate reference values; user can override any number"); every picked item becomes an editable library food.
- Toolchain resolved to current majors: Vite 8, TypeScript 7, Vitest 5, motion 14, vite-plugin-pwa 2, React Router 6 (kept on v6 with React 18).

## Bundle sizes (`npm run build`, then `node scripts/bundle-size.mjs`)

```
entry (index) + static imports : 124.2 KB gzipped   (371.6 KB raw)
+ Today route (first screen)   : 153.4 KB gzipped   ← initial JS, limit 200 KB
lazy (loaded only on demand)   : @zxing 114.6 KB · leaflet 41.9 KB (+6.4 KB css) · jszip 27.6 KB · html-to-image ~6.8 KB
largest route chunks           : Stats 11.1 KB · LogMeal 7.3 KB · Settings 6.2 KB · Today 7.4 KB   (gzipped)
service worker precache        : 91 entries, 1.5 MB (every route chunk, CSS, icons, reference food DB)
```

## Acceptance checklist (§14)

- [x] **`npm run build` zero TS errors; `npm run test` green** — build passes with `tsc --noEmit` clean; 70 tests in 7 files pass.
- [x] **Initial gzipped JS < 200 KB** — 153.4 KB (see above).
- [x] **Works fully offline after first load** — built with `vite build`, served with `vite preview`, service worker activated (86 precached entries), then the preview server was **stopped** and the app reloaded and navigated from the cache with all data present. Only barcode lookup and map tiles need the network.
- [x] **A meal cannot be saved without a photo, in both modes** — in the running app both the header "Save" and the bottom button are disabled in Cooked and Bought ("Add photo to save"); forced clicks wrote 0 meals; `save()` also returns early without a photo.
- [x] **Bought items show `≈`; exact vs estimated % correct** — Meal detail/log show `≈` on kcal, macros, grams and per-item kcal; unit tests cover exact % (item-level, day-level, cooked portions, all-estimated = 0 %).
- [x] **Only plain water fills the 3,000 ml target** — unit tests (`dayNutrition`, `scoreDay`): other drinks add nutrition but not water; the Drink logger only writes `kind: 'other'`.
- [x] **Night sleep at 01:30 on 2 Nov → 1 Nov; nap at 14:00 on 2 Nov → 2 Nov** — `dates.test.ts` (plus the 11:59/12:00 boundary and custom cut-off).
- [x] **While a sleep is active every launch shows only Wake Up** — with an active sleep set, 8 different routes (including `/settings`, `/log/meal`, `/search`) rendered only the Wake Up screen with no tab bar; the tab bar returns after waking.
- [x] **Weight chart spaces dots by real dates and shows per-week rate** — using 98.6 / 97.4 / 96.5 / 95.1 on 25 Oct, 1 Nov, 8 Nov, 18 Nov the dots sit 89 / 90 / 127 px apart (7 : 7 : 10 days) and the segments read −1.2 · 1.2/wk, −0.9 · 0.9/wk, −1.4 · 1/wk (the 10-day gap is comparable).
- [x] **Measurements compare 25 Oct vs 18 Nov with cm and %** — waist 104 → 99.5 cm −4.3 %, hips −2.7 %, chest −1.8 %, neck −2.4 % (identical to the design).
- [x] **Score uses only enabled targets and user weights; non-training days don't penalise training** — `score.test.ts` (empty/partial day, direction rules, renormalised weights, training only on marked days, sleep/custom rules, 7-day window at challenge start).
- [x] **No screen contains advice, suggestions, prescriptions or motivational copy** — grep audit of every string in `src/` for coaching vocabulary found only tooltip properties and statements that the app never advises; reports are facts only (`report` test asserts no advisory words).
- [x] **All lists/targets/labels editable in Settings; quick-add water starts empty** — Settings has every section from §6.10; the Water screen shows "No quick buttons yet" on a fresh install; adding a button in Settings makes it appear and logs 250 ml when tapped.
- [x] **Backup export → wipe → import restores everything including photos** — in the running app: 34 meals / 6 workouts / 37 photo blobs / 74 drinks / 12 sleeps / 20 foods before; all tables 0 after wipe; identical counts after import; a restored photo had the same byte size and `image/jpeg` type; settings restored.
- [x] **dayKey stays correct after changing the phone's timezone** — `dates.test.ts` shows 00:30 on 2 Nov in UTC+8 is 23:30 on 1 Nov in UTC+7, and that a stored `{dayKey, tzOffsetMin}` keeps both its day and its displayed clock time; every record freezes `dayKey` and `tzOffsetMin` at log time and nothing recomputes them. (The phone's zone itself can't be changed from the test browser.)
- [x] **Layout correct at 375–430 px** — all 28 routes (demo data) and 32 routes (empty database) were swept at 375, 390 and 430 px: no horizontal overflow, no empty screens, zero console errors. Safe areas are handled with `env(safe-area-inset-*)` in the screen padding, tab bar, sheets and Wake Up screen; a physical notch can't be emulated here (see below).

## Not verified here (needs a real iPhone)

- Add to Home Screen install, standalone launch and the iOS share sheet / Save to Files.
- Live camera: the progress-photo overlay (`getUserMedia`) and the barcode scanner — the pane blocks camera access, so only the graceful fallback to the picker / typed barcode was exercised. The Open Food Facts lookup itself was tested live (Nutella → 539 kcal; unknown code → "not found").
- Rendering under a real notch / home indicator, and `navigator.storage.persist()` granting.
- `getUserMedia` and service workers require HTTPS on iOS, so use the GitHub Pages URL (not `http://<lan-ip>`) for those.
