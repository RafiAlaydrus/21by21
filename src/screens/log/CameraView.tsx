import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
import { PhotoPicker } from '../../components/PhotoPicker';
import { canvasToJpeg } from '../../db/photos';
import { portalEl } from '../../lib/portal';

/**
 * getUserMedia camera with the previous photo of the same pose as a 35 % ghost overlay for alignment.
 * Falls back to the file picker when the camera is unavailable or denied.
 */
export default function CameraView({ ghostUrl, onCapture, onClose }: { ghostUrl?: string; onCapture: (b: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream>();
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setError('');
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1706 } }, audio: false });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => undefined); }
      } catch { if (alive) setError('Camera unavailable. Use the library or the system camera instead.'); }
    })();
    return () => { alive = false; stream.current?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  const shoot = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    // crop to the same 3:4 frame that is shown on screen (object-fit: cover)
    const ar = 3 / 4;
    let sw = v.videoWidth, sh = v.videoHeight;
    if (sw / sh > ar) sw = sh * ar; else sh = sw / ar;
    const c = document.createElement('canvas');
    c.width = Math.round(sw); c.height = Math.round(sh);
    c.getContext('2d')!.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    onCapture(canvasToJpeg(c, 0.92));
  };

  return createPortal(
    <div className="overlay" style={{ zIndex: 95 }}>
      <div className="row between" style={{ padding: 'calc(var(--safe-t) + 10px) 16px 10px' }}>
        <h2 className="t-17 b600">Progress photo</h2>
        <button type="button" className="glass-btn icon-btn" aria-label="Close camera" onClick={onClose}><Icon name="x" size={20} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', aspectRatio: '3 / 4', maxHeight: '100%', maxWidth: '100%', height: '100%', background: '#111', overflow: 'hidden', borderRadius: 18 }}>
          <video ref={video} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          {ghostUrl && <img src={ghostUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35, pointerEvents: 'none' }} />}
        </div>
      </div>
      {error ? (
        <div className="stack g10" style={{ padding: '12px 16px calc(var(--safe-b) + 18px)' }}>
          <div className="t-13 muted ta-center">{error}</div>
          <PhotoPicker onPick={(f) => onCapture(f)} />
        </div>
      ) : (
        <div className="row between" style={{ padding: '14px 28px calc(var(--safe-b) + 22px)' }}>
          <span style={{ width: 52 }} />
          <button type="button" aria-label="Take photo" onClick={shoot} style={{ width: 74, height: 74, borderRadius: 37, border: '4px solid #fff', background: 'rgba(255,255,255,0.25)' }} />
          <button type="button" className="glass-btn icon-btn" aria-label="Switch camera" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}><Icon name="swap" size={20} /></button>
        </div>
      )}
    </div>,
    portalEl(),
  );
}
