import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { portalEl } from '../lib/portal';

interface ToastOpts { undo?: () => void; ms?: number }
interface Item { id: number; msg: string; undo?: () => void }
type ToastFn = (msg: string, opts?: ToastOpts) => void;

const Ctx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const drop = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const toast = useCallback<ToastFn>((msg, opts) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-2), { id, msg, undo: opts?.undo }]);
    window.setTimeout(() => drop(id), opts?.ms ?? (opts?.undo ? 6000 : 2500));
  }, [drop]);
  return (
    <Ctx.Provider value={toast}>
      {children}
      {createPortal(<div className="toast-wrap" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <m.div key={t.id} className="glass toast" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ type: 'spring', stiffness: 500, damping: 38 }}>
              <span>{t.msg}</span>
              {t.undo && <button type="button" onClick={() => { t.undo?.(); drop(t.id); }}>Undo</button>}
            </m.div>
          ))}
        </AnimatePresence>
      </div>, portalEl())}
    </Ctx.Provider>
  );
}
