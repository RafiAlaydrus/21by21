/** Overlays (sheets, toasts, camera) render into #portal, which is sized exactly like #root. */
export const portalEl = (): HTMLElement => document.getElementById('portal') ?? document.body;
