import { useState } from 'react';
import { Btn, Card, DateField, Glows, TextField } from '../../components/ui';
import { TargetRow } from '../../components/TargetRow';
import { Icon } from '../../components/Icon';
import { setMeta, updateSettings } from '../../db/ops';
import { useSettings } from '../../hooks/useData';
import type { Settings } from '../../db/types';

const TARGETS: { key: keyof Settings['targets']; label: string; hint?: string }[] = [
  { key: 'calories', label: 'Calories' }, { key: 'protein', label: 'Protein' }, { key: 'carbs', label: 'Carbs' }, { key: 'fat', label: 'Fat' },
  { key: 'water', label: 'Water', hint: 'Plain water only' }, { key: 'sleep', label: 'Night sleep' }, { key: 'steps', label: 'Steps' },
  { key: 'gymPerWeek', label: 'Gym sessions per week' }, { key: 'mealsPerDay', label: 'Meals per day' },
];

export default function Onboarding() {
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Settings>(() => structuredClone(settings));
  const ch = draft.challenge;
  const setCh = (p: Partial<Settings['challenge']>) => setDraft({ ...draft, challenge: { ...ch, ...p } });

  const finish = async () => {
    await updateSettings((s) => { s.challenge = draft.challenge; s.targets = draft.targets; });
    try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
    await setMeta('onboarded', true);
  };

  return (
    <div className="screen no-tabs" style={{ minHeight: '100%' }}>
      <Glows list={[{ color: '#30D158', top: -60, left: -90, size: 320, opacity: 0.22 }, { color: '#0A84FF', top: 520, right: -120, size: 300, opacity: 0.18 }]} />
      <header className="stack g4">
        <div className="eyebrow">Setup · {step + 1} of 3</div>
        <h1 className="t-large">{['Challenge dates', 'Your targets', 'Install on iPhone'][step]}</h1>
        <div className="muted">{['Confirm the dates for this challenge.', 'All optional. Nothing is suggested; you set every number.', 'Three taps in Safari.'][step]}</div>
      </header>

      {step === 0 && (
        <Card className="g10">
          <TextField label="Name" value={ch.name} onChange={(v) => setCh({ name: v })} />
          <div className="grid2">
            <DateField label="Day 0 (baseline)" value={ch.baselineDate} onChange={(v) => setCh({ baselineDate: v })} />
            <DateField label="Day 1" value={ch.startDate} onChange={(v) => setCh({ startDate: v })} />
            <DateField label="Last day" value={ch.endDate} onChange={(v) => setCh({ endDate: v })} />
            <DateField label="Recap" value={ch.recapDate} onChange={(v) => setCh({ recapDate: v })} />
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="g0" style={{ gap: 0 }}>
          {TARGETS.map((t) => (
            <TargetRow key={t.key} label={t.label} hint={t.hint} target={draft.targets[t.key]}
              onChange={(v) => setDraft({ ...draft, targets: { ...draft.targets, [t.key]: v } })} />
          ))}
        </Card>
      )}

      {step === 2 && (
        <Card className="g14">
          {['Tap the Share button in Safari.', 'Choose “Add to Home Screen”.', 'Open 21 by 21 from the Home Screen.'].map((t, i) => (
            <div key={i} className="row g12">
              <span className="glass-btn icon-btn sm b700">{i + 1}</span>
              <span className="t-17">{t}</span>
            </div>
          ))}
          <div className="t-13 muted">Everything is stored on this phone only. Use Settings → Backup to export a copy.</div>
        </Card>
      )}

      <div className="row g10" style={{ marginTop: 'auto' }}>
        {step > 0 && <Btn onClick={() => setStep(step - 1)}><Icon name="back" size={18} />Back</Btn>}
        <Btn className="grow" tint="#30D158" tintA={0.5} onClick={() => (step < 2 ? setStep(step + 1) : void finish())}>
          {step === 1 ? 'Next' : step === 2 ? 'Start' : 'Next'}
        </Btn>
      </div>
    </div>
  );
}
