import { useRef } from 'react';
import { Btn } from './ui';
import { Icon } from './Icon';

/** Camera (rear, capture) and Library buttons. Always resolves to a File; compression happens on save. */
export function PhotoPicker({ onPick, compact, cameraLabel = 'Camera' }: { onPick: (f: File) => void; compact?: boolean; cameraLabel?: string }) {
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; };
  return (
    <>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <input ref={lib} type="file" accept="image/*" hidden onChange={handle} />
      <div className="grid2" style={{ gap: 8 }}>
        <Btn sm={compact} onClick={() => cam.current?.click()}><Icon name="camera" size={18} />{cameraLabel}</Btn>
        <Btn sm={compact} onClick={() => lib.current?.click()}><Icon name="image" size={18} />Library</Btn>
      </div>
    </>
  );
}
