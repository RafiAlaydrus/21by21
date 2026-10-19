# DECISIONS.md

Choices made where PLAN.md was silent (or ambiguous), plus the final acceptance checklist.

## Decisions

### Logic
- **Days left** = whole days after today until the end date (Day 8 of 24 → 16), matching `design/Main.dc.html`. Before the start it is the full length (24).
- **Sleep in the score**: a night sleep is attributed to a day by the 12:00 cut-off (01:30 on 2 Nov → 1 Nov). Sleep therefore participates for a day when that day is in the past, or when a night sleep is already attributed to it. *Today* with no night sleep logged yet is excluded (not scored as 0), so the live score isn't dragged down all day.
- **Score categories** also include `carbs` and `fat` (PLAN §5.4 says "carbs/fat if the user enables them as targets" but omits them from the `ScoreCategory` type).
- A target only participates when enabled **and** its value is > 0. Numeric custom trackers without a target of their own are not scored.
- **Streak**: consecutive days ending today; today still in progress does not break the run. Threshold 0 = any logged day (any table).
- **PRs**: the first time an exercise is ever done is the baseline, not a PR. A set only counts once marked **done**; warm-ups never count. "n PRs" in a session = number of distinct exercises that set at least one record (a single heavy set often beats several metrics at once).
- Workout **volume** counts done, non-warm-up sets only.
- **Standard deviation** (bedtime/wake spread) is the population SD.
- Challenge **weeks** for Stats are 7-day buckets counted from Day 1 (Day 1 is a Monday, so they equal Mon–Sun weeks); the last bucket may be partial ("Wk 4 (3 d)").
- Times are displayed in the wall-clock of the offset they were **logged** in (`tzOffsetMin` stored on every record), not the phone's current zone.

### UI / platform
- Tab bar bottom offset is `max(28px, safe-area-bottom − 6px)`, which equals the design's 28px on iPhones with a home indicator (PLAN says "28px + safe area", which would float 62px high).
- Motion is used via `LazyMotion` + `m` (domAnimation features only) to keep the initial bundle small.
- Records that exist once per day (check-in, steps, soreness, day tags, day notes, custom logs) use deterministic ids such as `checkin:2026-11-02`, so "re-open edits" is an upsert.
