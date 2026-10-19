import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

const Today = lazy(() => import('./screens/today/Today'));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="*" element={<Today />} />
    </Routes>
  );
}
