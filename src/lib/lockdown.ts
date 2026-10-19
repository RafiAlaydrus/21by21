/**
 * Keeps the app feeling native: no pinch / double-tap zoom and no long-press select, copy or paste menus on app
 * content. Text fields stay fully editable. CSS does most of the work (see base.css); these handlers cover what
 * CSS cannot on iOS Safari (the non-standard pinch "gesture" events and selection starts).
 */
const isField = (t: EventTarget | null) => t instanceof Element && !!t.closest('input, textarea, select, [contenteditable="true"]');

export function installLockdown(): void {
  const stop = (e: Event) => e.preventDefault();
  // iOS pinch-zoom
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, stop, { passive: false });
  // two-finger moves (other browsers)
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // no text selection or context menu outside form fields
  document.addEventListener('selectstart', (e) => { if (!isField(e.target)) e.preventDefault(); });
  document.addEventListener('contextmenu', (e) => { if (!isField(e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => { if (!isField(e.target)) e.preventDefault(); });
}
