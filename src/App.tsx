import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from '@/pages/AuthPage';
import { DisclaimerPage } from '@/pages/DisclaimerPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { MyProjectsPage } from '@/pages/MyProjectsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { ProjectStartPage } from '@/pages/ProjectStartPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { DayWorkoutPage } from '@/pages/DayWorkoutPage';
import { ExerciseDetailPage } from '@/pages/ExerciseDetailPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { isLoggedIn } from '@/lib/api';
import { storage } from '@/lib/storage';

// ── 路由守卫 ─────────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const profile = storage.getUserProfile();
  if (profile && !profile.onboardingCompleted && !profile.experience) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        {/* 认证 */}
        <Route path="/auth" element={<AuthPage />} />
        
        {/* 免责声明（公开访问） */}
        <Route path="/disclaimer" element={<DisclaimerPage />} />

        {/* 首次引导：填训练偏好（onboarding 模式） */}
        <Route path="/onboarding" element={
          <RequireAuth><SettingsPage onboarding /></RequireAuth>
        } />

        {/* 设置页（普通模式） */}
        <Route path="/settings" element={
          <RequireAuth><SettingsPage /></RequireAuth>
        } />

        {/* 首页：我的训练列表 */}
        <Route path="/" element={
          <RequireAuth><RequireOnboarding><MyProjectsPage /></RequireOnboarding></RequireAuth>
        } />

        {/* 项目浏览 */}
        <Route path="/projects" element={
          <RequireAuth><ProjectsPage /></RequireAuth>
        } />

        {/* 项目启动配置（projectId = 项目类型 ID，如 tricep_tone） */}
        <Route path="/projects/:projectId/start" element={
          <RequireAuth><ProjectStartPage /></RequireAuth>
        } />

        {/* V2 项目日历（instanceId = 数据库实例 ID，数字） */}
        <Route path="/projects/:instanceId/calendar" element={
          <RequireAuth><CalendarPage /></RequireAuth>
        } />

        {/* V2 训练页（带 instanceId） */}
        <Route path="/workout/:instanceId/:date/:dayIndex" element={
          <RequireAuth><DayWorkoutPage /></RequireAuth>
        } />

        {/* 旧版全局日历（向后兼容游客 / 旧链接） */}
        <Route path="/calendar" element={
          <RequireAuth><CalendarPage /></RequireAuth>
        } />

        {/* 旧版训练页（无 instanceId，向后兼容） */}
        <Route path="/workout/:date/:dayIndex" element={
          <RequireAuth><DayWorkoutPage /></RequireAuth>
        } />

        {/* 旧版引导链接 */}
        <Route path="/intake" element={<Navigate to="/onboarding" replace />} />

        {/* 动作详情 */}
        <Route path="/exercise/:exerciseId" element={
          <RequireAuth><ExerciseDetailPage /></RequireAuth>
        } />

        {/* 个人页 */}
        <Route path="/profile" element={
          <RequireAuth><ProfilePage /></RequireAuth>
        } />

        {/* 兜底 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
