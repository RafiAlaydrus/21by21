import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Btn, Cap, Chip, DateField, NumField, Page, Segmented, TextField, ToggleRow } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { TargetRow } from '../../components/TargetRow';
import { ViewportInfo } from '../../components/ViewportInfo';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { todayKey, uid, updateSettings } from '../../db/ops';
import { exportBackup, importBackup, inspectBackup, markBackedUp, saveFile } from '../../db/backup';
import type { BackupInfo } from '../../db/backup';
import { fmtDayWd, fmtInt } from '../../logic/format';
import type { CustomTracker, Settings as S, Target } from '../../db/types';
import { C } from '../../theme';

const up = (fn: (s: S) => void) => updateSettings(fn);
const APP_VERSION = '1.0.0';

/* ---------- small editors ---------- */
function CommitText({ value, onCommit, placeholder, label, className }: { value: string; onCommit: (v: string) => void; placeholder?: string; label: string; className?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input aria-label={label} className={`glass-btn ${className ?? ''}`} style={{ borderRadius: 14, padding: '10px 12px', fontSize: 16, fontWeight: 600, minHeight: 44 }} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() !== value && v.trim() && onCommit(v.trim())} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}

function Move({ i, n, move, del }: { i: number; n: number; move: (from: number, to: number) => void; del: () => void }) {
  return (
    <span className="row g4">
      <button type="button" className="glass-btn icon-btn sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}><span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="down" size={16} sw={2.2} /></span></button>
      <button type="button" className="glass-btn icon-btn sm" aria-label="Move down" disabled={i === n - 1} onClick={() => move(i, i + 1)}><Icon name="down" size={16} sw={2.2} /></button>
      <button type="button" className="glass-btn icon-btn sm" aria-label="Delete" onClick={del}><Icon name="trash" size={16} /></button>
    </span>
  );
}

const reorder = <T,>(a: T[], from: number, to: number) => { const c = [...a]; const [x] = c.splice(from, 1); c.splice(to, 0, x); return c; };

function StringList({ items, onChange, placeholder }: { items: string[]; onChange: (l: string[]) => void; placeholder: string }) {
  const [fresh, setFresh] = useState('');
  const toast = useToast();
  const add = () => { const t = fresh.trim(); if (t && !items.includes(t)) onChange([...items, t]); setFresh(''); };
  return (
    <div className="stack g8">
      {items.map((it, i) => (
        <div key={`${i}`} className="row g8"><CommitText label={`Rename ${it}`} className="grow" value={it} onCommit={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />
          <Move i={i} n={items.length} move={(a, b) => onChange(reorder(items, a, b))} del={() => { onChange(items.filter((_, j) => j !== i)); toast(`${it} removed`, { undo: () => onChange(items) }); }} /></div>
      ))}
      <div className="row g8"><TextField className="grow" label="Add" value={fresh} onChange={setFresh} placeholder={placeholder} onKeyDown={(e) => e.key === 'Enter' && add()} /><Btn disabled={!fresh.trim()} onClick={add} style={{ borderRadius: 16, minHeight: 56 }}>Add</Btn></div>
    </div>
  );
}

function DateList({ items, onChange }: { items: string[]; onChange: (l: string[]) => void }) {
  const [v, setV] = useState(() => todayKey());
  return (
    <div className="stack g8">
      <div className="row wrap g8">{[...items].sort().map((d) => <Chip key={d} sm on onClick={() => onChange(items.filter((x) => x !== d))}><span className="row g6">{fmtDayWd(d)}<Icon name="x" size={14} sw={2.4} /></span></Chip>)}{items.length === 0 && <span className="muted t-13">None</span>}</div>
      <div className="row g8"><DateField className="grow" label="Add date" value={v} onChange={setV} /><Btn disabled={!v || items.includes(v)} onClick={() => onChange([...items, v])} style={{ borderRadius: 16, minHeight: 56 }}>Add</Btn></div>
    </div>
  );
}

function Section({ id, title, sub, open, toggle, children }: { id: string; title: string; sub?: string; open: boolean; toggle: (id: string) => void; children: ReactNode }) {
  return (
    <section className="glass card" id={`sec-${id}`} style={{ gap: 0 }}>
      <button type="button" className="row between" style={{ minHeight: 44, textAlign: 'left' }} aria-expanded={open} onClick={() => toggle(id)}>
        <span className="stack"><span className="t-17 b600">{title}</span>{sub && <span className="t-12 muted">{sub}</span>}</span>
        <Icon name="down" size={18} color={C.text2} />
      </button>
      {open && <div className="stack g12" style={{ paddingTop: 12 }}>{children}</div>}
    </section>
  );
}

const TARGETS: { key: keyof S['targets']; label: string; hint?: string }[] = [
  { key: 'calories', label: 'Calories' }, { key: 'protein', label: 'Protein' }, { key: 'carbs', label: 'Carbs' }, { key: 'fat', label: 'Fat' },
  { key: 'water', label: 'Water', hint: 'Plain water only' }, { key: 'sleep', label: 'Night sleep' }, { key: 'steps', label: 'Steps' },
  { key: 'gymPerWeek', label: 'Gym sessions per week' }, { key: 'mealsPerDay', label: 'Meals per day' },
];
const TRACKERS: [keyof S['trackers'], string][] = [['training', 'Training'], ['food', 'Food'], ['water', 'Water'], ['drinks', 'Other drinks'], ['supplements', 'Supplements'], ['sleep', 'Sleep'], ['checkin', 'Daily check-in'], ['cravings', 'Cravings'], ['soreness', 'Soreness'], ['steps', 'Steps'], ['tags', 'Day tags'], ['spending', 'Spending'], ['reminders', 'Reminders']];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ALIAS: Record<string, string> = { water: 'quickwater', report: 'backup' };

export default function Settings() {
  const [sp, setSp] = useSearchParams();
  const d = useData();
  const s = d.settings;
  const toast = useToast();
  const initial = ALIAS[sp.get('s') ?? ''] ?? sp.get('s') ?? 'challenge';
  const [open, setOpen] = useState<string>(initial);
  const toggle = (id: string) => { setOpen(open === id ? '' : id); setSp({}, { replace: true }); };
  const ref = useRef(false);
  useEffect(() => { if (!ref.current && sp.get('s')) { ref.current = true; window.setTimeout(() => document.getElementById(`sec-${initial}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120); } }, [initial, sp]);

  const sec = (id: string, title: string, children: ReactNode, sub?: string) => <Section id={id} title={title} sub={sub} open={open === id} toggle={toggle}>{children}</Section>;

  /* ---- score weights ---- */
  const cats: { cat: string; label: string; on: boolean }[] = [
    { cat: 'training', label: 'Training', on: s.trackers.training && s.trainingDays.some(Boolean) },
    { cat: 'food', label: 'Clean meals', on: s.trackers.food && s.targets.mealsPerDay.enabled },
    { cat: 'water', label: 'Water', on: s.trackers.water && s.targets.water.enabled },
    { cat: 'calories', label: 'Calories', on: s.trackers.food && s.targets.calories.enabled }, { cat: 'protein', label: 'Protein', on: s.trackers.food && s.targets.protein.enabled },
    { cat: 'carbs', label: 'Carbs', on: s.trackers.food && s.targets.carbs.enabled }, { cat: 'fat', label: 'Fat', on: s.trackers.food && s.targets.fat.enabled },
    { cat: 'sleep', label: 'Sleep', on: s.trackers.sleep && s.targets.sleep.enabled }, { cat: 'supplements', label: 'Supplements', on: s.trackers.supplements && d.supplements.some((x) => x.daily) },
    { cat: 'checkin', label: 'Check-in', on: s.trackers.checkin }, { cat: 'steps', label: 'Steps', on: s.trackers.steps && s.targets.steps.enabled },
    ...s.customTrackers.map((t) => ({ cat: `custom:${t.id}`, label: t.name, on: t.kind === 'boolean' || !!t.target?.enabled })),
  ];
  const w = (c: string) => s.score.weights[c] ?? 1;
  const totalW = cats.filter((c) => c.on).reduce((a, c) => a + w(c.cat), 0);

  /* ---- backup ---- */
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ file: File; info: BackupInfo } | null>(null);
  const [ready, setReady] = useState<{ blob: Blob; name: string } | null>(null);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = async (f?: File) => {
    if (!f) return;
    try { setImportMsg(''); setPending({ file: f, info: await inspectBackup(f) }); } catch (e) { setImportMsg((e as Error).message); }
  };

  /* ---- data ---- */
  const [est, setEst] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({});
  const refreshEst = async () => { try { const e = await navigator.storage?.estimate?.(); setEst({ usage: e?.usage, quota: e?.quota, persisted: await navigator.storage?.persisted?.() }); } catch { /* not available */ } };
  useEffect(() => { if (open === 'data') void refreshEst(); }, [open]);

  /* ---- about / dev ---- */
  const [taps, setTaps] = useState(0);
  const [wipe, setWipe] = useState(false);
  const [typed, setTyped] = useState('');
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [working, setWorking] = useState('');
  const dev = taps >= 5;

  const setTracker = (c: CustomTracker) => up((x) => { x.customTrackers = x.customTrackers.map((t) => (t.id === c.id ? c : t)); });

  return (
    <Page title="Settings" noTabs glows={[{ color: C.text2, top: -40, right: -100, opacity: 0.12 }]}>
      <div className="t-13 muted" style={{ padding: '0 4px' }}>Everything here is yours to set. The app never suggests a number.</div>

      {sec('challenge', 'Challenge', <>
        <TextField label="Name" value={s.challenge.name} onChange={(v) => void up((x) => { x.challenge.name = v; })} />
        <div className="grid2">
          <DateField label="Day 0 (baseline)" value={s.challenge.baselineDate} onChange={(v) => void up((x) => { x.challenge.baselineDate = v; })} />
          <DateField label="Day 1" value={s.challenge.startDate} onChange={(v) => void up((x) => { x.challenge.startDate = v; })} />
          <DateField label="Last day" value={s.challenge.endDate} onChange={(v) => void up((x) => { x.challenge.endDate = v; })} />
          <DateField label="Recap" value={s.challenge.recapDate} onChange={(v) => void up((x) => { x.challenge.recapDate = v; })} />
        </div>
        <Cap>Weigh-in dates</Cap><DateList items={s.challenge.weighInDates} onChange={(l) => void up((x) => { x.challenge.weighInDates = l; })} />
        <Cap>Measurement dates</Cap><DateList items={s.challenge.measurementDates} onChange={(l) => void up((x) => { x.challenge.measurementDates = l; })} />
        <Cap>Progress photo dates</Cap><DateList items={s.challenge.progressPhotoDates} onChange={(l) => void up((x) => { x.challenge.progressPhotoDates = l; })} />
      </>)}

      {sec('targets', 'Targets', <div className="stack">{TARGETS.map((t) => <TargetRow key={t.key} label={t.label} hint={t.hint} target={s.targets[t.key]} onChange={(v: Target) => void up((x) => { x.targets[t.key] = v; })} />)}</div>, 'Compared with what you log')}

      {sec('training', 'Training days', <>
        <div className="t-13 muted">Days you expect a session. Only these days count training in the score.</div>
        <div className="grid4" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
          {DAYS.map((n, i) => <Chip key={n} on={s.trainingDays[i]} onClick={() => void up((x) => { x.trainingDays[i] = !x.trainingDays[i]; })} style={{ padding: '8px 0', justifyContent: 'center', fontSize: 13 }}>{n}</Chip>)}
        </div>
      </>)}

      {sec('trackers', 'Trackers', <>{TRACKERS.map(([k, l]) => <ToggleRow key={k} label={l} checked={s.trackers[k]} onChange={(v) => void up((x) => { x.trackers[k] = v; })} />)}</>, 'Turn parts of the app on or off')}

      {sec('score', 'Consistency score', <>
        <div className="t-13 muted">Weights are relative. The percentage is each category's share among the ones currently taking part.</div>
        {cats.map((c) => (
          <div key={c.cat} className="glass-btn field" style={{ opacity: c.on ? 1 : 0.5 }}>
            <span className="lbl row between"><span>{c.label}{!c.on && ' · off'}</span><span className="num" style={{ fontSize: 14 }}>{c.on && totalW > 0 ? `${Math.round((w(c.cat) / totalW) * 100)}%` : '—'} · weight {w(c.cat)}</span></span>
            <input type="range" className="range" min={0} max={10} step={0.5} value={w(c.cat)} aria-label={`${c.label} weight`} onChange={(e) => void up((x) => { x.score.weights[c.cat] = Number(e.target.value); })} />
          </div>
        ))}
        <Cap>Named ranges</Cap>
        <div className="t-13 muted">A name appears when the 7-day score reaches the minimum. No names are set by default.</div>
        {s.score.labels.map((l, i) => (
          <div key={i} className="row g8"><NumField className="grow" label="From score" mode="numeric" value={l.min} onChange={(v) => void up((x) => { x.score.labels[i].min = v ?? 0; })} /><CommitText label="Label" className="grow" value={l.label} onCommit={(v) => void up((x) => { x.score.labels[i].label = v; })} />
            <button type="button" className="glass-btn icon-btn sm" aria-label="Delete range" onClick={() => void up((x) => { x.score.labels.splice(i, 1); })}><Icon name="trash" size={16} /></button></div>
        ))}
        <Btn onClick={() => void up((x) => { x.score.labels.push({ min: 0, label: 'Name' }); })}>+ Add range</Btn>
        <NumField label="Streak threshold" mode="numeric" value={s.score.streakThreshold} onChange={(v) => void up((x) => { x.score.streakThreshold = v ?? 0; })} />
        <div className="t-12 muted">A day counts toward the streak when its score is at least this. 0 = any day with something logged.</div>
      </>)}

      {sec('custom', 'Custom trackers', <>
        {s.customTrackers.length === 0 && <div className="muted t-13">None yet. Examples: “No sugar” (yes/no) or “Stretching” (minutes).</div>}
        {s.customTrackers.map((t) => (
          <div key={t.id} className="stack g8 glass inner">
            <div className="row g8"><CommitText label="Tracker name" className="grow" value={t.name} onCommit={(v) => setTracker({ ...t, name: v })} />
              <button type="button" className="glass-btn icon-btn sm" aria-label={`Delete ${t.name}`} onClick={() => { void up((x) => { x.customTrackers = x.customTrackers.filter((y) => y.id !== t.id); }); toast(`${t.name} removed`, { undo: () => void up((x) => { x.customTrackers.push(t); }) }); }}><Icon name="trash" size={16} /></button></div>
            <Segmented value={t.kind} onChange={(k) => setTracker({ ...t, kind: k })} options={[{ value: 'boolean', label: 'Yes / no' }, { value: 'number', label: 'Number' }]} />
            {t.kind === 'number' && <>
              <TextField label="Unit" value={t.unit ?? ''} onChange={(v) => setTracker({ ...t, unit: v })} />
              <TargetRow label="Target" target={t.target ?? { enabled: false, value: 0, direction: 'atLeast', unit: t.unit ?? '' }} onChange={(v) => setTracker({ ...t, target: { ...v, unit: t.unit ?? v.unit } })} />
            </>}
          </div>
        ))}
        <Btn onClick={() => void up((x) => { x.customTrackers.push({ id: uid().slice(0, 8), name: 'New tracker', kind: 'boolean' }); })}>+ New tracker</Btn>
      </>)}

      {sec('quickwater', 'Quick-add water buttons', <>
        <div className="t-13 muted">Your own glass and bottle sizes. This list starts empty; a button appears on the Water screen once it has an amount.</div>
        {s.quickWater.map((q, i) => (
          <div key={q.id} className="row g8">
            <CommitText label="Label" className="grow" value={q.label} onCommit={(v) => void up((x) => { x.quickWater[i].label = v; })} />
            <NumField style={{ width: 110 }} label="ml" mode="numeric" value={q.ml} onChange={(v) => void up((x) => { x.quickWater[i].ml = v ?? 0; })} />
            <Move i={i} n={s.quickWater.length} move={(a, b) => void up((x) => { x.quickWater = reorder(x.quickWater, a, b); })} del={() => { void up((x) => { x.quickWater.splice(i, 1); }); toast(`${q.label} removed`, { undo: () => void up((x) => { x.quickWater.splice(i, 0, q); }) }); }} />
          </div>
        ))}
        <Btn onClick={() => void up((x) => { x.quickWater.push({ id: uid(), label: 'New button', ml: 0 }); })}>+ Add button</Btn>
      </>)}

      {sec('meal', 'Meal labels', <StringList items={s.mealLabels} placeholder="e.g. Breakfast" onChange={(l) => void up((x) => { x.mealLabels = l; })} />, 'Order = time of day')}
      {sec('cooking', 'Cooking methods', <StringList items={s.cookingMethods} placeholder="e.g. Grilled" onChange={(l) => void up((x) => { x.cookingMethods = l; })} />)}
      {sec('units', 'Supplement units', <StringList items={s.supplementUnits} placeholder="e.g. scoop" onChange={(l) => void up((x) => { x.supplementUnits = l; })} />)}
      {sec('timing', 'Timing tags', <StringList items={s.timingTags} placeholder="e.g. Before gym" onChange={(l) => void up((x) => { x.timingTags = l; })} />)}
      {sec('body', 'Body parts', <>
        {s.bodyParts.map((b, i) => (
          <div key={b.id} className="row g8"><CommitText label="Body part" className="grow" value={b.name} onCommit={(v) => void up((x) => { x.bodyParts[i].name = v; })} />
            <Move i={i} n={s.bodyParts.length} move={(a, c) => void up((x) => { x.bodyParts = reorder(x.bodyParts, a, c); })} del={() => { void up((x) => { x.bodyParts.splice(i, 1); }); toast(`${b.name} removed`, { undo: () => void up((x) => { x.bodyParts.splice(i, 0, b); }) }); }} /></div>
        ))}
        <Btn onClick={() => void up((x) => { x.bodyParts.push({ id: `bp${uid().slice(0, 6)}`, name: 'New part' }); })}>+ Add body part</Btn>
      </>, 'Used by Measurements')}
      {sec('daytags', 'Day tags', <StringList items={s.dayTags} placeholder="e.g. Travel day" onChange={(l) => void up((x) => { x.dayTags = l; })} />)}
      {sec('currencies', 'Currencies', <StringList items={s.currencies} placeholder="e.g. RM" onChange={(l) => void up((x) => { x.currencies = l; })} />, 'Never converted between each other')}

      {sec('sleep', 'Sleep night cut-off', <>
        <NumField label="Cut-off hour (0–23)" mode="numeric" value={s.sleepNightCutoffHour} onChange={(v) => void up((x) => { x.sleepNightCutoffHour = Math.min(23, Math.max(0, Math.round(v ?? 12))); })} />
        <div className="t-12 muted">A night sleep that starts before this hour counts for the previous day.</div>
      </>)}
      {sec('rest', 'Rest timer', <>
        <ToggleRow label="Show a rest stopwatch after each set" checked={s.restTimer.enabled} onChange={(v) => void up((x) => { x.restTimer.enabled = v; })} />
        <NumField label="Length" unit="seconds" mode="numeric" value={s.restTimer.seconds} onChange={(v) => void up((x) => { x.restTimer.seconds = Math.max(5, Math.round(v ?? 90)); })} />
      </>)}

      {sec('backup', 'Backup', <>
        <div className="num t-13 muted">{s.lastBackupAt ? `Last backup ${new Date(s.lastBackupAt).toLocaleString()}` : 'No backup yet'}</div>
        <Btn tint={C.green} tintA={0.4} disabled={busy} onClick={async () => { setBusy(true); try { setReady(await exportBackup()); } catch { toast('Backup failed'); } finally { setBusy(false); } }}>{busy ? 'Preparing…' : 'Export backup (zip)'}</Btn>
        <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        <Btn onClick={() => fileRef.current?.click()}>Import backup…</Btn>
        {importMsg && <div className="t-13" style={{ color: C.red }}>{importMsg}</div>}
        <NumField label="Remind me after" unit="days (0 = off)" mode="numeric" value={s.backupReminderDays} onChange={(v) => void up((x) => { x.backupReminderDays = Math.max(0, Math.round(v ?? 0)); })} />
        <a href="#/report" className="link">Weekly check-in report ›</a>
      </>, 'Export, import, reminder')}

      {sec('data', 'Data', <>
        <div className="row between"><span>Storage used</span><span className="num muted">{est.usage != null ? `${(est.usage / 1048576).toFixed(1)} MB${est.quota ? ` of ${fmtInt(est.quota / 1048576)} MB` : ''}` : '—'}</span></div>
        <div className="row between"><span>Persistent storage</span><span className="muted">{est.persisted == null ? 'Unknown' : est.persisted ? 'Granted' : 'Not granted'}</span></div>
        {est.persisted === false && <Btn onClick={async () => { try { await navigator.storage.persist(); } catch { /* unsupported */ } void refreshEst(); }}>Request persistent storage</Btn>}
        <div className="t-12 muted">All data lives only on this phone. Export a backup regularly.</div>
      </>)}

      {sec('about', 'About', <>
        <button type="button" className="row between" style={{ minHeight: 44 }} onClick={() => setTaps(taps + 1)}><span>Version</span><span className="num muted">{APP_VERSION}</span></button>
        <div className="row between t-13"><span className="muted">Build</span><span className="num muted">{__BUILD_ID__}</span></div>
        <div className="t-13 muted">A personal tracker. It records what you log and compares it with the targets you set. It never gives advice.</div>
        {dev && (
          <div className="stack g8 glass inner">
            <Cap>Developer</Cap>
            <ViewportInfo />
            <Btn disabled={!!working} onClick={() => setConfirmDemo(true)}>{working || 'Load demo data'}</Btn>
            <Btn className="danger" onClick={() => { setTyped(''); setWipe(true); }}>Wipe all data</Btn>
          </div>
        )}
      </>)}

      <Sheet open={!!ready} onClose={() => setReady(null)} title="Backup ready" closeLabel="Close">
        {ready && <>
          <div className="t-15 b600">{ready.name}</div>
          <div className="num t-13 muted">{(ready.blob.size / 1048576).toFixed(1)} MB · all entries and photos</div>
          <Btn block tint={C.green} tintA={0.45} onClick={async () => { const r = await saveFile(ready.blob, ready.name, 'application/zip'); await markBackedUp(); toast(r === 'shared' ? 'Backup shared' : 'Backup downloaded'); setReady(null); }}>Save to Files / Share</Btn>
          <div className="t-12 muted">On iPhone choose “Save to Files”. The backup is marked done once you save or share it.</div>
        </>}
      </Sheet>
      <Sheet open={!!pending} onClose={() => setPending(null)} title="Import backup">
        {pending && <>
          <div className="t-15 b600">This replaces all data on this phone.</div>
          <div className="num t-13 muted">Backup from {new Date(pending.info.exportedAt).toLocaleString()} · {pending.info.meals} meals · {pending.info.workouts} workouts · {pending.info.photos} photos</div>
          <Btn block className="danger" disabled={busy} onClick={async () => { setBusy(true); try { await importBackup(pending.file); setPending(null); toast('Backup restored'); } catch (e) { setImportMsg((e as Error).message); setPending(null); } finally { setBusy(false); } }}>{busy ? 'Restoring…' : 'Replace everything'}</Btn>
        </>}
      </Sheet>
      <Sheet open={confirmDemo} onClose={() => setConfirmDemo(false)} title="Load demo data">
        <div className="t-15">This replaces everything on this phone with about 10 days of made-up data, and shifts the challenge dates so today is Day 10. “Wipe all data” restores the real dates.</div>
        <Btn block tint={C.orange} tintA={0.4} onClick={async () => { setConfirmDemo(false); setWorking('Loading…'); try { const m = await import('../../db/seed'); await m.loadDemoData(); toast('Demo data loaded'); } finally { setWorking(''); } }}>Replace with demo data</Btn>
      </Sheet>
      <Sheet open={wipe} onClose={() => setWipe(false)} title="Wipe all data">
        <div className="t-15">This deletes every entry, photo and setting on this phone. It cannot be undone. Type DELETE to confirm.</div>
        <TextField label="Type DELETE" value={typed} onChange={setTyped} autoCapitalize="characters" />
        <Btn block className="danger" disabled={typed !== 'DELETE'} onClick={async () => { const m = await import('../../db/seed'); await m.wipeAll(); setWipe(false); toast('All data deleted'); }}>Delete everything</Btn>
      </Sheet>
    </Page>
  );
}
