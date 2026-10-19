# 21 by 21 — Build Plan (one-shot spec for Claude Code)

> **Read this whole file before writing any code.** This is the complete, approved spec. Build everything in it in one go. Do not stop to ask questions: where something is not specified, choose the simplest option that fits the rules in this file, and list those choices in `DECISIONS.md` at the end. Visual reference for 6 key screens is in `design/` (see §16).

---

## 0. What this app is

A personal, all-in-one **tracking** app for one person (Rafi) during a 24-day gym and clean-eating challenge.

- **Challenge:** Day 1 = Mon 26 Oct 2026 → Day 24 = Wed 18 Nov 2026. Day 0 (baseline) = Sun 25 Oct 2026. Thu 19 Nov 2026 = recap only (his 21st birthday), no logging expected.
- **Platform:** iPhone only, installed as a PWA ("Add to Home Screen"), hosted on **GitHub Pages**. No backend, no login, no accounts. All data stays on the phone.
- **Core rule — the app NEVER tells the user what to do.** No workout plans, no suggested weights, no progression advice, no "you should eat X", no AI tips, no auto-generated targets. The app only **records**, **calculates from what was recorded**, and **compares against targets the user typed in himself**. Every target, list, label and weight is set by the user in Settings. Copy in the UI must be neutral and factual ("1,200 ml left", "Dinner not logged"), never coaching ("Drink more!", "Great job, keep pushing!").
- **Packed with information:** every number is tappable and opens a detail page with history, graph, averages, best/worst, trend vs last week.

### 0.1 Tab bar & navigation
Bottom glass tab bar with 4 tabs and a raised center **+** button:

`Today` · `Train` · **(+)** · `Eat` · `Stats`

- **+** opens the Quick Log sheet (§6.2).
- Body data (weight, measurements, progress photos, soreness) lives inside **Stats → Body** and is logged through **+**.
- Settings is opened from the gear button on the Today header.

---

## 1. Tech stack (fixed — do not substitute)

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict) + Vite |
| Routing | `react-router-dom` with **HashRouter** (GitHub Pages safe) |
| Animation | `motion` (Framer Motion) — short, snappy (see §15.4) |
| Storage | IndexedDB via **Dexie** (+ `dexie-react-hooks` `useLiveQuery`) |
| PWA | `vite-plugin-pwa` (Workbox, `generateSW`, autoUpdate) |
| Charts | **Hand-written SVG React components** (no chart library — keep the app light) |
| Barcode | `@zxing/browser` — **lazy-loaded** only when the scanner opens |
| Zip backup | `jszip` — lazy-loaded |
| Image export (day cards, recap) | `html-to-image` — lazy-loaded |
| Map of gyms | `leaflet` + OpenStreetMap tiles — lazy-loaded, optional screen |
| Dates | `date-fns` (tree-shaken) |
| Tests | `vitest` for pure logic |
| Styling | Plain CSS (CSS variables + a few utility classes) in `src/styles/`. No Tailwind, no UI kit. |

Initial JS bundle target: **< 200 KB gzipped**. Code-split every route. Lazy-load zxing, jszip, html-to-image, leaflet.

---

## 2. Project structure

```
/
├─ index.html
├─ vite.config.ts
├─ public/
│  ├─ icons/ (192, 512, maskable 512, apple-touch-icon 180)
│  └─ fooddb/ (bundled reference food database JSON, see §9.4)
├─ src/
│  ├─ main.tsx, App.tsx, routes.tsx
│  ├─ db/
│  │  ├─ schema.ts        (Dexie DB, tables, indexes, version)
│  │  ├─ types.ts         (all entity types)
│  │  ├─ defaults.ts      (default Settings — §3.1)
│  │  └─ backup.ts        (export/import zip)
│  ├─ logic/              (PURE functions, fully unit-tested)
│  │  ├─ dates.ts         (dayKey, challenge day number, sleep attribution)
│  │  ├─ nutrition.ts     (item & meal totals, portions, exact vs estimated)
│  │  ├─ score.ts         (Consistency Health)
│  │  ├─ todo.ts          ("Still to log today")
│  │  ├─ prs.ts           (personal records)
│  │  ├─ stats.ts         (aggregates, averages, trends, eating window, correlations)
│  │  └─ search.ts
│  ├─ components/         (Glass, Button, Ring, Bar, Chip, Sheet, Toast, NumberInput, PhotoPicker, …)
│  ├─ charts/             (LineChart, BarChart, StackedBar, Heatmap, Scatter, Ring, PairedBars, Sparkline)
│  ├─ screens/
│  │  ├─ today/  train/  eat/  stats/  log/  settings/  sleep/  recap/  day/  search/
│  ├─ hooks/
│  └─ styles/ (tokens.css, base.css, glass.css)
├─ .github/workflows/deploy.yml
└─ DECISIONS.md (written by you at the end)
```

---

## 3. Data model (Dexie)

General rules:
- Every record has `id: string` (use `crypto.randomUUID()`), `createdAt: number` (epoch ms), `updatedAt: number`.
- **Every logged record stores `dayKey: string` ("YYYY-MM-DD") computed at log time in the device's local timezone and saved.** Never recompute dayKey from timestamps later — the user travels between Malaysia (UTC+8) and Indonesia (UTC+7) and days must not shift.
- Times are stored as epoch ms **plus** `tzOffsetMin` (from `new Date().getTimezoneOffset()`), and displayed in local 24-hour format (`HH:mm`).
- Records logged on a past day keep working; if a record is created/edited after its day ended, set `editedLate: true` (shown as a tiny "edited later" marker in day views). Editing is always allowed.

### 3.1 `settings` (single row, id = "settings")

```ts
type Direction = 'atLeast' | 'atMost' | 'range';
interface Target { enabled: boolean; value: number; direction: Direction; rangeMax?: number; unit: string; }

interface Settings {
  challenge: {
    name: string;              // "21 by 21"
    baselineDate: string;      // "2026-10-25"
    startDate: string;         // "2026-10-26"
    endDate: string;           // "2026-11-18"
    recapDate: string;         // "2026-11-19"
    weighInDates: string[];    // ["2026-10-25","2026-11-01","2026-11-08","2026-11-18"]
    measurementDates: string[];// ["2026-10-25","2026-11-18"]
    progressPhotoDates: string[]; // ["2026-10-25","2026-11-18"]
  };
  targets: {                    // ALL start disabled except water; user fills values
    calories: Target; protein: Target; carbs: Target; fat: Target;
    water: Target;              // enabled, 3000 ml, atLeast  (plain water only)
    sleep: Target;              // hours, atLeast
    steps: Target;
    gymPerWeek: Target;         // enabled, 5, atLeast
    mealsPerDay: Target;        // count of meals expected per day
  };
  trainingDays: boolean[];      // 7 entries Mon..Sun — days the user EXPECTS a session (user sets; default all false)
  trackers: {                   // which trackers exist in the app at all (all true by default)
    training: boolean; food: boolean; water: boolean; drinks: boolean; supplements: boolean;
    sleep: boolean; checkin: boolean; cravings: boolean; soreness: boolean; steps: boolean;
    tags: boolean; spending: boolean; reminders: boolean;
  };
  score: {
    weights: Record<ScoreCategory, number>; // user-set; default equal
    labels: { min: number; label: string }[]; // user-named ranges, default [] (no label shown)
    streakThreshold: number;  // a day counts toward the streak if its score ≥ this; default 0 = any day with at least one log
  };
  customTrackers: CustomTracker[]; // e.g. "No sugar" (boolean) or "Stretching" (minutes)
  quickWater: { id: string; label: string; ml: number }[]; // starts EMPTY
  mealLabels: string[];        // default ["Breakfast","Lunch","Dinner","Snack"]
  cookingMethods: string[];    // default ["Pan-fried","Boiled","Air-fried","Grilled","Steamed","Baked","Raw"]
  supplementUnits: string[];   // default ["g","mg","ml","tsp","tbsp","scoop","capsule","tablet"]
  timingTags: string[];        // default ["Morning","With lunch","With dinner","Before gym","After gym","Before bed"]
  bodyParts: { id: string; name: string }[]; // default: Neck, Shoulders, Chest, Arm (L), Arm (R), Waist, Hips, Thigh (L), Thigh (R), Calf (L), Calf (R)
  dayTags: string[];           // default ["Travel day","Family event","Sick","Bad sleep","Rest day"]
  currencies: string[];        // default ["RM","Rp"]
  sleepNightCutoffHour: number;// 12 — a NIGHT sleep starting before 12:00 belongs to the previous day
  restTimer: { enabled: boolean; seconds: number }; // default enabled, 90
  backupReminderDays: number;  // 3 (0 = off)
  lastBackupAt?: number;
}
```

`ScoreCategory = 'training' | 'food' | 'water' | 'calories' | 'protein' | 'sleep' | 'supplements' | 'checkin' | 'steps' | \`custom:${id}\``

### 3.2 Tables

| Table | Key fields |
|---|---|
| `blobs` | id, `kind: 'meal'\|'progress'\|'other'`, `full: Blob` (max 1280px long edge, JPEG q0.75), `thumb: Blob` (320px, q0.7), `takenAt` |
| `foods` (user's ingredient library) | name, brand?, `basis: 'g'\|'ml'`, `per100: {kcal, protein, carbs, fat, fiber?, sugar?, sodiumMg?}`, `defaultState?: 'raw'\|'cooked'`, note?, `source: 'label'\|'barcode'\|'usda'\|'tkpi'\|'myfcd'\|'user'`, barcode?, `useCount`, `lastUsedAt` |
| `meals` | dayKey, time, tzOffsetMin, label, `mode: 'bought'\|'cooked'`, **photoId (required)**, items: `MealItem[]`, place?, price?: {amount, currency}, method?, cookTimeMin?, tool?, wholeDishG?, eatenG?, `clean: boolean`, note?, recipeId?, cost?: {amount, currency} |
| `recipes` (saved meals, both modes) | name, mode, items, method?, tool?, cookTimeMin?, place? |
| `drinkTypes` | name, `per100ml?: {kcal, protein, carbs, fat}` |
| `drinks` | dayKey, time, `kind: 'water'\|'other'`, drinkTypeId?, ml |
| `supplements` (library) | name, brand?, defaultAmount, unit, timingTag?, `daily: boolean` (counts toward score), `perServing?: {kcal, protein, carbs, fat}` (per defaultAmount) |
| `supplementLogs` | dayKey, time, supplementId, amount, unit, timingTag? |
| `exercises` (library) | name, `muscleGroups: string[]`, `kind: 'strength'\|'cardio'` |
| `gyms` | name, note?, equipment: string[], lat?, lng? |
| `workouts` | dayKey, checkIn, checkOut?, gymId?, title (free text the user types, e.g. "Push"), rating? (1–10), note?, `sets: WorkoutSet[]`, `cardio: CardioEntry[]` |
| `sleeps` | `kind: 'night'\|'nap'`, start, end?, dayKey (attributed, §5.3), durationMin? |
| `weighIns` | dayKey, time, kg, note? |
| `measurements` | dayKey, `values: Record<bodyPartId, number>` (cm), note? |
| `progressPhotos` | dayKey, `pose: 'front'\|'side'\|'back'`, blobId |
| `checkins` | dayKey, energy, mood, hunger, stress, soreness, dayRating (each 1–10), note? |
| `soreness` | dayKey, `muscles: Record<muscleId, 0\|1\|2\|3>` |
| `cravings` | dayKey, time, what, strength (1–10), `outcome: 'resisted'\|'ate'`, note? |
| `steps` | dayKey, steps |
| `dayTags` | dayKey, tags: string[] |
| `dayNotes` | dayKey, text |
| `reminders` | text, at (epoch ms), done |
| `customLogs` | dayKey, trackerId, value (boolean or number) |
| `meta` | key/value: `activeSleep` ({kind, start, tzOffsetMin}), `onboarded`, etc. |

```ts
interface MealItem {
  id: string; foodId?: string;           // link to library if exists
  name: string; brand?: string;          // SNAPSHOT at log time (library edits must not change past meals)
  amount: number; basis: 'g' | 'ml';
  state?: 'raw' | 'cooked';
  per100: Nutrients;                     // SNAPSHOT
  source: Food['source'];
  estimated: boolean;                    // true for every item in 'bought' mode
  isSeasoning: boolean;                  // shown in "Seasoning & oil" group
  note?: string;
}
interface WorkoutSet { id: string; exerciseId: string; order: number; weightKg: number; reps: number; isWarmup?: boolean; doneAt?: number; }
interface CardioEntry { id: string; exerciseId: string; durationMin: number; speedKmh?: number; inclinePct?: number; distanceKm?: number; kcal?: number; }
```

Add Dexie indexes on `dayKey` for every daily table, `[dayKey+time]` where useful, `supplementId`, `exerciseId` (multi-entry via a computed `exerciseIds` field on workouts).

---

## 4. Seed / first-run

- No sample data in production. Empty libraries (foods, exercises, supplements, drink types, gyms) — the user builds them.
- Settings defaults as in §3.1.
- The **reference food database** (§9.4) is bundled read-only and searchable, separate from the user's library. Picking a reference item copies it into `foods` with its source tag.
- **First-run screen (one time):** short 3-step setup: (1) confirm challenge dates, (2) set targets (all optional, can skip), (3) "Install to Home Screen" instructions for iOS Safari (Share → Add to Home Screen). Then call `navigator.storage.persist()`.
- Add a hidden **dev seed** button in Settings → About ("Load demo data" / "Wipe all data") that fills ~10 days of realistic demo data so every screen can be checked. Wipe asks for typed confirmation ("DELETE").

---

## 5. Core logic (pure functions in `src/logic/`, all unit-tested)

### 5.1 Dates
- `dayKey(date, tz)` → local "YYYY-MM-DD".
- `challengeDay(dayKey)` → `0` for baseline, `1..24`, `null` outside. Before start: "Starts in N days". After end date: "Challenge complete".
- `daysLeft(today)` counted to endDate inclusive.

### 5.2 Nutrition
- Item totals = `per100 × amount / 100`.
- Cooked meal portion: if `wholeDishG` and `eatenG` set, every item is multiplied by `eatenG / wholeDishG`.
- Meal totals = sum of items. Day totals = meals + other drinks (per100ml × ml / 100) + supplement logs (perServing × amount / defaultAmount when units match; otherwise nutrition not added and the log is flagged "nutrition not counted — unit differs").
- Water target counts **only** `drinks.kind === 'water'`.
- **Exact vs estimated %** = kcal from items with `estimated=false` / total kcal.
- Macro % split by calories (protein 4, carbs 4, fat 9).
- Display rounding: kcal integer, macros 1 decimal under 10 g, integer above. Estimated values are always prefixed with `≈`.

### 5.3 Sleep
- Tapping **Sleep** asks **"Nap or Night?"** (two big glass buttons), then saves `meta.activeSleep = {kind, start}` and shows a 10-second **Undo** toast.
- While `activeSleep` exists, the whole app renders **only the Wake Up screen** (design/Sleep.dc.html) on every launch, regardless of route. It shows kind, start time + date, live elapsed time, and a huge round glass **WAKE UP** button, plus a small "Edit sleep start time" link.
- Tapping WAKE UP opens a small confirm sheet with wake time pre-set to now (editable time picker) and a primary **Save** — one extra tap normally, but lets him fix a forgotten wake-up. Save creates the `sleeps` record, clears `activeSleep`, returns to Today.
- **Attribution:** `night` → if start hour < `sleepNightCutoffHour` (12) the dayKey is the **previous** date, else the start date. `nap` → start date.
- Any past sleep can be edited or deleted; manual add of a past sleep is allowed.
- Stats: night duration, nap total, night+nap total, bedtime and wake-time average with ± spread (standard deviation in minutes; handle bedtimes across midnight by treating times after 12:00 as minus 24h).

### 5.4 Consistency Health score (0–100)
Computed per day from what was logged vs the user's own targets. Only **enabled** trackers with an **enabled target / applicable rule** that day participate. Weights are the user's `score.weights`, renormalised over participating categories.

Per-category day score (0..1):
- **water**: `atLeast` rule vs target ml.
- **calories / protein** (and carbs/fat if user enables them as targets): by direction — `atLeast: min(1, a/t)`; `atMost: a ≤ t ? 1 : max(0, 1 − (a−t)/t)`; `range: 1 inside [value, rangeMax], linear decay to 0 at 25% outside`.
- **training**: only on days marked in `trainingDays`; 1 if any workout (sets or cardio) logged that day, else 0. Not participating on other days.
- **food**: if `mealsPerDay` enabled: `min(1, cleanMealsLogged / mealsPerDay)`. Unclean meals count as logged but not clean.
- **sleep**: night sleep hours attributed to that day vs sleep target (`atLeast`).
- **supplements**: fraction of `daily: true` supplements logged that day.
- **checkin**: 1 if check-in saved.
- **steps**: vs target.
- **custom trackers**: boolean → 1/0; numeric → vs its own target.

Day score = 100 × weighted mean. **Headline = 7-day rolling mean** of day scores (only days within challenge and ≤ today; today included as a live partial). Also show today's live score and change vs the previous 7-day window. Per-category rings show the 7-day mean per category. Label = the user's label whose `min` ≤ score (highest match); no label if none defined. Days before Day 1 are excluded.

Write unit tests covering: empty day, partial day, non-training day exclusion, direction rules, renormalised weights, 7-day window at challenge start (fewer than 7 days).

### 5.5 "Still to log today" (`todo.ts`)
List, in this order, every participating category not yet at 100% today:
water (shows `x / y ml` + progress bar) · meals missing (`Dinner not logged` using mealLabels by time order; if fewer meals than mealsPerDay) · each `daily` supplement not logged (`Fish oil not logged`, tapping logs it with default amount in **1 tap** + undo toast) · training (on training days) · daily check-in · weigh-in (if today is in weighInDates and none logged) · measurements / progress photos (if today is a measurement/photo date) · steps · custom trackers. Empty list → show "All logged today".

### 5.6 Personal records (`prs.ts`)
Computed from the user's own sets only (warm-ups excluded): per exercise — heaviest weight, most reps at a given weight, best estimated 1RM (Epley: `w × (1 + reps/30)`), best single-set volume (w × reps), best session volume. A set that beats a previous best gets a PR badge. PR wall lists all PRs by date.

### 5.7 Stats helpers (`stats.ts`)
Daily series builder for any metric; averages, min/max with dates, trend vs previous 7 days (arrow + delta), **eating window** (first→last meal time per day) and **overnight gap** (last meal yesterday → first meal today), food spend totals **per currency** (never convert), cravings per hour-of-day histogram, workout volume per session/week, muscle-group volume split (a set's volume is credited to every muscle group of its exercise, divided equally), Pearson r for correlation pairs (with optional "Y = next day" lag).

### 5.8 Search
One search over meals (item names, place, note), foods library, recipes, exercises, workouts (title, note), cravings, day notes, tags, reminders, check-in notes. Results grouped by type, each opens its detail/day view. Plain case-insensitive substring, diacritics-insensitive.

---

## 6. Screens

Global layout rules: dark only; content padding 16px; respect safe-area insets (`env(safe-area-inset-*)`); tab bar floats over content with bottom padding so content is never hidden. Every list row and number is a tap target ≥ 44px.

### 6.1 Today (home) — see `design/Main.dc.html`
Top → bottom:
1. **Header**: "DAY 8 OF 24" (green, small caps), large "Today", full date; gear button (glass circle) → Settings; search button next to it → Search.
2. **Consistency card**: big ring (7-day score) with number and "7-day"; user label (e.g. "Locked in") if defined; chips "Today 92" and "↑ 4 vs last wk"; "16 days left · ends Wed 18 Nov". Row of small rings per participating category (Train, Food, Water, Sleep, Supps, custom…), each tappable → that category's stats.
3. **What's next** (one combined section):
   - "STILL TO LOG TODAY" list from §5.5 — each row tappable straight into its log screen.
   - Two tiles: **Gym this week** (`n / 5` with 5 segment bar, Mon–Sun week) and **Next weigh-in** (next date from weighInDates, "in N days").
   - "COMING UP": upcoming reminders (with time), scheduled dates (weigh-ins, measurement days, recap date) with days remaining.
   - "+ Add reminder" glass button.
4. **Progress**: tiles for Calories and Protein vs targets (if enabled; if no target, show the total only), macro split bar with legend, Gym today (title · duration · volume · PRs), Last night's sleep (+ naps), Supplements taken `x / y`, Water bar, Steps, custom trackers.
5. **Graphs** row (horizontal scroll, snap): Consistency (days so far), Weight (only real weigh-ins; future scheduled dates shown as hollow dots), Calories & protein (7 days, target line dashed), Water & sleep (7 days: water bars + sleep line). Tap → full graph page. "See all" → Stats.
6. **Timeline**: everything logged today in time order with colored dots — wake/sleep, meals (with photo thumbnail, kcal, P, clean), drinks, supplements, workouts (check-in → check-out, PRs), cravings, check-in, weigh-in, notes. Tap → edit.
7. **Calendar**: 24-square grid (6×4) colored by day score intensity (green alpha by score), today outlined, future greyed. Tap → Day view (§6.9).

Before Day 1: header shows "STARTS IN N DAYS" and a **Baseline checklist** card for 25 Oct: weigh-in, measurements, progress photos (front/side/back). After end date: "Challenge complete" and a big "Open recap" button (enabled from recapDate).

### 6.2 Quick Log sheet (+)
Bottom sheet, glass, 3-column grid of big tiles: **Meal, Water, Drink, Supplement, Workout, Cardio, Sleep, Craving, Check-in, Weigh-in, Measurements, Progress photo, Soreness, Steps, Tag day, Note, Reminder**, then custom trackers. Disabled trackers hidden. Sheet opens/closes with a fast spring.

### 6.3 Train
- **Today's session** card: if none → "Start session" (sets checkIn = now; pick gym from list or "+ New gym"; type a title). If active → live timer, gym, title.
- **Active session screen**: list of exercises added. "+ Exercise" → searchable library + "Create exercise" (name, muscle groups multi-select from a fixed list: Chest, Back, Shoulders, Biceps, Triceps, Forearms, Quads, Hamstrings, Glutes, Calves, Abs, Full body, Cardio; kind). For each exercise: set rows with **weight (kg)** and **reps** numeric inputs (large, `inputmode="decimal"`), a ghost line showing **"Last time: 80 × 8, 80 × 7, 75 × 8"** (pure record), "+ Set" duplicates the previous set's numbers for speed, swipe to delete, warm-up toggle. Marking a set done starts the rest timer (if enabled in Settings; it's just a stopwatch the user can dismiss). PR badge appears instantly when a set is a PR.
- **Cardio entry**: exercise, duration, speed, incline, distance, kcal (all optional except duration).
- **Finish**: checkOut = now (editable), rating 1–10 slider, note, shows summary (duration, total volume, sets, PRs).
- **History**: sessions list by day; Exercise detail page: all sets ever, best-set line chart, e1RM chart, PR timeline.
- **Gyms**: list, add/edit (name, equipment list free text chips, optional "Use current location" via Geolocation), session count per gym. **Gym map** (lazy Leaflet) shows gyms with coordinates.

### 6.4 Eat
- Today's meals (cards with photo, label, mode badge, kcal, P/C/F, clean, ≈ if estimated) + "+ Log meal".
- **Food gallery**: grid of all meal photos grouped by day; tap → meal detail.
- **Library**: tabs Foods / Recipes / Drinks / Supplements — add/edit/delete, each food shows its source tag. Barcode scan button on Foods.
- **Water & drinks** summary for today, tap → Water screen.

### 6.5 Log meal — see `design/FoodCooked.dc.html` and `design/FoodBought.dc.html`
Segmented control **Bought | Cooked** at the top (switching keeps photo, label, time).

Common: **Photo (REQUIRED)** — two glass buttons "Camera" (`<input type="file" accept="image/*" capture="environment">`) and "Library" (same without capture). Save stays disabled with label "Add photo to save" until a photo exists. Meal label chips (from settings + "+ Custom"), time (defaults now, editable). Totals card (kcal big, P/C/F tiles), **Clean meal** switch (default on), **Save as recipe / usual** switch (asks name), Note, Save.

**Bought mode:** saved-usual chips row (1 tap fills everything except photo), Where (text), Price + currency, items list "On the plate": each item = name (search user library → reference DB → create new), **estimated grams** with `≈`, source tag; all items `estimated: true`. Totals badge "≈ ESTIMATED".

**Cooked mode:** "Use saved recipe", Cooking method chips, Cook time, Tool. **Ingredients** list: each = name, brand, amount + unit (g/ml), RAW/COOKED tag, source tag, kcal/P/C/F line, note (italic). Separate **Seasoning & oil** group (same fields, `isSeasoning: true`). Header buttons: barcode scan, + Add. **Portion**: whole dish g / I ate g (+ %). Ingredient cost (amount + currency). Totals badge "100% EXACT" (or the exact %).

Adding/editing an item opens a sheet: search box (library first, then reference DB, then "Scan barcode", then "Create from label" — fields per 100 g/ml), amount input with numeric keypad, raw/cooked toggle, brand, note, override nutrition (any value can be overridden; overriding sets source `user`).

### 6.6 Water — see `design/Water.dc.html`
Header "Water · Plain water only". Glass-shaped fill graphic (fill % of target), big `1,800`, `of 3,000 ml`, `1,200 ml left`, "Last drink 42 min ago". **Quick add** buttons from `settings.quickWater` (empty state: "No quick buttons yet — add your glass and bottle sizes in Settings"). Custom amount input (ml) + Add (time = now, tappable to change). "Log another drink" → Drink logger (pick/create drink type with optional nutrition per 100 ml; never counts toward water). By-hour bar chart (06–24). Today's log list (time, ml) with swipe to delete / tap to edit.

### 6.7 Other loggers (sheets)
- **Supplement**: list of library supplements as 1-tap rows (logs default amount + now), long-press/expand to change amount, unit, timing tag; "+ New supplement" (name, brand, default amount, unit, timing tag, daily toggle, optional nutrition per serving).
- **Craving**: what (text + recent chips), strength slider 1–10, outcome Resisted / Ate, time, note.
- **Check-in**: sliders 1–10 for Energy, Mood, Hunger, Stress, Soreness, Day rating + note. One per day (re-open edits).
- **Weigh-in**: kg (1 decimal), time, note. Shows previous weigh-in and difference.
- **Measurements**: one input per settings.bodyParts (cm, 1 decimal), shows previous values beside inputs.
- **Progress photo**: pose selector Front/Side/Back. Custom camera view using `getUserMedia` with the **previous photo of the same pose as a 35% opacity ghost overlay** to line up; capture to canvas. Fallback to file input if camera unavailable.
- **Soreness map**: front + back body outline (simple SVG with tappable regions per muscle group), tap cycles 0→1→2→3 (none / light / medium / high, increasing color intensity).
- **Steps**: number input (manual; a PWA cannot read Apple Health).
- **Tag day**: chips from settings.dayTags + create new.
- **Note**: free text for the day.
- **Reminder**: text + date/time. Shown in "Coming up" and in the timeline at that time; mark done. **No push notifications in v1.**
- **Custom tracker**: toggle or number.

### 6.8 Stats — see `design/Stats.dc.html`
Segmented tabs: **Overview · Body · Train · Food · Sleep**.
- **Overview**: summary tiles (sessions done/expected, weight change, waist change, PRs, avg protein, current streak = consecutive days with score ≥ the user-set "streak threshold" in settings, default 0 = any logged day), Consistency line (all challenge days, y 50–100 gridlines) + mini heatmap, best week / lowest day, **Compare** (correlation scatter: pick X and Y from: sleep h, nap min, energy, mood, hunger, stress, soreness, day rating, water, kcal, protein, carbs, fat, workout volume, workout duration, steps, weight, day score, cravings count; toggle "Y next day"; shows r value and n), **Records** list.
- **Body**: Weight card (start/final/total/per-week; line chart with dots positioned by **real date spacing**, labels on dots, x labels per weigh-in date; under it per-segment bars showing change and per-week rate, so the 10-day last gap is comparable), Measurements card (body outline with callout chips per part showing start → latest and change; list of paired bars Day 0 vs latest with cm and %), Progress photos (grid by date/pose, **compare slider**: drag divider between two photos of the same pose), Soreness history heatmap (muscle × day).
- **Train**: sessions per week bars, session volume line, duration per session, volume by muscle group bars (%), per-exercise strength charts (pick exercise), PR wall, gym check-in times scatter, gyms list/map link.
- **Food**: avg kcal / protein / carbs / fat, daily kcal & protein bars with target lines, stacked macro bars per day, exact vs estimated %, meals logged & clean %, eating window per day (bars), overnight gap, meal timing dots per day, spend per currency (total, per day, cooked vs bought), cravings by time of day + resisted count, water per day vs target line, drinks breakdown by type, supplements calendar (supplement × day dots) + total amount per supplement.
- **Sleep**: night duration bars per day, naps stacked in a second color, averages, bedtime & wake-time charts with ± spread, sleep vs energy quick scatter.
Every chart: tap a point/bar → tooltip with exact value + date; tap again → Day view.

### 6.9 Day view
From calendar / any chart: full day page: score ring + category breakdown with each category's actual vs target, tags, note, timeline (same as Today), meals with photos, workout summary, sleep, water, supplements, cravings, check-in, body entries. Buttons: Edit anything, **Export day card**.

### 6.10 Settings
Sections: Challenge (all dates, name) · Targets (each: enable, value, direction, range max, unit) · Training days (Mon–Sun toggles) · Trackers (enable/disable each) · Consistency score (weights sliders with live % preview, labels ranges editor, streak threshold) · Custom trackers · Quick-add water buttons (create/rename/reorder/delete with ml) · Meal labels · Cooking methods · Supplement units · Timing tags · Body parts · Day tags · Currencies · Sleep night cutoff hour · Rest timer · Backup (Export, Import, last backup time, reminder days) · Data (storage used, persist status) · About (version, dev seed/wipe).

### 6.11 Recap (unlocks on recapDate, also reachable from Stats after endDate)
Full-screen scroll: title "24 days", Day 0 vs Day 24 progress photos (compare slider), weight start → final + change, measurements changes, sessions done, total volume, all PRs, average consistency + heatmap, streak, avg protein, total water, meals logged + clean %, cravings resisted, avg sleep, food photo collage (all meal thumbnails). "Export recap image" (portrait 1080×1920 via html-to-image) and "Export full report" (§8).

---

## 7. Day cards (image export)
From Day view: renders an off-screen 1080×1350 card — date, Day N, score ring, training summary, up to 4 meal photos, kcal/P/C/F, water, sleep, supplements, PRs. Export via `html-to-image` → share sheet (`navigator.share` with file) or download fallback. Glass blur may be replaced by solid translucent fills in export.

## 8. Reports & backup
- **Weekly check-in report** (Stats → Export or Settings → Backup): pick a date range (presets: this week, last week, whole challenge). Produces plain **Markdown text** with per-day lines (score, kcal, P/C/F, water, sleep, workout title/volume/PRs, supplements, cravings, check-in values, weight if any, tags, notes) and range totals/averages. Buttons: Copy, Share. (The user pastes this into Claude for review.)
- **Backup**: export ZIP via jszip → `data.json` (all tables, schema version) + `photos/<blobId>.jpg` (full) + `thumbs/…`. File name `21by21-backup-YYYY-MM-DD-HHmm.zip`. Share via `navigator.share({files})` (iOS saves to Files) or download fallback. Update `lastBackupAt`.
- **Import**: pick zip → validate schema version → confirm "This replaces all data on this phone" → restore all tables + blobs.
- Banner on Today when `now − lastBackupAt > backupReminderDays` (dismissible for the day): "Last backup N days ago · Back up". This is a data-safety notice, allowed.

---

## 9. Integrations

### 9.1 Camera & photos
Photos are compressed client-side (canvas → JPEG) before storing; never store originals. Use `createImageBitmap` with `imageOrientation: 'from-image'` to respect EXIF orientation. Store `takenAt` from file `lastModified` if within 12 h, else now.

### 9.2 Barcode
Scanner screen (lazy `@zxing/browser`) with rear camera, EAN-13/EAN-8/UPC. On hit → fetch `https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=product_name,brands,nutriments,serving_size`. Map `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `fiber_100g`, `sugars_100g`, `sodium_100g`. Show a confirm form prefilled (everything editable) → save to `foods` with source `barcode`. If not found / offline → "Not found — enter from label" form with the barcode prefilled, source `label`. A barcode already in the library is matched locally first (works offline).

### 9.3 Geolocation
Only on explicit tap "Use current location" when editing a gym.

### 9.4 Reference food database (bundled, read-only)
Create `public/fooddb/reference.json` (lazy-fetched, cached by the service worker) with **~200 items**, per 100 g (or 100 ml for liquids), fields `{id, name, aliases[], basis, per100, state, source}`:
- **Raw/fresh basics (source `usda`)**: chicken breast/thigh (raw & cooked), lean beef, beef mince variants, fish (tilapia, salmon, mackerel, tuna canned), shrimp, squid, tofu, tempeh, eggs (whole, white), rice (white/brown raw & cooked), noodles, potato, sweet potato, cassava, corn, common vegetables (broccoli, spinach, kangkung, long beans, cabbage, carrot, cucumber, tomato, bok choy, mushrooms), fruits (banana, apple, papaya, watermelon, mango, guava, orange), oils (olive, palm, coconut — per 100 ml), butter, peanut butter, nuts, milk, yogurt, whey (generic), oats, bread, common sauces (soy, kecap manis, oyster, chili sauce, sambal), salt, sugar, garlic, shallot, chili, ginger, lime.
- **Indonesian dishes (source `tkpi`)**: nasi putih, ayam bakar, ayam goreng, ayam penyet, rendang, gulai ayam, soto ayam, sop buntut, gado-gado, pecel, nasi goreng, mie goreng, bakso, sate ayam, sate kambing, ikan bakar, pepes ikan, tempe goreng, tahu goreng, tumis kangkung, sayur asem, sayur lodeh, cap cay, opor ayam, telur balado, lalapan, sambal (ijo/merah), nasi uduk, nasi liwet, timlo, selat solo, gudeg.
- **Malaysian dishes (source `myfcd`)**: nasi lemak (plain + components), nasi kerabu, nasi campur components, roti canai, chicken rice (rice + chicken separately), mee goreng mamak, char kway teow, laksa, ayam percik, ikan bakar, sayur campur, teh tarik, kopi O.
Use your best knowledge of published USDA FoodData Central / TKPI (Tabel Komposisi Pangan Indonesia) / MyFCD values; mark the file header with `"note": "approximate reference values; user can override any number"`. Every item picked is copied into the user library so the user can correct it.

---

## 10. PWA / iOS specifics
- `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `theme-color=#000000`, `apple-touch-icon` 180px, app title "21 by 21".
- Manifest: name "21 by 21", short_name "21by21", display `standalone`, background `#000000`, theme `#000000`, `start_url: "./"`, `scope: "./"`, icons incl. maskable. Simple original icon: black background, bold white "21" with a thin green ring.
- Vite `base: './'` so the app works on any GitHub Pages repo path. HashRouter.
- Service worker: precache app shell; runtime cache `fooddb/*` (CacheFirst) and OpenStreetMap tiles (StaleWhileRevalidate, max 200 entries). Offline must fully work for everything except barcode lookup and map tiles.
- Prevent iOS input zoom: all inputs `font-size: 16px` minimum.
- Disable pull-to-refresh bounce issues: `overscroll-behavior: none` on body; scroll inside `main`.
- Numeric inputs: `inputmode="decimal"` (weights/kg/ml) or `"numeric"` (reps, steps).
- No vibration/haptics (not supported in iOS PWAs).
- On launch call `navigator.storage.persist()`; show persist status in Settings → Data.

## 11. Deployment
- `.github/workflows/deploy.yml`: on push to `main` → `npm ci` → `npm run test` → `npm run build` → deploy `dist/` with `actions/upload-pages-artifact` + `actions/deploy-pages`.
- README.md: how to run locally (`npm i`, `npm run dev -- --host` to open on the phone over Wi-Fi), how to enable GitHub Pages (Settings → Pages → Source: GitHub Actions), how to install on iPhone, how to back up.

---

## 12. Accessibility & quality
- Real `<button>`, `<a>`, `<input>` + `<label>` everywhere; icon-only buttons have `aria-label`.
- Text contrast ≥ 4.5:1 (use `#8E8E93` minimum for secondary text on black, never darker).
- Charts have `role="img"` + `aria-label` summary.
- `prefers-reduced-motion`: disable springs, use opacity fades only.
- Every destructive action (delete meal, delete workout, wipe) has a confirm or undo toast.
- No emoji in UI; icons are inline stroke SVG (24px grid, 1.8–2px stroke, round caps).

---

## 13. Build order (do all of it, in this order)
1. Scaffold Vite + React + TS, PWA plugin, router, tokens/glass CSS, tab bar with raised **+**, Sheet/Toast/Glass components.
2. Dexie schema + types + defaults + first-run.
3. `logic/` modules + vitest tests (dates, nutrition, score, todo, prs, stats, sleep attribution) — tests must pass.
4. Sleep flow (Nap/Night → Wake Up lock screen → confirm) — it gates the whole app, so build it early.
5. Water + drinks, supplements, quick log sheet.
6. Meal logging (both modes, photo required, items sheet, library, reference DB, barcode).
7. Train (sessions, sets, last-time ghost, PRs, cardio, gyms, rest timer).
8. Body loggers (weigh-in, measurements, progress photo camera with ghost, soreness map), cravings, check-in, steps, tags, notes, reminders, custom trackers.
9. Today screen (all 7 sections) + Day view + Search.
10. Charts library + Stats (all 5 tabs) + Compare.
11. Recap, day card export, weekly report, backup/import.
12. Settings (every section).
13. Dev seed data, README, deploy workflow, `DECISIONS.md`.

## 14. Acceptance checklist (verify every line before finishing)
- [ ] `npm run build` succeeds with zero TS errors; `npm run test` all green.
- [ ] Initial gzipped JS < 200 KB (print sizes from the build output in DECISIONS.md).
- [ ] App works fully offline after first load (except barcode lookup + map tiles).
- [ ] A meal cannot be saved without a photo, in both modes.
- [ ] Bought items show `≈` everywhere; exact vs estimated % is correct.
- [ ] Only plain water fills the 3,000 ml water target; other drinks don't.
- [ ] Night sleep started at 01:30 on 2 Nov is attributed to 1 Nov; a nap at 14:00 on 2 Nov to 2 Nov.
- [ ] While a sleep is active, every launch shows only the Wake Up screen.
- [ ] Weight chart spaces dots by real dates (25 Oct, 1 Nov, 8 Nov, 18 Nov) and shows per-week rate per segment.
- [ ] Measurements compare 25 Oct vs 18 Nov with cm and %.
- [ ] Consistency score uses only enabled targets and user weights; non-training days don't penalise training.
- [ ] No screen contains advice, suggestions, prescriptions or motivational copy.
- [ ] All lists/targets/labels editable in Settings; quick-add water starts empty.
- [ ] Backup zip export → wipe → import restores everything including photos.
- [ ] dayKey stays correct after changing the phone's timezone (logged entries don't move).
- [ ] Layout correct at 375–430px widths, with notch/home-indicator safe areas.

---

## 15. Design system

Feel: **Apple-native, dark mode only, light and fast.** System font, iOS spacing, frosted **glass** buttons and cards over a black background with a few very soft colored glows behind content so the glass is visible.

### 15.1 Color tokens (`tokens.css`)
```css
:root{
  --bg:#000000;
  --text:#F5F5F7;
  --text-2:#8E8E93;        /* secondary (minimum contrast allowed) */
  --text-3:#AEAEB2;        /* inactive tab labels, light secondary */
  --hairline:rgba(255,255,255,0.08);
  --green:#30D158;  /* consistency, protein, primary accent, + button */
  --blue:#0A84FF;   /* water */
  --cyan:#64D2FF;   /* supplements, database tag */
  --orange:#FF9F0A; /* food, calories, carbs */
  --yellow:#FFD60A; /* fat, PRs, reminders */
  --red:#FF375F;    /* training, cravings */
  --purple:#BF5AF2; /* sleep */
  --purple-light:#D99CFF;
  --surface-solid:#1C1C1E; /* photo placeholders */
}
```
Category → color: Training red, Food orange, Water blue, Sleep purple, Supplements cyan, Protein green, Carbs orange, Fat yellow, PRs yellow, Consistency green.

### 15.2 Glass (`glass.css`)
```css
.glass{ /* cards */
  background:rgba(255,255,255,0.065);
  -webkit-backdrop-filter:blur(28px) saturate(180%); backdrop-filter:blur(28px) saturate(180%);
  border:1px solid rgba(255,255,255,0.12);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.16),0 10px 30px rgba(0,0,0,0.35);
}
.glass-btn{ /* buttons, chips, tab bar, inputs */
  background:rgba(255,255,255,0.10);
  -webkit-backdrop-filter:blur(20px) saturate(200%); backdrop-filter:blur(20px) saturate(200%);
  border:1px solid rgba(255,255,255,0.18);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.32),inset 0 -1px 0 rgba(255,255,255,0.05),0 6px 18px rgba(0,0,0,0.4);
}
.glass-btn:active{ transform:scale(0.96); background:rgba(255,255,255,0.16); }
```
Tinted glass (primary actions): same as `.glass-btn` with background = accent at 0.28–0.55 alpha (e.g. Save meal `rgba(255,159,10,0.32)`, Water Add `rgba(10,132,255,0.45)`, + button `rgba(48,209,88,0.55)`).
**Background glows**: 2–3 absolutely positioned circles per screen (280–380px, accent color, opacity 0.14–0.30, `filter: blur(90–110px)`), placed behind content, using the screen's main category color. Keep them static (no animation) for performance.

### 15.3 Type & shape
- Font: `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`; `-webkit-font-smoothing: antialiased`; numbers `font-variant-numeric: tabular-nums`.
- Sizes: Large title 34/700/−0.6px · Section title 22/700/−0.3px · Card title 20/700 · Body 15–17 · Caption labels 11–13/600 UPPERCASE in `--text-2` with 0.2–0.3px tracking · Big numbers 26–44/700/−0.5 to −1px · Wake Up timer 64/700/−2px.
- Radii: cards 24–28px, tiles 18–22px, inner rows 16–18px, pills 999px, small tags 5–6px.
- Spacing: screen padding 16px, gap between cards 14–16px, card padding 16–20px.
- Rings: stroke 12px (big, r=56), 5px (small, r=20), round caps, track = color at 0.18–0.22 alpha, start at 12 o'clock.
- Bars: 6–10px tall, radius = half height, track `rgba(255,255,255,0.06)` or color at 0.2 alpha.
- Switches: iOS style 51×31, on = green.

### 15.4 Motion
Fast and light: springs `stiffness 500, damping 38` for sheets/tab content; taps scale to 0.96 in 80 ms; list item enter = 120 ms fade+4px rise; ring/bar fills animate 300 ms ease-out on first render only. Never animate background glows or blur values. Respect reduced motion.

### 15.5 Tab bar
Floating glass pill: left/right 16px, bottom 28px + safe area, height 68px, radius 34px, 5-column grid: Today, Train, (empty center slot), Eat, Stats. Active tab green, inactive `--text-3`, label 11/600 under a 22px icon. **Center + button**: 68px circle, centered horizontally, top −26px (raised half above the bar), tinted green glass, white 28px plus icon, `box-shadow: 0 0 0 7px #000, inset 0 1px 0 rgba(255,255,255,0.45), 0 10px 24px rgba(48,209,88,0.35)` (the black ring creates the notch look).

---

## 16. Design reference files (`design/`)
Six approved screens, shown with **sample data** (not real numbers):
- `Main.dc.html` — Today (shown on Day 8)
- `Stats.dc.html` — Stats Overview content incl. Body/Train/Food/Sleep cards (shown on Day 24)
- `FoodCooked.dc.html` — Log meal, Cooked mode
- `FoodBought.dc.html` — Log meal, Bought mode
- `Sleep.dc.html` — Wake Up lock screen
- `Water.dc.html` — Water screen

They use a design-tool wrapper format (`<x-dc>`, `<helmet>`, a `data-dc-script` block). **Ignore the wrapper; read them as plain HTML with inline styles** — they are the source of truth for layout, spacing, colors, glass, and copy tone. Match them closely. Screens not drawn (Train, Eat, Settings, Recap, loggers, Day view, Search) must follow the same visual language.
