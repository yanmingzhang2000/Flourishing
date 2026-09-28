import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from '@/pages/AuthPage';
import { MyProjectsPage } from '@/pages/MyProjectsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { ProjectStartPage } from '@/pages/ProjectStartPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { DayWorkoutPage } from '@/pages/DayWorkoutPage';
import { ExerciseDetailPage } from '@/pages/ExerciseDetailPage';
import { isLoggedIn } from '@/lib/api';
import { storage } from '@/lib/storage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const profile = storage.getUserProfile();
  if (profile && !profile.onboardingCompleted && !profile.experience) {
    return <Navigate to="/settings" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        {/* V2 Routes */}
        <Route path="/" element={<RequireAuth><RequireOnboarding><MyProjectsPage /></RequireOnboarding></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/projects" element={<RequireAuth><ProjectsPage /></RequireAuth>} />
        <Route path="/projects/:id/start" element={<RequireAuth><ProjectStartPage /></RequireAuth>} />
        <Route path="/projects/:projectId/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
        <Route path="/workout/:projectId/:date/:dayIndex" element={<RequireAuth><DayWorkoutPage /></RequireAuth>} />
        <Route path="/exercise/:exerciseId" element={<RequireAuth><ExerciseDetailPage /></RequireAuth>} />
        {/* Legacy routes - redirect to V2 */}
        <Route path="/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
        <Route path="/workout/:date/:dayIndex" element={<RequireAuth><DayWorkoutPage /></RequireAuth>} />
        <Route path="/intake" element={<Navigate to="/settings" replace />} />
        <Route path="/profile" element={<Navigate to="/settings" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
