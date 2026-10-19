import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Btn, Card, Page, Segmented } from '../../components/ui';
import { ExportImageSheet } from '../../components/ExportImageSheet';
import { PhotoCompare } from '../../components/PhotoCompare';
import { RecapCard } from '../../components/ShareCards';
import { CellGrid, greenCell } from '../../charts/bits';
import { useData } from '../../hooks/useData';
import { useAnalysis } from '../../hooks/useAnalysis';
import { useBlobUrl } from '../../db/photos';
import { useDataUrls } from '../../lib/exportImage';
import { defined, mean, sum } from '../../logic/stats';
import { fmt1, fmtDay, fmtDayWd, fmtDuration, fmtInt, fmtMacro, signed } from '../../logic/format';
import { workoutHasWork, workoutVolume } from '../../logic/aggregate';
import { PR_LABEL } from '../../logic/prs';
import { exName } from '../train/bits';
import { prValue } from '../train/PRWall';
import { challengeLength } from '../../logic/dates';
import { C } from '../../theme';

function Collage({ id, onClick }: { id: string; onClick: () => void }) {
  const url = useBlobUrl(id, 'thumb');
  return <button type="button" className="photo-ph" style={{ aspectRatio: '1', borderRadius: 8 }} aria-label="Meal photo" onClick={onClick}>{url && <img src={url} alt="" />}</button>;
}

export default function Recap() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const d = useData();
  const an = useAnalysis();
  const c = d.settings.challenge;
  const len = challengeLength(c);
  const [preview, setPreview] = useState(sp.get('preview') === '1');
  const [pose, setPose] = useState<'front' | 'side' | 'back'>('front');
  const [exporting, setExporting] = useState(false);
  const locked = d.today < c.recapDate && !preview;

  const days = an.cdays.filter((k) => k <= d.today);
  const A = (k: string) => an.aggs[k];
  const stats = useMemo(() => {
    const weigh = [...d.weighIns].sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.time - b.time);
    const w0 = weigh[0], w1 = weigh.at(-1);
    const meas = [...d.measurements].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    const m0 = meas[0], m1 = meas.length > 1 ? meas.at(-1) : undefined;
    const parts = m0 && m1 ? d.settings.bodyParts.filter((b) => m0.values[b.id] != null && m1.values[b.id] != null).map((b) => ({ name: b.name, a: m0.values[b.id], b: m1.values[b.id] })) : [];
    const done = d.workouts.filter((w) => w.dayKey >= c.startDate && w.dayKey <= c.endDate && workoutHasWork(w));
    const meals = days.flatMap((k) => A(k).meals);
    const craves = days.flatMap((k) => A(k).cravings);
    const scores = defined(days.map((k) => an.scores[k]?.score));
    const prCount = new Set(an.prs.map((p) => `${p.workoutId}:${p.exerciseId}`)).size;
    return {
      w0, w1, parts, sessions: done.length, volume: sum(done.map(workoutVolume)), prCount, avgScore: mean(scores),
      protein: mean(defined(days.filter((k) => A(k).mealsLogged).map((k) => A(k).nutrition.total.protein))), water: sum(days.map((k) => A(k).nutrition.waterMl)),
      meals: meals.length, clean: meals.filter((m) => m.clean).length, resisted: craves.filter((x) => x.outcome === 'resisted').length, craves: craves.length,
      sleep: mean(defined(days.map((k) => A(k).nightMin))), mealPhotos: [...meals].sort((a, b) => a.time - b.time).map((m) => m.photoId),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, an]);

  const shots = d.progressPhotos.filter((p) => p.pose === pose).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const before = shots[0], after = shots.length > 1 ? shots.at(-1) : undefined;
  const front = d.progressPhotos.filter((p) => p.pose === 'front').sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const exportIds = [front[0]?.blobId, front.length > 1 ? front.at(-1)?.blobId : undefined].filter(Boolean) as string[];
  const fullUrls = useDataUrls(exporting ? exportIds : [], 'full');
  const collageIds = stats.mealPhotos.slice(0, 32);
  const thumbUrls = useDataUrls(exporting ? collageIds : [], 'thumb');
  const wDelta = stats.w0 && stats.w1 && stats.w0 !== stats.w1 ? stats.w1.kg - stats.w0.kg : null;
  const waist = stats.parts.find((p) => /waist/i.test(p.name));

  const tiles: [string, string, string?][] = [
    ['Sessions', String(stats.sessions), C.red], ['Total volume', `${fmtInt(stats.volume)} kg`], ['PRs', String(stats.prCount), C.yellow],
    ['Avg consistency', stats.avgScore != null ? String(Math.round(stats.avgScore)) : '—', C.green], ['Streak', `${an.streak} d`], ['Avg protein', stats.protein != null ? `${fmtMacro(stats.protein)} g` : '—', C.green],
    ['Total water', `${fmtInt(stats.water)} ml`, C.blue], ['Meals', `${stats.meals} · ${stats.meals ? Math.round((stats.clean / stats.meals) * 100) : 0}% clean`, C.orange], ['Cravings resisted', `${stats.resisted} of ${stats.craves}`],
    ['Avg sleep', stats.sleep != null ? fmtDuration(stats.sleep) : '—', C.purple],
  ];

  if (locked) return (
    <Page title="Recap" glows={[{ color: C.green, top: -40, left: -100, opacity: 0.2 }]}>
      <Card lg><h2 className="t-card">Opens {fmtDayWd(c.recapDate)}</h2><div className="t-13 muted">The recap collects the whole challenge in one place.</div><Btn onClick={() => setPreview(true)}>Preview with the data so far</Btn></Card>
    </Page>
  );

  return (
    <Page title="Recap" sub={`${fmtDay(c.startDate, 'd MMM')} – ${fmtDay(c.endDate, 'd MMM')}`} glows={[{ color: C.green, top: -60, left: -100, size: 320, opacity: 0.22 }, { color: C.purple, top: 1100, right: -120, opacity: 0.16 }]}>
      <h1 className="t-large" style={{ fontSize: 44 }}>{len} days</h1>

      <Card lg>
        <h2 className="t-card">Progress photos</h2>
        <Segmented value={pose} onChange={setPose} options={[{ value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'back', label: 'Back' }]} />
        {before && after ? <PhotoCompare leftId={before.blobId} rightId={after.blobId} leftLabel={fmtDay(before.dayKey, 'd MMM')} rightLabel={fmtDay(after.dayKey, 'd MMM')} /> : <div className="muted t-13">{shots.length ? 'Only one photo for this pose so far.' : `No ${pose} photos yet`}</div>}
      </Card>

      <div className="grid2">
        <Card tile><div className="cap">Weight</div><div className="big-num num">{stats.w0 ? fmt1(stats.w0.kg) : '—'} → {stats.w1 && stats.w1 !== stats.w0 ? fmt1(stats.w1.kg) : '—'}</div><div className="num t-13 muted">{wDelta != null ? `${signed(wDelta)} kg` : 'kg'}</div></Card>
        <Card tile><div className="cap">Waist</div><div className="big-num num">{waist ? `${fmt1(waist.a)} → ${fmt1(waist.b)}` : '—'}</div><div className="num t-13 muted">{waist ? `${signed(waist.b - waist.a)} cm` : 'cm'}</div></Card>
      </div>
      {stats.parts.length > 0 && (
        <Card><h2 className="t-card">Measurements</h2>
          {stats.parts.map((p) => <div key={p.name} className="row between t-15"><span>{p.name}</span><span className="num"><span className="muted">{fmt1(p.a)} → {fmt1(p.b)} cm</span> <span className="b600" style={{ color: p.b <= p.a ? C.green : C.blue }}>{signed(p.b - p.a)}</span></span></div>)}
        </Card>
      )}

      <div className="grid2">{tiles.map(([l, v, col]) => <Card key={l} tile><div className="cap">{l}</div><div className="big-num num" style={{ color: col, fontSize: 22 }}>{v}</div></Card>)}</div>

      <Card lg>
        <h2 className="t-card">Consistency</h2>
        <CellGrid cols={12} gap={4} radius={4} cells={an.cdays.map((k, i) => ({ key: k, aria: `Day ${i + 1}`, bg: k > d.today ? 'rgba(255,255,255,0.06)' : greenCell(an.scores[k]?.score ?? null), onClick: k <= d.today ? () => nav(`/day/${k}`) : undefined }))} />
      </Card>

      {an.prs.length > 0 && (
        <Card className="flat" style={{ padding: '12px 16px' }}>
          <h2 className="t-card" style={{ marginBottom: 6 }}>Personal records</h2>
          {[...an.prs].sort((a, b) => b.time - a.time).slice(0, 40).map((p, i) => (
            <button key={i} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => nav(`/train/exercise/${p.exerciseId}`)}>
              <span className="stack g2"><span className="b600">{exName(d.exercises, p.exerciseId)}</span><span className="t-12 muted">{PR_LABEL[p.type]} · {fmtDayWd(p.dayKey)}</span></span>
              <span className="num b700" style={{ color: C.yellow }}>{prValue(p)}</span>
            </button>
          ))}
        </Card>
      )}

      {stats.mealPhotos.length > 0 && (
        <Card lg><h2 className="t-card">Every meal</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
            {d.meals.slice().sort((a, b) => a.time - b.time).map((m) => <Collage key={m.id} id={m.photoId} onClick={() => nav(`/eat/meal/${m.id}`)} />)}
          </div>
        </Card>
      )}

      <Btn tint={C.green} tintA={0.4} onClick={() => setExporting(true)}>Export recap image</Btn>
      <Btn onClick={() => nav('/report?range=all')}>Export full report</Btn>

      <ExportImageSheet open={exporting} onClose={() => setExporting(false)} title="Recap image" width={1080} height={1920} fileName="21by21-recap.png" ready={fullUrls != null && thumbUrls != null}>
        <RecapCard r={{
          title: `${len} days`, range: `${fmtDay(c.startDate, 'd MMM')} – ${fmtDay(c.endDate, 'd MMM yyyy')}`,
          weight: stats.w0 && stats.w1 && stats.w0 !== stats.w1 ? `${fmt1(stats.w0.kg)} → ${fmt1(stats.w1.kg)}` : '—', waist: waist ? `${fmt1(waist.a)} → ${fmt1(waist.b)}` : '—',
          sessions: String(stats.sessions), volume: `${fmtInt(stats.volume)} kg`, prs: String(stats.prCount), score: stats.avgScore != null ? String(Math.round(stats.avgScore)) : '—', streak: `${an.streak} d`,
          protein: stats.protein != null ? `${fmtMacro(stats.protein)} g` : '—', water: `${fmtInt(stats.water)} ml`, meals: `${stats.meals} · ${stats.meals ? Math.round((stats.clean / stats.meals) * 100) : 0}% clean`,
          cravings: `${stats.resisted} of ${stats.craves} resisted`, sleep: stats.sleep != null ? fmtDuration(stats.sleep) : '—',
          before: exportIds[0] ? fullUrls?.[exportIds[0]] : undefined, after: exportIds[1] ? fullUrls?.[exportIds[1]] : undefined, collage: collageIds.map((id) => thumbUrls?.[id] ?? '').filter(Boolean),
        }} />
      </ExportImageSheet>
    </Page>
  );
}
