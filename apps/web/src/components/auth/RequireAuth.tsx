import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

/**
 * Gate for pages that require a logged-in session (04-SAFETY §4/§5:
 * guests must never see another user's data — the safest default is to
 * redirect to /login rather than render a page that would silently show
 * empty/guest data).
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-border" aria-label="加载中" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
