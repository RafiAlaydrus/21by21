/**
 * iOS home-screen apps (black-translucent status bar + viewport-fit=cover) can report a layout viewport that is
 * shorter than the screen by the status-bar height (47 pt on notched iPhones). Anything pinned to the bottom then
 * floats too high and a black band shows below the app. When that happens we size #root / #portal explicitly from
 * screen.height via the --app-h custom property; everywhere else the CSS falls back to the normal fixed inset.
 */
export function installViewportFix(): void {
  const el = document.documentElement;
  const apply = () => {
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    const portrait = window.innerHeight >= window.innerWidth;
    const long = Math.max(screen.width, screen.height), short = Math.min(screen.width, screen.height);
    const full = portrait ? long : short;
    // only correct a *slightly* short viewport; a much shorter one is the on-screen keyboard and must be respected
    if (standalone && window.innerHeight < full - 1 && window.innerHeight > full * 0.85) el.style.setProperty('--app-h', `${full}px`);
    else el.style.removeProperty('--app-h');
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  window.addEventListener('pageshow', apply);
  document.addEventListener('visibilitychange', apply);
}
