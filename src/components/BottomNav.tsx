import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCalendarNavigationTarget, isCalendarRoute, isProjectRoute } from '@/lib/navigation';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const calendarTarget = getCalendarNavigationTarget(pathname);

  const tabs = [
    {
      key: 'home',
      label: '主页',
      path: '/',
      active: pathname === '/',
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      key: 'calendar',
      label: '日历',
      path: calendarTarget,
      active: isCalendarRoute(pathname),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: 'profile',
      label: '我的',
      path: '/profile',
      active: pathname === '/profile' || pathname.startsWith('/settings'),
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 min-h-[var(--bottom-nav-height)] bg-white border-t border-gray-100 z-40" aria-label="底部导航">
      <div className="app-container flex">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => navigate(tab.path)}
            aria-current={tab.active ? 'page' : undefined}
            className={`flex-1 min-h-11 flex flex-col items-center justify-center gap-1 py-2 transition-colors ${
              tab.active ? 'text-brand' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.icon(tab.active)}
            <span className={`text-xs ${tab.active ? 'font-semibold' : 'font-normal'}`}>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
