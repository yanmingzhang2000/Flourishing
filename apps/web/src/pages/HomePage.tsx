import { useMemo, type ReactNode } from 'react';
import type { Exercise } from '@flourish/contracts';
import { Link } from 'react-router-dom';
import { CalendarDays, Moon, RefreshCw } from 'lucide-react';
import { useExercises, useTodayPlan } from '@/api/today';
import { TodayWorkoutCard } from '@/components/home/TodayWorkoutCard';
import { WeekProgressCard } from '@/components/home/WeekProgressCard';
import { Button } from '@/components/ui/button';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return '早上好';
  if (hour < 13) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function dateLine(): string {
  return new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-surface p-6" data-testid="today-skeleton">
      <div className="h-4 w-24 rounded bg-border" />
      <div className="mt-4 h-4 w-3/4 rounded bg-border" />
      <div className="mt-6 space-y-4">
        <div className="h-14 w-full rounded-md bg-border" />
        <div className="h-14 w-full rounded-md bg-border" />
        <div className="h-14 w-full rounded-md bg-border" />
      </div>
      <div className="mt-6 h-12 w-full rounded-lg bg-border" />
    </div>
  );
}

export function HomePage() {
  const todayQuery = useTodayPlan();
  const libraryQuery = useExercises();

  const exerciseMap = useMemo(() => {
    const map: Record<string, Exercise> = {};
    for (const exercise of libraryQuery.data?.exercises ?? []) {
      map[exercise.exerciseId] = exercise;
    }
    return map;
  }, [libraryQuery.data]);

  const data = todayQuery.data;

  let mainContent: ReactNode;
  if (todayQuery.isLoading) {
    mainContent = <CardSkeleton />;
  } else if (todayQuery.isError) {
    mainContent = (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="font-medium text-danger">今日训练加载失败</h2>
        <p className="mt-2 text-sm text-muted">网络或服务异常，请稍后重试。</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => void todayQuery.refetch()}
        >
          <RefreshCw size={15} aria-hidden />
          重试
        </Button>
      </div>
    );
  } else if (data?.plan && data.today) {
    mainContent = <TodayWorkoutCard day={data.today} exerciseMap={exerciseMap} />;
  } else if (data?.plan && !data.today) {
    const nextDate = data.plan.days.find((day) => day.date > localToday());
    mainContent = (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
          <Moon size={13} aria-hidden />
          休息日
        </span>
        <h2 className="mt-3 text-xl font-semibold">今天是休息日</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          恢复也是训练的一部分。{nextDate ? `下一次安排在 ${nextDate.date}。` : '本周安排已全部完成。'}
        </p>
        <Link
          to="/calendar"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <CalendarDays size={15} aria-hidden />
          查看本周安排
        </Link>
      </div>
    );
  } else {
    mainContent = (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="text-xl font-semibold">还没有训练计划</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          确定性计划引擎接入后，打开页面即可获得为你生成的今日安排。
        </p>
        <Link
          to="/training"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <CalendarDays size={15} aria-hidden />
          去我的训练
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm text-muted">{dateLine()}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
          {greeting()}，今天练什么？
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">{mainContent}</div>
        <aside className="flex flex-col gap-4">
          {data?.weekProgress ? (
            <WeekProgressCard progress={data.weekProgress} />
          ) : (
            <div className="animate-pulse rounded-xl border border-border bg-surface p-5">
              <div className="h-4 w-20 rounded bg-border" />
              <div className="mt-3 h-8 w-28 rounded bg-border" />
              <div className="mt-3 h-2 w-full rounded-full bg-border" />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
