import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { useLogger } from '../hooks/useLogger';

const HIDE = /^\/(log|water|settings|recap|search|day|train\/session|train\/gym-map)/;

export function TabBar() {
  const { pathname } = useLocation();
  const { quick } = useLogger();
  if (HIDE.test(pathname)) return null;
  const tab = (to: string, icon: string, label: string, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
      <Icon name={icon} size={22} />{label}
    </NavLink>
  );
  return (
    <nav className="glass-btn tabbar" aria-label="Tabs">
      <button type="button" className="glass-btn fab" aria-label="Quick log" onClick={() => quick()}>
        <Icon name="plus" size={28} sw={2.6} color="#fff" />
      </button>
      {tab('/', 'today', 'Today', true)}
      {tab('/train', 'train', 'Train')}
      <div aria-hidden="true" />
      {tab('/eat', 'eat', 'Eat')}
      {tab('/stats', 'stats', 'Stats')}
    </nav>
  );
}
