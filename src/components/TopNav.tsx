import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCalendarNavigationTarget, isCalendarRoute, isProjectRoute } from '@/lib/navigation';

export const TopNav: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const calendarTarget = getCalendarNavigationTarget(pathname);

  const items = [
    { label: '我的训练', path: '/', active: pathname === '/' },
    { label: '项目', path: '/projects', active: isProjectRoute(pathname) },
    { label: '日历', path: calendarTarget, active: isCalendarRoute(pathname) },
    { label: '我的', path: '/profile', active: pathname === '/profile' || pathname.startsWith('/settings') },
  ];

  return (
    <header className="app-top-nav">
      <nav className="app-container app-top-nav__content" aria-label="主导航">
        <button className="app-top-nav__brand" onClick={() => navigate('/')} aria-label="返回我的训练">
          Flourish AI
        </button>
        <div className="app-top-nav__links" role="list">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.path)}
              aria-current={item.active ? 'page' : undefined}
              className={`app-top-nav__link ${item.active ? 'app-top-nav__link--active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
};
