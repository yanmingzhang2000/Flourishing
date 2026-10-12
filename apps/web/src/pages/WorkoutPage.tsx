import {
  type CompleteSessionInput,
  type ExerciseSnapshot,
  type JointDiscomfortInput,
  type JointDiscomfortResponse,
  type SessionExercise,
  type TrainingFeedback,
  type WorkoutSession,
} from '@flourish/contracts';
import { INJURY_OPTION_TAG_MAP } from '@flourish/training-domain/safety';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  CircleSlash,
  Flag,
  HeartPulse,
  Loader2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useUpdateProfile } from '@/api/profile';
import { useTodayPlan } from '@/api/today';
import {
  useAbortSession,
  useCompleteSession,
  useJointDiscomfort,
  useSession,
  useSessionAction,
} from '@/api/workouts';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { localToday } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * /workout/today — the follow-along (跟练) surface.
 *
 * Safety model (04-SAFETY §2): the hard block lives in the server service
 * layer — this page NEVER decides what is safe. Reporting joint discomfort
 * hands control to POST /joint-discomfort (deterministic re-verification),
 * and completing a blocked exercise is refused by the server (409). The UI
 * only surfaces the server's decisions.
 */
const BODY_AREAS = Object.keys(INJURY_OPTION_TAG_MAP);

const SEVERITIES: { value: JointDiscomfortInput['severity']; label: string }[] = [
  { value: 'mild', label: '轻微' },
  { value: 'moderate', label: '中度' },
  { value: 'severe', label: '强烈' },
];

const FEEDBACK_OPTIONS: { value: TrainingFeedback; label: string }[] = [
  { value: 'too_easy', label: '太轻松' },
  { value: 'just_right', label: '刚好' },
  { value: 'too_hard', label: '太难' },
];

const STATUS_BADGE: Record<SessionExercise['status'], { label: string; className: string }> = {
  pending: { label: '待完成', className: 'bg-muted text-ink/70' },
  completed: { label: '已完成', className: 'bg-success/15 text-success' },
  skipped: { label: '已跳过', className: 'bg-warning/15 text-warning' },
  blocked: { label: '安全阻断', className: 'bg-danger/15 text-danger' },
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message || '请求失败，请稍后重试。';
  return '请求失败，请稍后重试。';
}

function LinkButton({
  to,
  variant,
  children,
}: {
  to: string;
  variant?: 'default' | 'outline' | 'ghost';
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(buttonVariants({ variant }))}>
      {children}
    </Link>
  );
}

function snapshotDetail(snapshot: ExerciseSnapshot): string {
  const { sets, reps, durationSeconds, restSeconds } = snapshot;
  const effort = reps ? `${sets} 组 × ${reps} 次` : `${sets} 组 × ${durationSeconds ?? 0} 秒`;
  return `${effort} · 组间休息 ${restSeconds} 秒`;
}

function SessionSummary({ session }: { session: WorkoutSession }) {
  const done = session.exercises.filter((e) => e.status === 'completed').length;
  return (
    <section className="space-y-6 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-success">
        <CheckCircle2 className="h-6 w-6" aria-hidden />
        <h2 className="text-lg font-semibold">本次训练已完成</h2>
      </div>
      <p className="text-sm text-ink/70">
        完成 {done} 个动作，记录已保存。下次生成计划时会参考你选择的难度感受。
      </p>
      <div className="flex gap-3">
        <LinkButton to="/">返回今日</LinkButton>
      </div>
    </section>
  );
}

function AbortedView() {
  return (
    <section className="space-y-6 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Flag className="h-6 w-6 text-ink/50" aria-hidden />
        <h2 className="text-lg font-semibold">本次训练已结束</h2>
      </div>
      <p className="text-sm text-ink/70">已记录的完成项会保留。随时可以调整安排后继续。</p>
      <div className="flex gap-3">
        <LinkButton to="/" variant="outline">
          返回今日
        </LinkButton>
        <LinkButton to="/training" variant="ghost">
          调整训练安排
        </LinkButton>
      </div>
    </section>
  );
}

function DiscomfortResult({
  result,
  onDismiss,
}: {
  result: JointDiscomfortResponse;
  onDismiss: () => void;
}) {
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const currentInjuries = profileQuery.data?.injuries ?? [];
  const allSynced = result.suggestedInjuryOptions.every((o) => currentInjuries.includes(o));

  return (
    <section
      className="space-y-4 rounded-xl border border-warning/40 bg-warning/5 p-5"
      aria-label="关节不适处理结果"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-warning">
          <HeartPulse className="h-5 w-5" aria-hidden />
          <h3 className="font-semibold">已停止该动作，后续安排已重新校验</h3>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-ink/50 hover:text-ink"
          aria-label="关闭不适提示"
        >
          关闭
        </button>
      </div>

      <p className="text-sm font-medium">{result.restAdvice}</p>

      {result.newlyBlocked.length > 0 ? (
        <div className="text-sm">
          <p className="mb-1 font-medium text-danger">以下动作命中禁忌，本次训练中已阻断：</p>
          <ul className="list-disc space-y-0.5 pl-5 text-ink/70">
            {result.newlyBlocked.map((b) => (
              <li key={b.exerciseId}>
                {b.name}（原因：{b.reasonTags.join('、')}）
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.alternatives.length > 0 ? (
        <div className="text-sm">
          <p className="mb-1 font-medium">可尝试的安全替代动作：</p>
          <ul className="space-y-1 text-ink/70">
            {result.alternatives.map((alt) => (
              <li key={alt.forExerciseId} className="rounded-md bg-background px-3 py-2">
                <span className="font-medium">{alt.replacement.name}</span>
                <span className="text-xs"> — {snapshotDetail(alt.replacement)}</span>
                {alt.replacement.warning ? (
                  <p className="mt-0.5 text-xs text-warning">⚠ {alt.replacement.warning}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink/50">
            替代动作按此页给出的组次自行完成；被阻断的动作无需也无法标记完成。
          </p>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-warning/20 pt-3">
        <p className="text-sm text-ink/70">
          建议将「{result.suggestedInjuryOptions.join('、')}」记入你的训练资料，
          之后生成的计划会自动避开相关动作。需要你确认后才会保存。
        </p>
        {updateProfile.isPending ? (
          <Button size="sm" variant="outline" disabled>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
            保存中…
          </Button>
        ) : updateProfile.isError ? (
          <p className="text-xs text-danger">{errorMessage(updateProfile.error)}</p>
        ) : allSynced && updateProfile.isSuccess ? (
          <p className="text-sm text-success">✓ 已同步到训练资料</p>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateProfile.mutate({
                injuries: mergeInjuries(currentInjuries, result.suggestedInjuryOptions),
              })
            }
          >
            同步到训练资料
          </Button>
        )}
      </div>
    </section>
  );
}

function mergeInjuries(current: string[], suggested: string[]): string[] {
  return [...new Set([...current, ...suggested])];
}

function DiscomfortForm({
  exerciseId,
  exerciseName,
  onSubmit,
  onCancel,
  pending,
  error,
}: {
  exerciseId: string;
  exerciseName: string;
  onSubmit: (input: JointDiscomfortInput) => void;
  onCancel: () => void;
  pending: boolean;
  error: string | null;
}) {
  const [bodyArea, setBodyArea] = useState<string>(BODY_AREAS[0] ?? '肩');
  const [severity, setSeverity] = useState<JointDiscomfortInput['severity']>('mild');

  return (
    <form
      className="space-y-4 rounded-lg border border-border bg-background p-4"
      aria-label={`报告不适：${exerciseName}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ exerciseId, bodyArea, severity });
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">不适部位</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {BODY_AREAS.map((area) => (
            <label key={area} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`bodyArea-${exerciseId}`}
                value={area}
                checked={bodyArea === area}
                onChange={() => setBodyArea(area)}
                className="h-4 w-4 accent-brand-ink"
              />
              {area}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">不适程度</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {SEVERITIES.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`severity-${exerciseId}`}
                value={option.value}
                checked={severity === option.value}
                onChange={() => setSeverity(option.value)}
                className="h-4 w-4 accent-brand-ink"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-ink/60">
        提交后该动作会立即停止，系统将按安全规则重校验本次训练的后续动作并给出替代建议。
      </p>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          停止该动作并检查后续
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          取消
        </Button>
      </div>
    </form>
  );
}

function ExerciseRow({
  exercise,
  active,
  onToggle,
  onAction,
  onDiscomfort,
  discomfortOpen,
  discomfortPending,
  discomfortError,
  onDiscomfortSubmit,
  onDiscomfortCancel,
  alternative,
}: {
  exercise: SessionExercise;
  active: boolean;
  onToggle: () => void;
  onAction: (action: 'complete' | 'skip') => void;
  onDiscomfort: () => void;
  discomfortOpen: boolean;
  discomfortPending: boolean;
  discomfortError: string | null;
  onDiscomfortSubmit: (input: JointDiscomfortInput) => void;
  onDiscomfortCancel: () => void;
  alternative?: JointDiscomfortResponse['alternatives'][number];
}) {
  const snapshot = exercise.exerciseSnapshot;
  const badge = STATUS_BADGE[exercise.status];
  return (
    <li className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={active}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{snapshot.name}</span>
          <span className="block text-xs text-ink/60">{snapshotDetail(snapshot)}</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </button>

      {active ? (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <p className="text-xs text-warning">⚠ {snapshot.warning}</p>

          {exercise.status === 'skipped' && exercise.reason ? (
            <p className="text-xs text-ink/60">{exercise.reason}</p>
          ) : null}
          {exercise.status === 'blocked' ? (
            <p className="text-xs text-danger">{exercise.reason ?? '安全规则已阻断该动作'}</p>
          ) : null}
          {alternative ? (
            <div className="rounded-md bg-success/5 px-3 py-2 text-xs">
              <span className="font-medium text-success">替代动作：</span>
              {alternative.replacement.name}（{snapshotDetail(alternative.replacement)}）
            </div>
          ) : null}

          {exercise.status === 'pending' && !discomfortOpen ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => onAction('complete')}
                aria-label={`完成 ${snapshot.name}`}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                完成
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction('skip')}
                aria-label={`跳过 ${snapshot.name}`}
              >
                跳过
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDiscomfort}
                aria-label={`关节不适 ${snapshot.name}`}
              >
                <HeartPulse className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                关节不适
              </Button>
            </div>
          ) : null}

          {discomfortOpen ? (
            <DiscomfortForm
              exerciseId={snapshot.exerciseId}
              exerciseName={snapshot.name}
              onSubmit={onDiscomfortSubmit}
              onCancel={onDiscomfortCancel}
              pending={discomfortPending}
              error={discomfortError}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function CompletionPanel({
  session,
  prefillMinutes,
  onClose,
  onComplete,
  pending,
  error,
}: {
  session: WorkoutSession;
  prefillMinutes: number | null;
  onClose: () => void;
  onComplete: (input: CompleteSessionInput) => void;
  pending: boolean;
  error: string | null;
}) {
  const [feedback, setFeedback] = useState<TrainingFeedback | null>(null);
  const [duration, setDuration] = useState(prefillMinutes === null ? '' : String(prefillMinutes));
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const done = session.exercises.filter((e) => e.status === 'completed').length;
  const total = session.exercises.length;

  return (
    <form
      className="space-y-4 rounded-xl border border-border bg-card p-5"
      aria-label="完成本次训练"
      onSubmit={(event) => {
        event.preventDefault();
        if (!feedback) {
          setLocalError('请选择本次训练的感受');
          return;
        }
        setLocalError(null);
        const minutes = duration.trim() === '' ? null : Number(duration);
        onComplete({
          // contract: durationMinutes is optional (absent when unknown), not nullable
          ...(minutes !== null && Number.isFinite(minutes)
            ? { durationMinutes: Math.round(minutes) }
            : {}),
          feedback,
          notes: notes.trim() === '' ? null : notes.trim(),
        });
      }}
    >
      <h3 className="font-semibold">完成本次训练（{done}/{total}）</h3>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          本次感受 <span className="text-danger">*</span>
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {FEEDBACK_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="workout-feedback"
                value={option.value}
                checked={feedback === option.value}
                onChange={() => setFeedback(option.value)}
                className="h-4 w-4 accent-brand-ink"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="workout-duration">实际时长（分钟，选填）</Label>
          <Input
            id="workout-duration"
            inputMode="numeric"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workout-notes">备注（选填）</Label>
          <Input
            id="workout-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="今天的状态、感受…"
          />
        </div>
      </div>
      {localError ? <p className="text-xs text-danger">{localError}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />
          )}
          保存并完成本次训练
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          返回动作列表
        </Button>
      </div>
    </form>
  );
}

export function WorkoutPage() {
  const today = localToday();
  const todayQuery = useTodayPlan();
  const plan = todayQuery.data?.plan ?? null;
  const planDay = todayQuery.data?.today ?? null;

  const sessionQuery = useSession(plan?.id, today);
  const session = sessionQuery.data ?? null;

  const actionMutation = useSessionAction(plan?.id ?? '', today);
  const discomfortMutation = useJointDiscomfort(plan?.id ?? '', today);
  const completeMutation = useCompleteSession(plan?.id ?? '', today);
  const abortMutation = useAbortSession(plan?.id ?? '', today);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [discomfortFor, setDiscomfortFor] = useState<string | null>(null);
  const [discomfortResult, setDiscomfortResult] = useState<JointDiscomfortResponse | null>(null);
  const [discomfortError, setDiscomfortError] = useState<string | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [abortError, setAbortError] = useState<string | null>(null);

  if (todayQuery.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink/60">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        加载今日安排…
      </div>
    );
  }

  if (todayQuery.isError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-danger">{errorMessage(todayQuery.error)}</p>
        <LinkButton to="/" variant="outline">
          返回今日
        </LinkButton>
      </div>
    );
  }

  if (!plan || !planDay) {
    return (
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <CircleSlash className="h-6 w-6 text-ink/40" aria-hidden />
          <h2 className="text-lg font-semibold">今天没有训练安排</h2>
        </div>
        <p className="text-sm text-ink/70">先生成一份本周计划，之后训练日就能在这里跟练。</p>
        <LinkButton to="/training">去生成计划</LinkButton>
      </section>
    );
  }

  if (sessionQuery.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink/60">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        准备今日训练…
      </div>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-danger">{errorMessage(sessionQuery.error)}</p>
        <LinkButton to="/" variant="outline">
          返回今日
        </LinkButton>
      </div>
    );
  }

  if (session.status === 'completed') {
    return <SessionSummary session={session} />;
  }
  if (session.status === 'aborted') {
    return <AbortedView />;
  }

  const activeExercise =
    expandedId === null
      ? session.exercises.find((e) => e.status === 'pending') ?? session.exercises[0]
      : session.exercises.find((e) => e.exerciseSnapshot.exerciseId === expandedId);

  const alternativeFor = (exerciseId: string) =>
    discomfortResult?.alternatives.find((a) => a.forExerciseId === exerciseId);

  const runAction = async (exerciseId: string, action: 'complete' | 'skip') => {
    setActionError(null);
    try {
      await actionMutation.mutateAsync({
        sessionId: session.id,
        exerciseId,
        input: action === 'skip' ? { action, reason: '用户跳过' } : { action },
      });
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  const submitDiscomfort = async (input: JointDiscomfortInput) => {
    setDiscomfortError(null);
    try {
      const response = await discomfortMutation.mutateAsync({ sessionId: session.id, input });
      setDiscomfortResult(response);
      setDiscomfortFor(null);
      setExpandedId(input.exerciseId);
    } catch (error) {
      setDiscomfortError(errorMessage(error));
    }
  };

  const submitComplete = async (input: CompleteSessionInput) => {
    try {
      await completeMutation.mutateAsync({ sessionId: session.id, input });
      setCompletionOpen(false);
    } catch {
      // error rendered via completeMutation.error
    }
  };

  const runAbort = async () => {
    if (!window.confirm('结束本次训练？已完成的动作会保留记录。')) return;
    setAbortError(null);
    try {
      await abortMutation.mutateAsync(session.id);
    } catch (error) {
      setAbortError(errorMessage(error));
    }
  };

  const pendingCount = session.exercises.filter((e) => e.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            to="/"
            className="mb-1 inline-flex items-center gap-1 text-xs text-ink/50 hover:text-ink"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            返回今日
          </Link>
          <h1 className="text-xl font-semibold">今日跟练</h1>
          <p className="text-sm text-ink/60">
            {today} · 预计 {planDay.estimatedDurationMinutes} 分钟 · 剩余 {pendingCount} 个动作
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runAbort} disabled={abortMutation.isPending}>
          结束本次
        </Button>
      </div>
      {abortError ? <p className="text-xs text-danger">{abortError}</p> : null}

      {discomfortResult ? (
        <DiscomfortResult
          result={discomfortResult}
          onDismiss={() => setDiscomfortResult(null)}
        />
      ) : null}
      {actionError ? <p className="text-xs text-danger">{actionError}</p> : null}

      {completionOpen ? (
        <CompletionPanel
          session={session}
          prefillMinutes={planDay.estimatedDurationMinutes}
          onClose={() => setCompletionOpen(false)}
          onComplete={submitComplete}
          pending={completeMutation.isPending}
          error={completeMutation.isError ? errorMessage(completeMutation.error) : null}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {session.exercises.map((exercise) => (
              <ExerciseRow
                key={exercise.exerciseSnapshot.exerciseId}
                exercise={exercise}
                active={activeExercise?.exerciseSnapshot.exerciseId === exercise.exerciseSnapshot.exerciseId}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === exercise.exerciseSnapshot.exerciseId
                      ? null
                      : exercise.exerciseSnapshot.exerciseId,
                  )
                }
                onAction={(action) => void runAction(exercise.exerciseSnapshot.exerciseId, action)}
                onDiscomfort={() => {
                  setDiscomfortError(null);
                  setDiscomfortFor(exercise.exerciseSnapshot.exerciseId);
                }}
                discomfortOpen={discomfortFor === exercise.exerciseSnapshot.exerciseId}
                discomfortPending={discomfortMutation.isPending}
                discomfortError={discomfortError}
                onDiscomfortSubmit={(input) => void submitDiscomfort(input)}
                onDiscomfortCancel={() => setDiscomfortFor(null)}
                alternative={alternativeFor(exercise.exerciseSnapshot.exerciseId)}
              />
            ))}
          </ul>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setCompletionOpen(true)}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden />
              完成训练并填写感受
            </Button>
            <LinkButton to="/" variant="ghost">
              稍后继续
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
