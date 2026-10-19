import { Suspense, useEffect, useRef } from 'react';
import { HashRouter, useLocation } from 'react-router-dom';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import { ToastProvider } from './components/Toast';
import { TabBar } from './components/TabBar';
import { AppRoutes } from './routes';

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

export function App() {
  return (
    <HashRouter>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </LazyMotion>
      </MotionConfig>
    </HashRouter>
  );
}
