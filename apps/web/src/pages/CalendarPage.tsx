import type { PlanDay, TrainingRecord } from '@flourish/contracts';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useActivePlan, useTrainingRecords } from '@/api/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  addDaysIso,
  formatMonthDay,
  formatMonthDayLong,
  formatWeekday,
  localToday,
} from '@/lib/dates';

const WEEK_WINDOW_DAYS = 7; // a WeeklyPlan covers startDate..startDate+6

const FEEDBACK_LABELS: Record<string, string> = {
  too_hard: '太难',
  just_right: '刚好',
  too_easy: '太轻松',
};

/** The 7 consecutive dates of a plan week (plan.startDate..+6). */
function planWeekDates(startDate: string): string[] {
  return Array.from({ length: WEEK_WINDOW_DAYS }, (_, i) => addDaysIso(startDate, i));
}

function shortDate(iso: string): string {
  return formatMonthDay(iso);
}

interface DayCellProps {
  date: string;
  planDay: PlanDay | null;
  completed: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (date: string) => void;
}

function DayCell({ date, planDay, completed, isToday, isSelected, onSelect }: DayCellProps) {
  const kind = planDay ? '训练日' : '休息日';
  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-label={`${formatMonthDayLong(date)} ${kind}${completed ? ' 已完成' : ''}`}
      aria-pressed={isSelected}
      className={cn(
        'flex min-h-[84px] flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors',
        isSelected
          ? 'border-primary bg-primary-soft'
          : 'border-border bg-background hover:border-primary/40 hover:bg-border/30',
        planDay ? 'text-foreground' : 'text-muted',
      )}
    >
      <span className={cn('text-xs', isToday ? 'font-semibold text-accent' : 'text-muted')}>
        {formatWeekday(date)}
      </span>
      <span className="text-sm font-medium">{shortDate(date)}</span>
      {planDay ? (
        <span className="mt-0.5 flex flex-col items-center gap-0.5 text-[11px] leading-tight text-muted">
          <span>{planDay.exercises.length} 个动作</span>
          <span>{planDay.estimatedDurationMinutes} 分钟</span>
        </span>
      ) : (
        <span className="mt-0.5 text-[11px] text-muted">休息</span>
      )}
      {completed ? (
        <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-medium text-foreground">
          <Check size={11} aria-hidden />
          已完成
        </span>
      ) : null}
    </button>
  );
}

function RecordSummary({ record }: { record: TrainingRecord }) {
  return (
    <p className="mt-3 rounded-lg border border-border bg-background p-3 text-sm text-muted">
      <span className="font-medium text-foreground">本次记录：</span>
      {record.durationMinutes !== null ? `时长 ${record.durationMinutes} 分钟 · ` : ''}
      {record.feedback ? `感受 ${FEEDBACK_LABELS[record.feedback] ?? record.feedback}` : '未填写感受'}
      {record.notes ? <span className="mt-1 block text-xs">备注：{record.notes}</span> : null}
    </p>
  );
}

function HistoryList({ records }: { records: TrainingRecord[] }) {
  if (records.length === 0) {
    return <p className="text-sm text-muted">还没有训练记录，完成第一次训练后会出现在这里。</p>;
  }
  const visible = records.slice(0, 20);
  return (
    <>
      <ul className="mt-4 space-y-2">
        {visible.map((record) => (
          <li
            key={record.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <span className="font-medium text-foreground">
              {formatMonthDayLong(record.date)}
            </span>
            {record.durationMinutes !== null ? (
              <span className="text-muted">{record.durationMinutes} 分钟</span>
            ) : null}
            {record.feedback ? (
              <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">
                {FEEDBACK_LABELS[record.feedback] ?? record.feedback}
              </span>
            ) : null}
            {record.notes ? <span className="text-xs text-muted">{record.notes}</span> : null}
          </li>
        ))}
      </ul>
      {records.length > visible.length ? (
        <p className="mt-2 text-xs text-muted">仅显示最近 {visible.length} 条记录。</p>
      ) : null}
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-surface p-8" data-testid="calendar-skeleton">
      <div className="h-5 w-28 rounded bg-border" />
      <div className="mt-6 grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-20 rounded-lg bg-border" />
        ))}
      </div>
      <div className="mt-6 h-32 rounded-lg bg-border" />
    </div>
  );
}

export function CalendarPage() {
  const [cursorDate, setCursorDate] = useState(() => localToday());
  const [selectedDate, setSelectedDate] = useState(() => localToday());

  const planQuery = useActivePlan(cursorDate);
  const recordsQuery = useTrainingRecords();

  const recordByDate = useMemo(() => {
    const map = new Map<string, TrainingRecord>();
    for (const record of recordsQuery.data ?? []) {
      // Server returns newest first; first occurrence wins.
      if (!map.has(record.date)) map.set(record.date, record);
    }
    return map;
  }, [recordsQuery.data]);

  const plan = planQuery.data?.plan ?? null;
  const weekDates = plan ? planWeekDates(plan.startDate) : [];
  const planDayByDate = useMemo(() => {
    const map = new Map<string, PlanDay>();
    for (const day of plan?.days ?? []) map.set(day.date, day);
    return map;
  }, [plan]);

  const selectedPlanDay = planDayByDate.get(selectedDate) ?? null;
  const selectedRecord = recordByDate.get(selectedDate) ?? null;

  const gotoWeek = (anchor: string) => {
    setCursorDate(anchor);
    setSelectedDate(anchor);
  };

  let body: ReactNode;
  if (planQuery.isLoading || recordsQuery.isLoading) {
    body = <PageSkeleton />;
  } else if (planQuery.isError && recordsQuery.isError) {
    body = (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="font-medium text-danger">加载失败</h2>
        <p className="mt-2 text-sm text-muted">网络或服务异常，请稍后重试。</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => {
            void planQuery.refetch();
            void recordsQuery.refetch();
          }}
        >
          <RefreshCw size={15} aria-hidden className="mr-1.5" />
          重试
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-surface p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                {plan
                  ? `${formatMonthDayLong(plan.startDate)} – ${formatMonthDayLong(weekDates[6] ?? plan.startDate)}`
                  : '本周未排期'}
              </h2>
              {plan ? (
                <p className="mt-0.5 text-sm text-muted">
                  {plan.days.length} 个训练日 · 其余为休息日
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => gotoWeek(addDaysIso(cursorDate, -WEEK_WINDOW_DAYS))}
                aria-label="上一周"
              >
                <ChevronLeft size={15} aria-hidden />
                上一周
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => gotoWeek(addDaysIso(cursorDate, WEEK_WINDOW_DAYS))}
                aria-label="下一周"
              >
                下一周
                <ChevronRight size={15} aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => gotoWeek(localToday())}
                aria-label="回到今天"
              >
                <RotateCcw size={15} aria-hidden />
                今天
              </Button>
            </div>
          </div>

          {plan ? (
            <div
              className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7"
              role="group"
              aria-label="本周训练安排"
            >
              {weekDates.map((date) => {
                const planDay = planDayByDate.get(date) ?? null;
                const record = recordByDate.get(date);
                return (
                  <DayCell
                    key={date}
                    date={date}
                    planDay={planDay}
                    completed={!!record?.completed}
                    isToday={date === localToday()}
                    isSelected={date === selectedDate}
                    onSelect={setSelectedDate}
                  />
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted">该日期所在周没有训练计划。</p>
              <Link
                to="/training"
                className="mt-3 inline-block text-sm font-medium text-brand-ink hover:underline"
              >
                去生成计划
              </Link>
            </div>
          )}

          {plan?.adjustment ? (
            <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm leading-relaxed text-accent">
              本次调整：{plan.adjustment.explanation}
            </p>
          ) : null}
        </section>

        {plan ? (
          <section className="rounded-xl border border-border bg-surface p-5 shadow-soft">
            <h2 className="text-sm font-medium text-muted">
              {formatMonthDayLong(selectedDate)}（{formatWeekday(selectedDate)}）
              {selectedPlanDay ? ' · 训练日' : ' · 休息日'}
            </h2>
            {selectedPlanDay ? (
              <div className="mt-3">
                <p className="text-sm text-muted">
                  预计 {selectedPlanDay.estimatedDurationMinutes} 分钟 ·{' '}
                  {selectedPlanDay.exercises.length} 个动作
                </p>
                {selectedPlanDay.recommendReason ? (
                  <p className="mt-1 text-sm text-muted">{selectedPlanDay.recommendReason}</p>
                ) : null}
                <ul className="mt-3 space-y-1.5">
                  {selectedPlanDay.exercises.map((exercise) => (
                    <li
                      key={exercise.exerciseId}
                      className="flex flex-wrap items-baseline gap-x-2 text-sm"
                    >
                      <span className="font-medium text-foreground">{exercise.name}</span>
                      <span className="text-xs text-muted">
                        {exercise.sets} 组 × {exercise.reps ?? `${exercise.durationSeconds} 秒`}
                        {' · 难度 '}
                        {exercise.difficulty}/5
                      </span>
                    </li>
                  ))}
                </ul>
                {selectedRecord && selectedRecord.completed ? (
                  <RecordSummary record={selectedRecord} />
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">休息日，好好恢复。</p>
            )}
          </section>
        ) : null}

        <section className="rounded-xl border border-border bg-surface p-5 shadow-soft">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <History size={14} aria-hidden />
            训练历史
          </h2>
          <HistoryList records={recordsQuery.data ?? []} />
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
          <CalendarDays size={13} aria-hidden />
          日历与历史
        </span>
      </header>
      {body}
    </div>
  );
}
