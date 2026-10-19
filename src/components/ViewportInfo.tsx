import { useEffect, useState } from 'react';

/** On-device readout of what iOS reports for the page area (developer tools in Settings → About). */
export function ViewportInfo() {
  const [info, setInfo] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const inset = `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`;
      probe.remove();
      const root = document.getElementById('root')?.getBoundingClientRect();
      setInfo({
        'inner (w × h)': `${innerWidth} × ${innerHeight}`,
        'visual viewport': `${Math.round(visualViewport?.width ?? 0)} × ${Math.round(visualViewport?.height ?? 0)}`,
        'screen (w × h)': `${screen.width} × ${screen.height}`,
        'safe insets (t r b l)': inset,
        '#root (top → bottom)': root ? `${Math.round(root.top)} → ${Math.round(root.bottom)}` : '—',
        'standalone': String((navigator as Navigator & { standalone?: boolean }).standalone ?? 'n/a'),
        'display-mode': ['standalone', 'fullscreen', 'minimal-ui', 'browser'].find((m) => matchMedia(`(display-mode: ${m})`).matches) ?? '—',
        'status bar meta': document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content') ?? '—',
      });
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return (
    <div className="stack g4">
      {Object.entries(info).map(([k, v]) => <div key={k} className="row between t-13"><span className="muted">{k}</span><span className="num">{v}</span></div>)}
    </div>
  );
}
