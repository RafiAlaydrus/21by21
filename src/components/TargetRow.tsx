import { NumField, Segmented, Switch } from './ui';
import type { Direction, Target } from '../db/types';

const DIRS: { value: Direction; label: string }[] = [
  { value: 'atLeast', label: 'At least' },
  { value: 'atMost', label: 'At most' },
  { value: 'range', label: 'Range' },
];

/** One user-defined target: on/off, value, direction, optional range max. The app never proposes values. */
export function TargetRow({ label, target, onChange, hint }: { label: string; target: Target; onChange: (t: Target) => void; hint?: string }) {
  const set = (p: Partial<Target>) => onChange({ ...target, ...p });
  return (
    <div className="stack g10" style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="row between">
        <div className="stack"><span className="t-17 b600">{label}</span>{hint && <span className="t-12 muted">{hint}</span>}</div>
        <Switch checked={target.enabled} onChange={(v) => set({ enabled: v })} label={`${label} target`} />
      </div>
      {target.enabled && (
        <div className="stack g8">
          <Segmented value={target.direction} options={DIRS} onChange={(v) => set({ direction: v, rangeMax: v === 'range' ? target.rangeMax ?? target.value : undefined })} />
          <div className="row g8">
            <NumField className="grow" label={target.direction === 'range' ? 'From' : 'Value'} value={target.value || undefined} unit={target.unit} onChange={(n) => set({ value: n ?? 0 })} />
            {target.direction === 'range' && <NumField className="grow" label="To" value={target.rangeMax || undefined} unit={target.unit} onChange={(n) => set({ rangeMax: n ?? 0 })} />}
          </div>
        </div>
      )}
    </div>
  );
}
