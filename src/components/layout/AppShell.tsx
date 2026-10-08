import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { TopNav } from '@/components/TopNav';
import { CopilotFloatingButton } from '@/components/copilot/CopilotFloatingButton';
import { CopilotMobileCapsule } from '@/components/copilot/CopilotMobileCapsule';
import { CopilotSidebar } from '@/components/copilot/CopilotSidebar';
import { useCopilotContext } from '@/hooks/useCopilotContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { isCalendarRoute } from '@/lib/navigation';

const MD_QUERY = '(min-width: 48rem)';
const LG_QUERY = '(min-width: 64rem)';

export const AppShell: React.FC = () => {
  const { pathname } = useLocation();
  const { open, close } = useCopilotContext();
  const isMdUp = useMediaQuery(MD_QUERY);
  const isLgUp = useMediaQuery(LG_QUERY);
  const calendarRoute = isCalendarRoute(pathname);
  const calendarDesktop = calendarRoute && isLgUp;
  const processedPath = useRef<string | null>(null);

  // Rebuild the entry shape when changing routes, but do not overwrite a
  // deliberate expanded/collapsed state merely because a viewport is resized.
  useEffect(() => {
    if (processedPath.current === pathname) return;
    processedPath.current = pathname;

    if (calendarDesktop) {
      open();
    } else {
      close();
    }
  }, [pathname, calendarDesktop, open, close]);

  const showCapsule = calendarRoute ? !isLgUp : !isMdUp;
  const showFab = !calendarRoute && isMdUp;
  const useOverlayDrawer = !calendarDesktop;

  return (
    <div className="app-shell">
      <TopNav />
      {showCapsule && (
        <div className="app-container app-shell__copilot-entry">
          <CopilotMobileCapsule />
        </div>
      )}
      <main className="app-shell__content">
        <Outlet />
      </main>
      <BottomNav />
      {showFab && <CopilotFloatingButton />}
      {useOverlayDrawer && <CopilotSidebar />}
    </div>
  );
};
