import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Btn, Card, Cap, IconBtn, Page, PhotoBox, Ring } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Timeline } from '../../components/Timeline';
import { useData } from '../../hooks/useData';
import { useDay } from '../../hooks/useAnalysis';
import { useLogger } from '../../hooks/useLogger';
import { useBlobUrl } from '../../db/photos';
import { addDays, challengeDay, fmtTime } from '../../logic/dates';
import { fmt1, fmtDayLong, fmtDuration, fmtInt, fmtMacro } from '../../logic/format';
import { MealCard } from '../eat/MealCard';
import { ExportImageSheet } from '../../components/ExportImageSheet';
import { DayCard } from '../../components/ShareCards';
import { useDataUrls } from '../../lib/exportImage';
import { prCountForWorkout } from '../../logic/prs';
import { SessionRow } from '../train/bits';
import type { CatScore } from '../../logic/score';
import type { DayAgg } from '../../logic/aggregate';
import type { Settings, Target } from '../../db/types';
import { C, catColor } from '../../theme';

const NAMES: Record<string, string> = { water: 'Water', calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', food: 'Clean meals', training: 'Training', sleep: 'Night sleep', supplements: 'Supplements', checkin: 'Check-in', steps: 'Steps' };
const dirSym = (t: Target) => (t.direction === 'atLeast' ? '≥' : t.direction === 'atMost' ? '≤' : `${fmtInt(t.value)}–`);
const tgt = (t: Target, unit: string, v = t.value) => `${t.direction === 'range' ? `${fmtInt(t.value)}–${fmtInt(t.rangeMax ?? t.value)}` : `${dirSym(t)}${fmtInt(v)}`} ${unit}`;

/** one line per scoring category: what was logged vs the user's own target */
function describe(c: CatScore, a: DayAgg, s: Settings): { name: string; text: string } {
  const t = s.targets;
  const custom = c.cat.startsWith('custom:') ? s.customTrackers.find((x) => `custom:${x.id}` === c.cat) : undefined;
  const name = custom?.name ?? NAMES[c.cat] ?? c.cat;
  switch (c.cat) {
    case 'water': return { name, text: `${fmtInt(c.actual ?? 0)} ml · target ${tgt(t.water, 'ml')}` };
    case 'calories': return { name, text: `${fmtInt(c.actual ?? 0)} kcal · target ${tgt(t.calories, 'kcal')}` };
    case 'protein': return { name, text: `${fmtMacro(c.actual ?? 0)} g · target ${tgt(t.protein, 'g')}` };
    case 'carbs': return { name, text: `${fmtMacro(c.actual ?? 0)} g · target ${tgt(t.carbs, 'g')}` };
    case 'fat': return { name, text: `${fmtMacro(c.actual ?? 0)} g · target ${tgt(t.fat, 'g')}` };
    case 'food': return { name, text: `${a.cleanMeals} clean of ${a.mealsLogged} · expected ${tgt(t.mealsPerDay, 'meals')}` };
    case 'training': return { name, text: a.hasWorkout ? 'Session logged' : 'No session logged' };
    case 'sleep': return { name, text: `${fmtDuration((c.actual ?? 0) * 60)} · target ${tgt(t.sleep, 'h')}` };
    case 'supplements': return { name, text: `${a.suppDailyLogged} of ${a.suppDailyTotal} daily logged` };
    case 'checkin': return { name, text: a.checkin ? 'Saved' : 'Not saved' };
    case 'steps': return { name, text: `${fmtInt(c.actual ?? 0)} · target ${tgt(t.steps, '')}` };
    default: {
      const v = a.custom[custom?.id ?? ''];
      return { name, text: v === undefined ? 'Not logged' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : `${v}${custom?.unit ? ` ${custom.unit}` : ''}${custom?.target?.enabled ? ` · target ${tgt(custom.target, custom.unit ?? '')}` : ''}` };
    }
  }
}

function PhotoThumb({ blobId, label }: { blobId: string; label: string }) {
  const url = useBlobUrl(blobId, 'thumb');
  return <PhotoBox url={url} ratio="3 / 4" radius={12} label={label} />;
}

export default function DayView() {
  const { dayKey = '' } = useParams();
  const nav = useNavigate();
  const d = useData();
  const { open, quick } = useLogger();
  const { agg, score, an } = useDay(dayKey);
  const { settings } = d;
  const no = challengeDay(dayKey, settings.challenge);
  const sub = no === 0 ? 'Day 0 · baseline' : no != null ? `Day ${no} of ${an.cdays.length}` : undefined;
  const tags = d.dayTags.find((t) => t.dayKey === dayKey)?.tags ?? [];
  const note = d.dayNotes.find((n) => n.dayKey === dayKey)?.text;
  const meas = d.measurements.find((m) => m.dayKey === dayKey);
  const photos = d.progressPhotos.filter((p) => p.dayKey === dayKey);
  const sore = d.soreness.find((s) => s.dayKey === dayKey);
  const s = score.score;
  const [exporting, setExporting] = useState(false);
  const mealPhotoIds = agg.meals.slice(0, 4).map((m) => m.photoId);
  const urls = useDataUrls(exporting ? mealPhotoIds : [], 'thumb');
  const prCount = agg.workouts.reduce((a, w) => a + prCountForWorkout(an.prs, w.id), 0);
  const exNames = [...new Set(agg.workouts.flatMap((w) => w.sets.filter((x) => x.doneAt).map((x) => x.exerciseId)))].map((id) => d.exercises.find((e) => e.id === id)?.name ?? '');
  const prev = addDays(dayKey, -1), next = addDays(dayKey, 1);
  const inRange = (k: string) => k >= settings.challenge.baselineDate && k <= settings.challenge.recapDate && k <= d.today;

  return (
    <Page title={fmtDayLong(dayKey)} sub={sub} glows={[{ color: C.green, top: -60, left: -90, size: 300, opacity: 0.2 }, { color: C.blue, top: 700, right: -120, opacity: 0.14 }]}
      right={<IconBtn icon="plus" label="Log something for this day" onClick={() => quick(dayKey)} />}>
      <div className="row between">
        <Btn sm disabled={!inRange(prev)} onClick={() => nav(`/day/${prev}`, { replace: true })}><Icon name="back" size={16} />Prev</Btn>
        <Btn sm disabled={!inRange(next)} onClick={() => nav(`/day/${next}`, { replace: true })}>Next<Icon name="next" size={16} /></Btn>
      </div>

      <Card lg>
        <div className="row g20" style={{ gap: 18 }}>
          <Ring size={96} r={40} stroke={9} value={(s ?? 0) / 100} color={C.green} label={`Day score ${s != null ? Math.round(s) : 'none'}`}>
            <span className="num" style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>{s != null ? Math.round(s) : '—'}</span>
          </Ring>
          <div className="stack g4"><Cap>Day score</Cap><div className="t-13 muted">Computed from what was logged against the targets you set.</div></div>
        </div>
        {score.cats.length === 0 && <div className="muted t-13">No targets or trackers apply to this day.</div>}
        <div className="stack g12">
          {score.cats.map((c) => {
            const { name, text } = describe(c, agg, settings);
            return (
              <div key={c.cat} className="stack g4">
                <div className="row between t-15"><span className="b600">{name}</span><span className="num t-13 muted">{Math.round(c.score * 100)}</span></div>
                <div className="bar" style={{ background: `${catColor(c.cat)}33` }}><i style={{ width: `${c.score * 100}%`, background: catColor(c.cat) }} /></div>
                <div className="num t-12 muted">{text}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="row between"><Cap>Tags &amp; note</Cap><div className="row g8"><Btn sm onClick={() => open('tag', { dayKey })}>{tags.length ? 'Edit tags' : 'Tag day'}</Btn><Btn sm onClick={() => open('note', { dayKey })}>{note ? 'Edit note' : 'Add note'}</Btn></div></div>
        {tags.length > 0 && <div className="row wrap g8">{tags.map((t) => <span key={t} className="tag l" style={{ color: C.purpleLight, background: 'rgba(191,90,242,0.2)', fontSize: 12, padding: '4px 9px' }}>{t}</span>)}</div>}
        {note && <div className="pre t-15">{note}</div>}
        {!tags.length && !note && <div className="muted t-13">No tags or note</div>}
      </Card>

      <Card lg>
        <h2 className="t-sec">Timeline</h2>
        <Timeline day={dayKey} empty="Nothing logged this day" />
      </Card>

      {agg.meals.length > 0 && <section className="stack g10"><h2 className="t-sec" style={{ margin: '4px 4px 0' }}>Meals</h2>{agg.meals.map((m) => <MealCard key={m.id} meal={m} />)}</section>}

      {agg.workouts.length > 0 && (
        <Card className="flat" style={{ padding: '8px 16px' }}>
          <Cap style={{ paddingTop: 8 }}>Training</Cap>
          {agg.workouts.map((w) => <SessionRow key={w.id} w={w} prs={an.prs} gyms={d.gyms} />)}
        </Card>
      )}

      {(agg.checkin || agg.steps != null || agg.weighIn || meas || photos.length > 0 || sore || agg.cravings.length > 0) && (
        <Card>
          <h2 className="t-card">Other entries</h2>
          {agg.checkin && <div className="num t-15">Check-in · energy {agg.checkin.energy} · mood {agg.checkin.mood} · hunger {agg.checkin.hunger} · stress {agg.checkin.stress} · soreness {agg.checkin.soreness} · day {agg.checkin.dayRating}{agg.checkin.note ? ` — “${agg.checkin.note}”` : ''}</div>}
          {agg.steps != null && <div className="num t-15">Steps · {fmtInt(agg.steps)}</div>}
          {agg.weighIn && <div className="num t-15">Weight · {fmt1(agg.weighIn.kg)} kg at {fmtTime(agg.weighIn.time, agg.weighIn.tzOffsetMin)}</div>}
          {meas && <button type="button" className="t-15 link" style={{ padding: 0, minHeight: 32 }} onClick={() => open('measurements', { dayKey })}>Measurements · {Object.keys(meas.values).length} values ›</button>}
          {sore && <button type="button" className="t-15 link" style={{ padding: 0, minHeight: 32 }} onClick={() => open('soreness', { dayKey })}>Soreness · {Object.entries(sore.muscles).filter(([, v]) => v > 0).map(([m, v]) => `${m} ${v}`).join(', ') || 'none'} ›</button>}
          {photos.length > 0 && <div className="grid3">{photos.map((p) => <PhotoThumb key={p.id} blobId={p.blobId} label={p.pose} />)}</div>}
        </Card>
      )}

      <div className="grid2">
        <Btn onClick={() => nav(`/water?day=${dayKey}`)}><Icon name="drop" size={18} />Water</Btn>
        <Btn onClick={() => nav(`/log/meal?day=${dayKey}`)}><Icon name="eat" size={18} />Add meal</Btn>
      </div>
      <Btn onClick={() => setExporting(true)}><Icon name="share" size={18} />Export day card</Btn>
      <ExportImageSheet open={exporting} onClose={() => setExporting(false)} title="Day card" width={1080} height={1350} fileName={`21by21-${dayKey}.png`} ready={urls != null}>
        <DayCard day={dayKey} dayNo={no} len={an.cdays.length} score={s} agg={agg} prCount={prCount} photos={mealPhotoIds.map((id) => urls?.[id] ?? '')} mealLabels={agg.meals.slice(0, 4).map((m) => m.label)} exerciseNames={exNames} />
      </ExportImageSheet>
    </Page>
  );
}
