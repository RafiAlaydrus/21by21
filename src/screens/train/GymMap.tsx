import { useEffect, useRef, useState } from 'react';
import { Page } from '../../components/ui';
import { useData } from '../../hooks/useData';
import { C } from '../../theme';

/** Leaflet is imported lazily here, so it only loads when this optional screen opens. */
export default function GymMap() {
  const { gyms, workouts } = useData();
  const el = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(false);
  const pts = gyms.filter((g) => g.lat != null && g.lng != null);

  useEffect(() => {
    if (!el.current || pts.length === 0) return;
    let map: import('leaflet').Map | undefined;
    let alive = true;
    (async () => {
      try {
        const [L] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
        if (!alive || !el.current) return;
        map = L.map(el.current, { zoomControl: true, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
        const bounds = L.latLngBounds([]);
        for (const g of pts) {
          const count = workouts.filter((w) => w.gymId === g.id).length;
          const icon = L.divIcon({ className: '', html: `<div style="transform:translate(-50%,-100%);background:${C.red};color:#fff;font:600 12px system-ui;padding:4px 8px;border-radius:10px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.5)">${g.name.replace(/</g, '&lt;')} · ${count}</div>`, iconSize: [0, 0] });
          L.marker([g.lat!, g.lng!], { icon }).addTo(map);
          bounds.extend([g.lat!, g.lng!]);
        }
        map.fitBounds(bounds.pad(0.4), { maxZoom: 14 });
      } catch { setErr(true); }
    })();
    return () => { alive = false; map?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts.length]);

  return (
    <Page title="Gym map" sub="OpenStreetMap" noTabs glows={[{ color: C.cyan, top: -40, right: -100, opacity: 0.14 }]}>
      {pts.length === 0 ? <div className="empty"><div className="b600">No gym locations saved</div><div className="t-13 muted">Open a gym and tap “Use current location”.</div></div>
        : <div ref={el} style={{ height: 'min(60vh, 520px)', width: '100%' }} aria-label="Map of gyms" role="img" />}
      {err && <div className="t-13 muted">Map tiles need a connection. Everything else works offline.</div>}
    </Page>
  );
}
