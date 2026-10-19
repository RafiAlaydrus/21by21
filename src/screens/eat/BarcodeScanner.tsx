import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Btn, NumField } from '../../components/ui';
import { Icon } from '../../components/Icon';

/** Full-screen scanner. @zxing/browser is imported lazily so it never touches the initial bundle. */
export default function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState<number | undefined>();

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | undefined;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints);
        controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video.current!, (result) => {
          if (result && !stopped) { stopped = true; controls?.stop(); onCode(result.getText()); }
        });
        if (stopped) controls.stop();
      } catch {
        setError('Camera unavailable. Type the barcode number instead.');
      }
    })();
    return () => { stopped = true; controls?.stop(); };
  }, [onCode]);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div className="row between" style={{ padding: 'calc(var(--safe-t) + 12px) 16px 12px' }}>
        <h2 className="t-17 b600">Scan barcode</h2>
        <button type="button" className="glass-btn icon-btn" aria-label="Close scanner" onClick={onClose}><Icon name="x" size={20} /></button>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <video ref={video} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div aria-hidden="true" style={{ position: 'absolute', left: '12%', right: '12%', top: '38%', height: '22%', border: '2px solid rgba(255,255,255,0.7)', borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
      </div>
      <div className="stack g10" style={{ padding: '14px 16px calc(var(--safe-b) + 18px)' }}>
        {error && <div className="t-13 muted ta-center">{error}</div>}
        <div className="row g8">
          <NumField className="grow" label="Barcode number" mode="numeric" value={manual} onChange={setManual} />
          <Btn disabled={!manual} onClick={() => manual && onCode(String(manual))} style={{ borderRadius: 16, minHeight: 56 }}>Use</Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
