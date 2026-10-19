import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

const Today = lazy(() => import('./screens/today/Today'));
const Water = lazy(() => import('./screens/water/Water'));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/water" element={<Water />} />
      <Route path="*" element={<Today />} />
    </Routes>
  );
}
