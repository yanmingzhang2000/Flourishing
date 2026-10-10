import { Sparkles, Leaf } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: '今日', end: true },
  { to: '/training', label: '我的训练', end: false },
  { to: '/calendar', label: '日历', end: false },
  { to: '/profile', label: '我的', end: false },
];

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <a href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-foreground">
            <Leaf size={18} aria-hidden />
          </span>
          <span className="hidden text-base font-semibold tracking-wide sm:inline">Flourish AI</span>
        </a>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3',
                  isActive
                    ? 'bg-primary-soft font-medium text-brand-ink'
                    : 'text-muted hover:bg-border/60 hover:text-foreground',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          disabled
          title="AI 教练将在 AI Copilot 任务中接入"
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-muted opacity-70 sm:px-3"
        >
          <Sparkles size={16} aria-hidden />
          <span className="hidden sm:inline">AI 教练</span>
        </button>
      </div>
    </header>
  );
}
