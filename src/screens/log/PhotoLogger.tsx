import { Suspense, lazy, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Btn, Cap, PhotoBox, Segmented } from '../../components/ui';
import { PhotoPicker } from '../../components/PhotoPicker';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { db } from '../../db/schema';
import { savePhoto, useBlobUrl, useFileUrl } from '../../db/photos';
import { upsertDaily } from '../../db/ops';
import { logDay } from '../../hooks/useLogTime';
import { fmtDayWd } from '../../logic/format';
import type { LoggerProps } from '../../hooks/useLogger';
import type { ProgressPhoto } from '../../db/types';

const CameraView = lazy(() => import('./CameraView'));
type Pose = 'front' | 'side' | 'back';

export default function PhotoLogger({ open, onClose, dayKey }: LoggerProps) {
  const { progressPhotos, today } = useData();
  const toast = useToast();
  const day = logDay(dayKey);
  const [pose, setPose] = useState<Pose>('front');
  const [file, setFile] = useState<Blob | undefined>();
  const [camera, setCamera] = useState(false);
  const [saving, setSaving] = useState(false);

  const last = [...progressPhotos].filter((p) => p.pose === pose && p.dayKey < day).sort((a, b) => b.dayKey.localeCompare(a.dayKey))[0];
  const current = progressPhotos.find((p) => p.pose === pose && p.dayKey === day);
  const ghost = useBlobUrl(last?.blobId, 'full');
  const currentUrl = useBlobUrl(file ? undefined : current?.blobId, 'thumb');
  const preview = useFileUrl(file);

  const save = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const blobId = await savePhoto(file, 'progress');
      if (current) await db.blobs.delete(current.blobId);
      await upsertDaily<ProgressPhoto>(db.progressPhotos, `photo:${day}:${pose}`, { dayKey: day, pose, blobId });
      setFile(undefined); toast(`${pose[0].toUpperCase()}${pose.slice(1)} photo saved`);
    } finally { setSaving(false); }
  };

  return (
    <>
    <Sheet open={open && !camera} onClose={onClose} title={`Progress photo${day === today ? '' : ` · ${fmtDayWd(day)}`}`} tall closeLabel="Done">
      <Segmented value={pose} onChange={(p) => { setPose(p); setFile(undefined); }} options={[{ value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'back', label: 'Back' }]} />
      <div className="grid2">
        <div className="stack g6"><Cap>{last ? `Last · ${fmtDayWd(last.dayKey)}` : 'Last'}</Cap><PhotoBox url={ghost} ratio="3 / 4" radius={16} label="No earlier photo" /></div>
        <div className="stack g6"><Cap>{file ? 'New' : current ? 'Saved today' : 'This day'}</Cap><PhotoBox url={preview ?? currentUrl} ratio="3 / 4" radius={16} label="Not taken" /></div>
      </div>
      <Btn onClick={() => setCamera(true)}><Icon name="camera" size={18} />Open camera with overlay</Btn>
      <PhotoPicker onPick={setFile} cameraLabel="System camera" />
      <Btn block tint="#30D158" tintA={0.45} disabled={!file || saving} onClick={() => void save()}>{file ? (current ? 'Replace photo' : 'Save photo') : 'Take or choose a photo'}</Btn>
      <div className="t-12 muted ta-center">The previous photo of the same pose is overlaid at 35% in the camera so you can line up.</div>
    </Sheet>
    {camera && <Suspense fallback={null}><CameraView ghostUrl={ghost} onCapture={(b) => { setFile(b); setCamera(false); }} onClose={() => setCamera(false)} /></Suspense>}
    </>
  );
}
