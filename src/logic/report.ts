import type { Exercise } from '../db/types';
import type { DayAgg, Slice } from './aggregate';
import { aggregateDays } from './aggregate';
import { scoreDay } from './score';
import type { DayScore } from './score';
import { computePRs, prCountForWorkout } from './prs';
import { challengeDay, dayRange, fmtTime } from './dates';
import { fmtDayWd, fmtDuration, fmtInt, fmt1, fmtMacro } from './format';
import { defined, mean, sum } from './stats';

/** Plain Markdown for the weekly check-in report (PLAN §8). Facts only, no advice. */
export function buildReport(d: Slice & { exercises: Exercise[] }, from: string, to: string, today: string): string {
  const keys = dayRange(from, to);
  const aggs = aggregateDays(d, keys);
  const scores: Record<string, DayScore> = {};
  for (const k of keys) scores[k] = scoreDay(aggs[k], d.settings, today);
  const prs = computePRs(d.workouts);
  const exName = (id: string) => d.exercises.find((e) => e.id === id)?.name ?? 'Exercise';
  const sleepHours = (a: DayAgg) => (a.nightMin != null ? fmtDuration(a.nightMin) : '—');
  const lines: string[] = [`# ${d.settings.challenge.name} — ${fmtDayWd(from)} to ${fmtDayWd(to)}`, ''];

  const logged = keys.filter((k) => aggs[k].anyLog);
  const withFood = keys.filter((k) => aggs[k].mealsLogged > 0);
  const avg = (xs: (number | null | undefined)[]) => { const m = mean(defined(xs)); return m == null ? '—' : fmtInt(m); };
  lines.push('## Range summary');
  lines.push(`- Days with any log: ${logged.length} of ${keys.length}`);
  lines.push(`- Average day score: ${avg(keys.map((k) => scores[k].score))}`);
  lines.push(`- Average kcal: ${avg(withFood.map((k) => aggs[k].nutrition.total.kcal))} · protein ${avg(withFood.map((k) => aggs[k].nutrition.total.protein))} g · carbs ${avg(withFood.map((k) => aggs[k].nutrition.total.carbs))} g · fat ${avg(withFood.map((k) => aggs[k].nutrition.total.fat))} g`);
  lines.push(`- Total water: ${fmtInt(sum(keys.map((k) => aggs[k].nutrition.waterMl)))} ml · average ${avg(keys.map((k) => aggs[k].nutrition.waterMl))} ml/day`);
  lines.push(`- Average night sleep: ${avg(keys.map((k) => aggs[k].nightMin))} min`);
  lines.push(`- Sessions: ${sum(keys.map((k) => aggs[k].workouts.filter((w) => w.sets.some((s) => s.doneAt) || w.cardio.length).length))} · total volume ${fmtInt(sum(keys.map((k) => aggs[k].volumeKg)))} kg`);
  lines.push(`- Meals logged: ${sum(keys.map((k) => aggs[k].mealsLogged))} (clean ${sum(keys.map((k) => aggs[k].cleanMeals))})`);
  lines.push(`- Cravings: ${sum(keys.map((k) => aggs[k].cravings.length))} (resisted ${sum(keys.map((k) => aggs[k].cravings.filter((c) => c.outcome === 'resisted').length))})`);
  lines.push('', '## Days');

  for (const k of keys) {
    const a = aggs[k];
    const cd = challengeDay(k, d.settings.challenge);
    const head = `**${fmtDayWd(k)}${cd != null ? ` (Day ${cd})` : ''}**`;
    if (!a.anyLog) { lines.push(`${head} — nothing logged`); continue; }
    const parts: string[] = [];
    if (scores[k].score != null) parts.push(`score ${Math.round(scores[k].score!)}`);
    if (a.mealsLogged) {
      const n = a.nutrition.total;
      parts.push(`${fmtInt(n.kcal)} kcal, P ${fmtMacro(n.protein)} / C ${fmtMacro(n.carbs)} / F ${fmtMacro(n.fat)} g (${a.mealsLogged} meals, ${a.cleanMeals} clean${a.exactPct != null ? `, ${Math.round(a.exactPct)}% exact` : ''})`);
    }
    parts.push(`water ${fmtInt(a.nutrition.waterMl)} ml`);
    if (a.nightMin != null || a.napMin) parts.push(`sleep ${sleepHours(a)}${a.napMin ? ` + nap ${fmtDuration(a.napMin)}` : ''}`);
    for (const w of a.workouts) {
      const n = prCountForWorkout(prs, w.id);
      const ex = [...new Set(w.sets.filter((s) => s.doneAt).map((s) => exName(s.exerciseId)))].join(', ');
      parts.push(`gym ${w.title || 'session'} ${fmtTime(w.checkIn, w.tzOffsetMin)}${w.checkOut ? `–${fmtTime(w.checkOut, w.tzOffsetMin)}` : ''}, ${fmtInt(a.volumeKg)} kg volume${n ? `, ${n} PR` : ''}${ex ? ` [${ex}]` : ''}`);
    }
    if (a.supplementLogs.length) parts.push(`supplements ${a.supplementLogs.map((s) => `${s.name} ${fmt1(s.amount)} ${s.unit}`).join(', ')}`);
    if (a.cravings.length) parts.push(`cravings ${a.cravings.map((c) => `${c.what} ${c.strength}/10 ${c.outcome}`).join('; ')}`);
    if (a.checkin) { const c = a.checkin; parts.push(`check-in energy ${c.energy}, mood ${c.mood}, hunger ${c.hunger}, stress ${c.stress}, soreness ${c.soreness}, day ${c.dayRating}${c.note ? ` — “${c.note}”` : ''}`); }
    if (a.steps != null) parts.push(`steps ${fmtInt(a.steps)}`);
    if (a.weighIn) parts.push(`weight ${fmt1(a.weighIn.kg)} kg`);
    const tags = d.dayTags.find((t) => t.dayKey === k)?.tags;
    if (tags?.length) parts.push(`tags ${tags.join(', ')}`);
    const note = d.dayNotes.find((n) => n.dayKey === k)?.text;
    if (note) parts.push(`note “${note}”`);
    lines.push(`${head} — ${parts.join(' · ')}`);
  }
  return lines.join('\n');
}
