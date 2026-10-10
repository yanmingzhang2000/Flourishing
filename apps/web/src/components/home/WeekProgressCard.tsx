import type { WeekProgress } from '@flourish/contracts';
import { Check } from 'lucide-react';

interface WeekProgressCardProps {
  progress: WeekProgress;
}

function shortDate(iso: string): string {
  const parts = iso.split('-');
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

export function WeekProgressCard({ progress }: WeekProgressCardProps) {
  const ratio =
    progress.scheduled > 0 ? Math.min(progress.completed / progress.scheduled, 1) : 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-soft">
      <h2 className="text-sm font-medium text-muted">本周进度</h2>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold text-foreground">{progress.completed}</span>
        <span className="text-lg text-muted">/ {progress.scheduled} 次</span>
      </p>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={progress.completed}
        aria-valuemin={0}
        aria-valuemax={progress.scheduled}
        aria-label="本周训练进度"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${ratio * 100}%` }} />
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {progress.days.map((day) => (
          <li
            key={day.date}
            className={[
              'flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
              day.completed
                ? 'border-primary bg-primary-soft text-brand-ink'
                : day.isToday
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border text-muted',
            ].join(' ')}
          >
            {day.completed && <Check size={12} aria-hidden />}
            {shortDate(day.date)}
            {day.isToday && !day.completed && ' · 今天'}
          </li>
        ))}
      </ul>
    </section>
  );
}
