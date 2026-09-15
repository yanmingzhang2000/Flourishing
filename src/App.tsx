import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from '@/pages/AuthPage';
import { ProjectSelectionPage } from '@/pages/ProjectSelectionPage';
import { IntakePage } from '@/pages/IntakePage';
import { CalendarPage } from '@/pages/CalendarPage';
import { DayWorkoutPage } from '@/pages/DayWorkoutPage';
import { ExerciseDetailPage } from '@/pages/ExerciseDetailPage';
import { isLoggedIn } from '@/lib/api';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<RequireAuth><ProjectSelectionPage /></RequireAuth>} />
        <Route path="/intake" element={<RequireAuth><IntakePage /></RequireAuth>} />
        <Route path="/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
        <Route path="/workout/:date/:dayIndex" element={<RequireAuth><DayWorkoutPage /></RequireAuth>} />
        <Route path="/exercise/:exerciseId" element={<RequireAuth><ExerciseDetailPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;