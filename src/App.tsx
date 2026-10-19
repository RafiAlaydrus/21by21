import { Suspense, lazy, useEffect, useRef } from 'react';
import { usePullToRefresh } from './hooks/usePullToRefresh';
import { checkForUpdate } from './lib/update';
import { useToast } from './components/Toast';
import { HashRouter, useLocation } from 'react-router-dom';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { ToastProvider } from './components/Toast';
import { TabBar } from './components/TabBar';
import { AppRoutes } from './routes';
import { DataProvider, useData } from './hooks/useData';
import { LogHost } from './screens/log/LogHost';

const Onboarding = lazy(() => import('./screens/onboarding/Onboarding'));
const WakeUp = lazy(() => import('./screens/sleep/WakeUp'));

// pull-to-refresh only on the four tab screens, so it can never discard a half-filled form or a running session
const PTR_ROUTES = ['/', '/train', '/eat', '/stats'];

function Shell() {
  const ref = useRef<HTMLElement>(null);
  const ind = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const toast = useToast();
  useEffect(() => { ref.current?.scrollTo(0, 0); }, [pathname]);
  const phase = usePullToRefresh(ref, ind, PTR_ROUTES.includes(pathname), async () => {
    const r = await checkForUpdate();
    if (r === 'updated' || r === 'none') { window.location.reload(); await new Promise(() => undefined); }
    toast(r === 'current' ? 'Up to date' : 'Can’t check for updates offline');
  });
  const label = phase === 'busy' ? 'Checking for updates…' : phase === 'ready' ? 'Release to update' : 'Pull to update';
  return (
    <>
      <div className="ptr" ref={ind} aria-hidden="true"><span className={`ptr-spin ${phase === 'busy' ? 'spin' : ''}`} />{label}</div>
      <main className="app-main" ref={ref}>
        <Suspense fallback={null}><AppRoutes /></Suspense>
      </main>
      <TabBar />
    </>
  );
}

function Gate() {
  const { onboarded, activeSleep } = useData();
  useEffect(() => { try { void navigator.storage?.persist?.(); } catch { /* not supported */ } }, []);
  // while a sleep is active the whole app is just the Wake Up screen, whatever the route
  if (activeSleep) return <Suspense fallback={null}><WakeUp /></Suspense>;
  if (!onboarded) return <main className="app-main"><Suspense fallback={null}><Onboarding /></Suspense></main>;
  return <LogHost><Shell /></LogHost>;
}

export function App() {
  return (
    <HashRouter>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          <ToastProvider>
            <DataProvider fallback={<div className="load-screen" />}>
              <Gate />
            </DataProvider>
          </ToastProvider>
        </LazyMotion>
      </MotionConfig>
    </HashRouter>
  );
}
