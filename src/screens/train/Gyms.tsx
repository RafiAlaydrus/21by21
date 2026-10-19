import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Card, Cap, Chip, IconBtn, Page, TextField } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { newRec, saveRec } from '../../db/ops';
import type { Gym } from '../../db/types';
import { C } from '../../theme';

export default function Gyms() {
  const nav = useNavigate();
  const { gyms, workouts } = useData();
  const [edit, setEdit] = useState<Gym | 'new' | null>(null);
  const withCoords = gyms.filter((g) => g.lat != null && g.lng != null).length;
  return (
    <Page title="Gyms" sub={`${gyms.length} saved`} glows={[{ color: C.cyan, top: -40, right: -100, opacity: 0.16 }]} right={<IconBtn icon="plus" label="New gym" onClick={() => setEdit('new')} />}>
      {gyms.length === 0 && <div className="empty"><div className="b600">No gyms yet</div></div>}
      <Card className="flat" style={{ padding: '4px 16px' }}>
        {gyms.map((g) => (
          <button key={g.id} type="button" className="rowline" style={{ justifyContent: 'space-between' }} onClick={() => setEdit(g)}>
            <span className="stack g2 grow"><span className="b600">{g.name}</span><span className="t-12 muted clip">{g.equipment.join(', ') || 'No equipment listed'}</span></span>
            <span className="num t-13 muted">{workouts.filter((w) => w.gymId === g.id).length} sessions{g.lat != null ? ' · ' : ''}{g.lat != null && <Icon name="pin" size={13} />}</span>
          </button>
        ))}
      </Card>
      <Btn onClick={() => nav('/train/gym-map')} disabled={withCoords === 0}><Icon name="pin" size={18} />Map{withCoords === 0 ? ' (no locations saved)' : ''}</Btn>
      <GymSheet gym={edit} onClose={() => setEdit(null)} />
    </Page>
  );
}

function GymSheet({ gym, onClose }: { gym: Gym | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const g = gym && gym !== 'new' ? gym : undefined;
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [equip, setEquip] = useState<string[]>([]);
  const [item, setItem] = useState('');
  const [pos, setPos] = useState<{ lat?: number; lng?: number }>({});
  const [msg, setMsg] = useState('');
  const [seen, setSeen] = useState<string | null>(null);
  const key = gym == null ? null : g?.id ?? 'new';
  if (key !== seen) { setSeen(key); if (key) { setName(g?.name ?? ''); setNote(g?.note ?? ''); setEquip(g?.equipment ?? []); setPos({ lat: g?.lat, lng: g?.lng }); setItem(''); setMsg(''); } }

  const locate = () => {
    if (!navigator.geolocation) { setMsg('Location is not available on this device.'); return; }
    setMsg('Locating…');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5 }); setMsg(''); },
      () => setMsg('Could not get the location.'), { enableHighAccuracy: true, timeout: 15000 });
  };
  const addItem = () => { const t = item.trim(); if (t && !equip.includes(t)) setEquip([...equip, t]); setItem(''); };
  const save = async () => {
    const fields = { name: name.trim(), note: note.trim() || undefined, equipment: equip, lat: pos.lat, lng: pos.lng };
    if (g) await saveRec(db.gyms, { ...g, ...fields }); else await db.gyms.put(newRec(fields) as Gym);
    onClose();
  };
  return (
    <Sheet open={!!gym} onClose={onClose} title={g ? 'Edit gym' : 'New gym'} tall action={{ label: 'Save', disabled: !name.trim(), onClick: () => void save() }}>
      <TextField label="Name" value={name} onChange={setName} />
      <TextField label="Note" value={note} onChange={setNote} />
      <Cap>Equipment</Cap>
      <div className="row wrap g8">{equip.map((e) => <Chip key={e} sm on onClick={() => setEquip(equip.filter((x) => x !== e))}><span className="row g6">{e}<Icon name="x" size={14} sw={2.4} /></span></Chip>)}</div>
      <div className="row g8"><TextField className="grow" label="Add equipment" value={item} onChange={setItem} onKeyDown={(e) => e.key === 'Enter' && addItem()} /><Btn onClick={addItem} disabled={!item.trim()} style={{ borderRadius: 16, minHeight: 56 }}>Add</Btn></div>
      <Cap>Location</Cap>
      <div className="row between"><span className="num muted">{pos.lat != null ? `${pos.lat}, ${pos.lng}` : 'Not set'}</span>
        <div className="row g8"><Btn sm onClick={locate}>Use current location</Btn>{pos.lat != null && <Btn sm onClick={() => setPos({})}>Clear</Btn>}</div></div>
      {msg && <div className="t-13 muted">{msg}</div>}
      {g && <Btn className="danger" onClick={async () => { await db.gyms.delete(g.id); onClose(); toast('Gym deleted', { undo: () => void db.gyms.put(g) }); }}>Delete gym</Btn>}
    </Sheet>
  );
}
