import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';

export function Sheet({ open, onClose, title, children, tall, action, closeLabel = 'Cancel' }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; tall?: boolean;
  action?: { label: string; onClick: () => void; disabled?: boolean; color?: string };
  closeLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div key="bd" className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose} />
      )}
      {open && (
        <m.div key="sh" className={`sheet ${tall ? 'tall' : ''}`} role="dialog" aria-modal="true" aria-label={title}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 500, damping: 38 }}>
          <div className="sheet-grab" />
          {(title || action) && (
            <div className="sheet-head">
              <button type="button" className="glass-btn btn sm" onClick={onClose}>{closeLabel}</button>
              <h2>{title}</h2>
              {action ? (
                <button type="button" className="glass-btn btn sm" disabled={action.disabled} onClick={action.onClick} style={{ color: action.disabled ? undefined : action.color ?? 'var(--green)', fontWeight: 700 }}>{action.label}</button>
              ) : <span style={{ width: 70 }} />}
            </div>
          )}
          <div className="sheet-body">{children}</div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
