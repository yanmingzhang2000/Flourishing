import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Link, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { PlaceholderPage } from './pages/PlaceholderPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'training',
        element: (
          <PlaceholderPage
            title="我的训练"
            note="训练项目、动作库、计划调整与动作示范将在此接入（训练域核心任务）。"
          />
        ),
      },
      {
        path: 'calendar',
        element: (
          <PlaceholderPage
            title="日历"
            note="周/月视图、排期与历史回顾将在此接入（日历与历史任务）。"
          />
        ),
      },
      {
        path: 'profile',
        element: <PlaceholderPage title="我的" note="训练资料、目标与账号设置将在此接入。" />,
      },
      {
        path: 'workout/today',
        element: (
          <PlaceholderPage
            title="跟练"
            note="动作步骤、计时与安全反馈将在此接入（跟练闭环任务）。"
          />
        ),
      },
      {
        path: '*',
        element: (
          <div className="py-16 text-center">
            <p className="text-sm text-muted">404 · 页面不存在</p>
            <Link to="/" className="mt-3 inline-block text-sm font-medium text-brand-ink hover:underline">
              返回今日训练
            </Link>
          </div>
        ),
      },
    ],
  },
]);

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
