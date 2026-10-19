import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

const Today = lazy(() => import('./screens/today/Today'));
const Water = lazy(() => import('./screens/water/Water'));
const Eat = lazy(() => import('./screens/eat/Eat'));
const LogMeal = lazy(() => import('./screens/eat/LogMeal'));
const MealDetail = lazy(() => import('./screens/eat/MealDetail'));
const Gallery = lazy(() => import('./screens/eat/Gallery'));
const Library = lazy(() => import('./screens/eat/Library'));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/water" element={<Water />} />
      <Route path="/eat" element={<Eat />} />
      <Route path="/eat/meal/:id" element={<MealDetail />} />
      <Route path="/eat/gallery" element={<Gallery />} />
      <Route path="/eat/library" element={<Library />} />
      <Route path="/log/meal" element={<LogMeal />} />
      <Route path="*" element={<Today />} />
    </Routes>
  );
}
