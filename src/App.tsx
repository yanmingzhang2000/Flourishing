import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from '@/pages/AuthPage';
import { ProjectSelectionPage } from '@/pages/ProjectSelectionPage';
import { IntakePage } from '@/pages/IntakePage';
import { CalendarPage } from '@/pages/CalendarPage';
import { DayWorkoutPage } from '@/pages/DayWorkoutPage';
import { ExerciseDetailPage } from '@/pages/ExerciseDetailPage';
import { ProfilePage } from '@/pages/ProfilePage';
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
        {/* 首次引导：填训练偏好 */}
        <Route path="/intake" element={<RequireAuth><IntakePage /></RequireAuth>} />
        {/* 选训练项目（引导完成后 or 修改计划时） */}
        <Route path="/" element={<RequireAuth><ProjectSelectionPage /></RequireAuth>} />
        {/* 主 Tab：日历 */}
        <Route path="/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
        {/* 主 Tab：个人 */}
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        {/* 训练详情 */}
        <Route path="/workout/:date/:dayIndex" element={<RequireAuth><DayWorkoutPage /></RequireAuth>} />
        <Route path="/exercise/:exerciseId" element={<RequireAuth><ExerciseDetailPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;