import type { Exercise, PlanDay } from '@flourish/contracts';
import { ArrowRight, Clock3, ShieldAlert, Dumbbell } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TodayWorkoutCardProps {
  day: PlanDay;
  exerciseMap: Record<string, Exercise>;
}

function formatMeta(day: PlanDay): string {
  return `约 ${day.estimatedDurationMinutes} 分钟 · ${day.exercises.length} 个动作`;
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`难度 ${level}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={[
            'h-1.5 w-1.5 rounded-full',
            n <= level ? 'bg-primary' : 'bg-border',
          ].join(' ')}
        />
      ))}
    </span>
  );
}

function setsMeta(sets: number, reps: string | null, durationSeconds: number | null): string {
  if (durationSeconds !== null) {
    return `${sets} 组 × ${durationSeconds} 秒`;
  }
  return `${sets} 组 × ${reps ?? ''}`;
}

export function TodayWorkoutCard({ day, exerciseMap }: TodayWorkoutCardProps) {
  const reason = day.recommendReason ?? null;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
      <header className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-brand-ink">
            今日训练
          </span>
          <span className="text-xs text-muted">{day.date}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted">
            <Clock3 size={13} aria-hidden />
            {formatMeta(day)}
          </span>
        </div>
        {reason && (
          <p className="mt-3 text-sm leading-relaxed text-foreground/80">
            <span className="font-medium text-brand-ink">推荐理由：</span>
            {reason}
          </p>
        )}
      </header>

      <ul className="divide-y divide-border">
        {day.exercises.map((snap) => {
          const exercise = exerciseMap[snap.exerciseId];
          const cover = exercise?.media?.coverImage ?? null;
          return (
            <li key={snap.exerciseId} className="flex gap-3 px-5 py-4 sm:gap-4 sm:px-6">
              {cover ? (
                <img
                  src={cover}
                  alt={snap.name}
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-md object-cover sm:h-16 sm:w-16"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary-soft text-lg font-medium text-brand-ink sm:h-16 sm:w-16">
                  {snap.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-sm font-medium sm:text-base">{snap.name}</h3>
                  <span className="text-xs text-muted">{setsMeta(snap.sets, snap.reps, snap.durationSeconds)}</span>
                  <span className="text-xs text-muted">休息 {snap.restSeconds} 秒</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <DifficultyDots level={snap.difficulty} />
                    <span className="text-xs text-muted">难度 {snap.difficulty}</span>
                  </span>
                </div>
                <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-danger">
                  <ShieldAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
                  <span>{snap.warning}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="border-t border-border px-5 py-4 sm:px-6">
        <Link
          to="/workout/today"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-medium text-foreground transition-colors hover:bg-primary-hover"
        >
          <Dumbbell size={18} aria-hidden />
          开始今天的训练
          <ArrowRight size={16} aria-hidden />
        </Link>
      </footer>
    </article>
  );
}
