import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProjectSelectionPage } from '@/pages/ProjectSelectionPage';
import { IntakePage } from '@/pages/IntakePage';
import { CalendarPage } from '@/pages/CalendarPage';
import { DayWorkoutPage } from '@/pages/DayWorkoutPage';
import { ExerciseDetailPage } from '@/pages/ExerciseDetailPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ProjectSelectionPage />} />
        <Route path="/intake" element={<IntakePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/workout/:date/:dayIndex" element={<DayWorkoutPage />} />
        <Route path="/exercise/:exerciseId" element={<ExerciseDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;