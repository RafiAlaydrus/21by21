import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

const Today = lazy(() => import('./screens/today/Today'));
const Water = lazy(() => import('./screens/water/Water'));
const Eat = lazy(() => import('./screens/eat/Eat'));
const LogMeal = lazy(() => import('./screens/eat/LogMeal'));
const MealDetail = lazy(() => import('./screens/eat/MealDetail'));
const Gallery = lazy(() => import('./screens/eat/Gallery'));
const Library = lazy(() => import('./screens/eat/Library'));
const Train = lazy(() => import('./screens/train/Train'));
const Session = lazy(() => import('./screens/train/Session'));
const History = lazy(() => import('./screens/train/History'));
const PRWall = lazy(() => import('./screens/train/PRWall'));
const Exercises = lazy(() => import('./screens/train/Exercises'));
const ExerciseDetail = lazy(() => import('./screens/train/ExerciseDetail'));
const Gyms = lazy(() => import('./screens/train/Gyms'));
const GymMap = lazy(() => import('./screens/train/GymMap'));
const DayView = lazy(() => import('./screens/day/DayView'));
const Search = lazy(() => import('./screens/search/Search'));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/day/:dayKey" element={<DayView />} />
      <Route path="/search" element={<Search />} />
      <Route path="/water" element={<Water />} />
      <Route path="/train" element={<Train />} />
      <Route path="/train/session" element={<Session />} />
      <Route path="/train/session/:id" element={<Session />} />
      <Route path="/train/history" element={<History />} />
      <Route path="/train/prs" element={<PRWall />} />
      <Route path="/train/exercises" element={<Exercises />} />
      <Route path="/train/exercise/:id" element={<ExerciseDetail />} />
      <Route path="/train/gyms" element={<Gyms />} />
      <Route path="/train/gym-map" element={<GymMap />} />
      <Route path="/eat" element={<Eat />} />
      <Route path="/eat/meal/:id" element={<MealDetail />} />
      <Route path="/eat/gallery" element={<Gallery />} />
      <Route path="/eat/library" element={<Library />} />
      <Route path="/log/meal" element={<LogMeal />} />
      <Route path="*" element={<Today />} />
    </Routes>
  );
}
