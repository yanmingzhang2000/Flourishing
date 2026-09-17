import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const tabs = [
    {
      key: 'home',
      label: '主页',
      path: '/',
      // 匹配首页 / 和所有项目相关路由
      matchPaths: ['/', '/projects'],
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      key: 'profile',
      label: '我的',
      path: '/profile',
      matchPaths: ['/profile', '/settings'],
      icon: (active: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  const isActive = (tab: typeof tabs[0]) =>
    tab.matchPaths.some(p => {
      if (p === '/') return pathname === '/';
      return pathname === p || pathname.startsWith(p + '/');
    });

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50">
      <div className="max-w-md mx-auto flex">
        {tabs.map(tab => {
          const active = isActive(tab);
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                active ? 'text-[#7DC47A]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.icon(active)}
              <span className={`text-xs ${active ? 'font-semibold' : 'font-normal'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
