import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Btn, Card, Chip, DateField, Page } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { useData } from '../../hooks/useData';
import { buildReport } from '../../logic/report';
import { addDays, weekStart } from '../../logic/dates';
import { C } from '../../theme';

/** Weekly check-in report as plain Markdown (PLAN §8): copy or share, then paste it wherever you like. */
export default function Report() {
  const d = useData();
  const toast = useToast();
  const [sp] = useSearchParams();
  const c = d.settings.challenge;
  const ws = weekStart(d.today);
  const [from, setFrom] = useState(sp.get('range') === 'all' ? c.startDate : ws);
  const [to, setTo] = useState(sp.get('range') === 'all' ? c.endDate : d.today);
  const text = useMemo(() => (from <= to ? buildReport(d, from, to, d.today) : 'The start date is after the end date.'), [d, from, to]);

  const preset = (a: string, b: string) => { setFrom(a); setTo(b); };
  return (
    <Page title="Report" sub="Plain text, from what you logged" glows={[{ color: C.blue, top: -40, right: -100, opacity: 0.16 }]}>
      <div className="chips-scroll">
        <Chip sm onClick={() => preset(ws, d.today)}>This week</Chip>
        <Chip sm onClick={() => preset(addDays(ws, -7), addDays(ws, -1))}>Last week</Chip>
        <Chip sm onClick={() => preset(c.startDate, c.endDate < d.today ? c.endDate : d.today)}>Whole challenge</Chip>
      </div>
      <div className="grid2"><DateField label="From" value={from} onChange={setFrom} /><DateField label="To" value={to} onChange={setTo} /></div>
      <div className="grid2">
        <Btn tint={C.green} tintA={0.4} onClick={async () => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Copy is not available here'); } }}>Copy</Btn>
        <Btn onClick={async () => { try { if (navigator.share) await navigator.share({ title: '21 by 21 report', text }); else { await navigator.clipboard.writeText(text); toast('Copied'); } } catch { /* cancelled */ } }}>Share</Btn>
      </div>
      <Card><pre className="num t-13" style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.5}}>{text}</pre></Card>
    </Page>
  );
}
