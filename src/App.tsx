import { Suspense, lazy, useEffect, useRef } from 'react';
import { HashRouter, useLocation } from 'react-router-dom';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { ToastProvider } from './components/Toast';
import { TabBar } from './components/TabBar';
import { AppRoutes } from './routes';
import { DataProvider, useData } from './hooks/useData';
import { LogHost } from './screens/log/LogHost';

const Onboarding = lazy(() => import('./screens/onboarding/Onboarding'));
const WakeUp = lazy(() => import('./screens/sleep/WakeUp'));

function Shell() {
  const ref = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => { ref.current?.scrollTo(0, 0); }, [pathname]);
  return (
    <>
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
