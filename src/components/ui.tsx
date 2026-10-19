import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode, ButtonHTMLAttributes } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { rgba } from '../theme';
import { fromLocalInput, toLocalInput } from '../logic/dates';

/* ---------- containers ---------- */
type CardProps = HTMLAttributes<HTMLElement> & { lg?: boolean; tile?: boolean; flat?: boolean; as?: 'section' | 'div' };
export function Card({ lg, tile, flat, as = 'section', className = '', children, ...rest }: CardProps) {
  const cls = `glass card ${lg ? 'lg' : ''} ${tile ? 'tile' : ''} ${flat ? 'flat' : ''} ${className}`;
  return as === 'div' ? <div className={cls} {...rest}>{children}</div> : <section className={cls} {...rest}>{children}</section>;
}

export interface GlowSpec { color: string; top: number; left?: number; right?: number; size?: number; opacity?: number }
export function Glows({ list }: { list: GlowSpec[] }) {
  // own clipped layer so the oversized glows can never widen (or let focus-scroll pan) the screen
  return (
    <div className="glows" aria-hidden="true">
      {list.map((g, i) => {
        // radial gradient instead of filter:blur(), which is repainted on every scroll frame; the box is 1.5x so the fade matches the old blur
        const size = (g.size ?? 300) * 1.5, pad = size / 6;
        return (
          <div key={i} className="glow"
            style={{ top: g.top - pad, left: g.left != null ? g.left - pad : undefined, right: g.right != null ? g.right - pad : undefined, width: size, height: size,
              background: `radial-gradient(closest-side, ${g.color}, transparent)`, opacity: g.opacity ?? 0.2 }} />
        );
      })}
    </div>
  );
}

/** Screen shell: glows + optional centred header with back button. */
export function Page({ title, sub, back = true, right, glows, noTabs, children, onBack, className = '' }: {
  title?: string; sub?: string; back?: boolean; right?: ReactNode; glows?: GlowSpec[]; noTabs?: boolean; children: ReactNode; onBack?: () => void; className?: string;
}) {
  const nav = useNavigate();
  const loc = useLocation();
  const goBack = () => (onBack ? onBack() : loc.key === 'default' ? nav('/') : nav(-1));
  return (
    <div className={`screen fade-in ${noTabs ? 'no-tabs' : ''} ${className}`}>
      {glows && <Glows list={glows} />}
      {title !== undefined && (
        <header className="hdr">
          {back ? <IconBtn icon="back" label="Back" onClick={goBack} /> : <div style={{ width: 44 }} />}
          <div className="hdr-title"><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
          {right ?? <div style={{ width: 44 }} />}
        </header>
      )}
      {children}
    </div>
  );
}

/* ---------- buttons ---------- */
export function IconBtn({ icon, label, onClick, small, className = '', style }: { icon: string; label: string; onClick?: () => void; small?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <button type="button" className={`glass-btn icon-btn ${small ? 'sm' : ''} ${className}`} aria-label={label} onClick={onClick} style={style}>
      <Icon name={icon} size={small ? 18 : 20} sw={2} />
    </button>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tint?: string; tintA?: number; sm?: boolean; block?: boolean; tight?: boolean; color?: string };
export function Btn({ tint, tintA = 0.4, sm, block, tight, color, className = '', style, type = 'button', children, ...rest }: BtnProps) {
  return (
    <button type={type} className={`glass-btn btn ${sm ? 'sm' : ''} ${block ? 'block' : ''} ${tight ? 'tight' : ''} ${className}`}
      style={{ ...(tint ? { background: rgba(tint, tintA) } : {}), ...(color ? { color } : {}), ...style }} {...rest}>
      {children}
    </button>
  );
}

export function Chip({ on, color, onClick, children, sm, className = '', ...rest }: { on?: boolean; color?: string; onClick?: () => void; children: ReactNode; sm?: boolean; className?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`glass-btn chip ${sm ? 'sm' : ''} ${on ? 'on' : ''} ${className}`}
      style={on && color ? { background: color } : undefined} {...rest}>
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function ToggleRow({ label, checked, onChange, sub }: { label: string; checked: boolean; onChange: (v: boolean) => void; sub?: string }) {
  return (
    <div className="toggle-row">
      <div className="stack"><span style={{ fontSize: 15 }}>{label}</span>{sub && <span className="t-12 muted">{sub}</span>}</div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, solid, color }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; solid?: boolean; color?: string }) {
  return (
    <div className={`glass-btn seg ${solid ? 'solid' : ''}`} role="tablist" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, ...(color ? ({ '--seg-c': color } as CSSProperties) : {}) }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- text bits ---------- */
export function Cap({ children, color, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return <div className="cap" style={{ ...(color ? { color } : {}), ...style }}>{children}</div>;
}
export function Tag({ children, color = '#fff', bg, l }: { children: ReactNode; color?: string; bg?: string; l?: boolean }) {
  return <span className={`tag ${l ? 'l' : ''}`} style={{ color, background: bg ?? rgba(color.startsWith('#') && color.length === 7 ? color : '#FFFFFF', 0.2) }}>{children}</span>;
}
export const Sep = () => <div className="sep" />;

/* ---------- inputs ---------- */
export function TextField({ label, value, onChange, placeholder, big, className = '', multiline, rows = 3, ...rest }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; big?: boolean; className?: string; multiline?: boolean; rows?: number;
} & Omit<HTMLAttributes<HTMLInputElement>, 'onChange'>) {
  return (
    <label className={`glass-btn field ${big ? 'big' : ''} ${className}`}>
      <span className="lbl">{label}</span>
      {multiline ? (
        <textarea value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...rest} />
      )}
    </label>
  );
}

export function NumField({ label, value, onChange, unit, mode = 'decimal', big, placeholder, className = '', style }: {
  label: string; value: number | undefined; onChange: (n: number | undefined) => void; unit?: string; mode?: 'decimal' | 'numeric'; big?: boolean; placeholder?: string; className?: string; style?: CSSProperties;
}) {
  const [txt, setTxt] = useState(value == null ? '' : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) { last.current = value; setTxt(value == null ? '' : String(value)); }
  }, [value]);
  return (
    <label className={`glass-btn field ${big ? 'big' : ''} ${className}`} style={style}>
      <span className="lbl">{label}</span>
      <span className="row g4" style={{ alignItems: 'baseline' }}>
        <input inputMode={mode} value={txt} placeholder={placeholder ?? ''} className="num"
          onChange={(e) => {
            const t = e.target.value.replace(',', '.');
            if (t !== '' && !/^\d*\.?\d*$/.test(t)) return;
            setTxt(t);
            const n = t === '' || t === '.' ? undefined : parseFloat(t);
            last.current = n;
            onChange(n);
          }} />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </label>
  );
}

/** HH:mm pill; the native time picker handles the wheel on iOS. */
export function TimePill({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <label className="glass-btn btn sm" style={{ gap: 8, minWidth: 90 }}>
      {label && <span className="t-12 muted">{label}</span>}
      <input type="time" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="num" style={{ width: 'auto', fontSize: 16, fontWeight: 600 }} />
    </label>
  );
}

/* ---------- progress ---------- */
export function Bar({ value, color, thick, style }: { value: number; color: string; thick?: boolean; style?: CSSProperties }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={`bar ${thick ? 'thick' : ''}`} style={{ background: rgba(color, 0.2), ...style }}>
      <i style={{ width: `${v * 100}%`, background: color }} />
    </div>
  );
}

export function SegBar({ done, total, color }: { done: number; total: number; color: string }) {
  return (
    <div className="segbar">
      {Array.from({ length: total }, (_, i) => <i key={i} style={{ background: i < done ? color : rgba(color, 0.22) }} />)}
    </div>
  );
}

export function Ring({ size, r, stroke, value, color, children, label }: { size: number; r: number; stroke: number; value: number; color: string; children?: ReactNode; label?: string }) {
  const len = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  const c = size / 2;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={rgba(color, 0.2)} strokeWidth={stroke} />
        <circle className="fill" cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - v)} transform={`rotate(-90 ${c} ${c})`} style={{ ['--len' as string]: len } as CSSProperties} />
      </svg>
      {children && <div className="ring-c">{children}</div>}
    </div>
  );
}

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return <div className="empty"><div className="t-body b600">{title}</div>{sub && <div className="t-13 muted">{sub}</div>}</div>;
}

export function PhotoBox({ url, ratio = '4 / 3', radius = 18, label, style }: { url?: string; ratio?: string; radius?: number; label?: string; style?: CSSProperties }) {
  return (
    <div className="photo-ph" style={{ aspectRatio: ratio, borderRadius: radius, ...style }}>
      {url ? <img src={url} alt={label ?? ''} /> : <span>{label}</span>}
    </div>
  );
}

export function DateField({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`glass-btn field ${className}`}>
      <span className="lbl">{label}</span>
      <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="num" />
    </label>
  );
}

/** date + time in one native picker, stored as epoch ms in offset `tz` */
export function DateTimeField({ label, value, tz, onChange }: { label: string; value: number; tz: number; onChange: (ms: number) => void }) {
  return (
    <label className="glass-btn field">
      <span className="lbl">{label}</span>
      <input type="datetime-local" value={toLocalInput(value, tz)} className="num"
        onChange={(e) => e.target.value && onChange(fromLocalInput(e.target.value, tz))} />
    </label>
  );
}
