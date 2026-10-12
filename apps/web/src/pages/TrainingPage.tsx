import {
  profileSchema,
  targetProjectSchema,
  trainingDaySchema,
  type GeneratePlanInput,
  type TargetProject,
  type TrainingDay,
} from '@flourish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck, Dumbbell, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useGeneratePlan } from '@/api/plans';
import { useProfile } from '@/api/profile';
import { useTodayPlan } from '@/api/today';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { localToday } from '@/lib/dates';
import { optionalNumber } from '@/lib/form';

const PROJECT_OPTIONS: { value: TargetProject; label: string }[] = [
  { value: 'tricep_tone', label: '拜拜肉收紧' },
  { value: 'hip_thigh_tone', label: '假胯宽改善' },
  { value: 'lower_abs_tone', label: '下腹收紧' },
  { value: 'trap_relax', label: '斜方肌放松' },
  { value: 'round_shoulder_fix', label: '圆肩改善' },
  { value: 'full_body_basic', label: '居家基础体能' },
];

const DAY_OPTIONS: { value: TrainingDay; label: string }[] = [
  { value: 'monday', label: '周一' },
  { value: 'tuesday', label: '周二' },
  { value: 'wednesday', label: '周三' },
  { value: 'thursday', label: '周四' },
  { value: 'friday', label: '周五' },
  { value: 'saturday', label: '周六' },
  { value: 'sunday', label: '周日' },
];

const generateFormSchema = z.object({
  targetProjects: z.array(targetProjectSchema).min(1, '请至少选择一个训练目标'),
  trainingDays: z.array(trainingDaySchema).min(1, '请至少选择一个训练日'),
  targetMinutesPerSession: optionalNumber(profileSchema.shape.targetMinutesPerSession),
});

type GenerateFormInput = z.input<typeof generateFormSchema>;
type GenerateFormValues = z.output<typeof generateFormSchema>;

function generateErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'profile_not_found') {
      return '请先完善训练资料后再生成计划。';
    }
    if (error.code === 'plan_generation_failed') {
      return '暂时无法生成有效计划，请调整目标项目或训练日后重试。';
    }
    return error.message || '生成失败，请稍后重试。';
  }
  return '网络异常，请稍后重试。';
}

function PageSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-surface p-8" data-testid="training-skeleton">
      <div className="h-5 w-28 rounded bg-border" />
      <div className="mt-6 space-y-4">
        <div className="h-10 w-full rounded-md bg-border" />
        <div className="h-10 w-full rounded-md bg-border" />
        <div className="h-10 w-2/3 rounded-md bg-border" />
      </div>
    </div>
  );
}

interface GenerateFormProps {
  prefillMinutes: number | null;
  hasActivePlan: boolean;
}

function GenerateForm({ prefillMinutes, hasActivePlan }: GenerateFormProps) {
  const navigate = useNavigate();
  const generatePlan = useGeneratePlan();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GenerateFormInput, unknown, GenerateFormValues>({
    resolver: zodResolver(generateFormSchema),
    defaultValues: {
      targetProjects: [],
      trainingDays: [],
      targetMinutesPerSession: prefillMinutes === null ? '' : String(prefillMinutes),
    },
  });

  const onSubmit = async (values: GenerateFormValues) => {
    setSubmitError(null);
    const input: GeneratePlanInput = {
      startDate: localToday(),
      targetProjects: values.targetProjects,
      trainingDays: values.trainingDays,
      ...(values.targetMinutesPerSession !== null
        ? { targetMinutesPerSession: values.targetMinutesPerSession }
        : {}),
    };
    try {
      await generatePlan.mutateAsync(input);
      navigate('/');
    } catch (error) {
      setSubmitError(generateErrorMessage(error));
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">训练目标（可多选）</h2>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {PROJECT_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <Checkbox value={option.value} {...register('targetProjects')} />
              {option.label}
            </label>
          ))}
        </div>
        {errors.targetProjects ? (
          <p className="text-xs text-danger">{errors.targetProjects.message}</p>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">每周训练日</h2>
          <p className="mt-1 text-xs text-muted">建议隔天练，例如周一 / 周三 / 周五；未勾选的日期为休息日。</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {DAY_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm">
              <Checkbox value={option.value} {...register('trainingDays')} />
              {option.label}
            </label>
          ))}
        </div>
        {errors.trainingDays ? (
          <p className="text-xs text-danger">{errors.trainingDays.message}</p>
        ) : null}
      </section>

      <section className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="generate-minutes">单次训练时长（分钟，选填）</Label>
        <Input
          id="generate-minutes"
          inputMode="numeric"
          placeholder="30"
          aria-invalid={!!errors.targetMinutesPerSession}
          {...register('targetMinutesPerSession')}
        />
        {errors.targetMinutesPerSession ? (
          <p className="text-xs text-danger">{errors.targetMinutesPerSession.message}</p>
        ) : null}
      </section>

      {submitError ? (
        <p role="alert" className="text-sm text-danger">
          {submitError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        <Dumbbell size={15} aria-hidden className="mr-1.5" />
        {isSubmitting ? '生成中…' : hasActivePlan ? '重新生成本周计划' : '生成训练计划'}
      </Button>
    </form>
  );
}

export function TrainingPage() {
  const todayQuery = useTodayPlan();
  const profileQuery = useProfile();

  let body: ReactNode;
  if (profileQuery.isLoading) {
    body = <PageSkeleton />;
  } else if (profileQuery.isError || !profileQuery.data) {
    body = (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="font-medium text-danger">加载失败</h2>
        <p className="mt-2 text-sm text-muted">网络或服务异常，请稍后重试。</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => {
            void profileQuery.refetch();
            void todayQuery.refetch();
          }}
        >
          <RefreshCw size={15} aria-hidden className="mr-1.5" />
          重试
        </Button>
      </div>
    );
  } else {
    const plan = todayQuery.data?.plan;
    body = (
      <div className="space-y-8">
        {plan ? (
          <section className="rounded-xl border border-border bg-background p-6">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
              <CalendarCheck size={13} aria-hidden />
              当前计划
            </span>
            <h2 className="mt-3 text-lg font-semibold">
              {plan.startDate} 起 7 天 · {plan.days.length} 个训练日
            </h2>
            {plan.adjustment ? (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                本次调整：{plan.adjustment.explanation}
              </p>
            ) : null}
            <Link
              to="/"
              className="mt-3 inline-block text-sm font-medium text-brand-ink hover:underline"
            >
              返回今日训练
            </Link>
          </section>
        ) : null}

        <section className="rounded-xl border border-border bg-surface p-8 shadow-soft">
          <h1 className="text-xl font-semibold">
            {plan ? '调整并重新生成' : '生成你的训练计划'}
          </h1>
          <p className="mt-1 mb-6 text-sm text-muted">
            选择目标与训练日，系统按恢复规则与你的资料确定性地生成本周安排。
          </p>
          <GenerateForm
            prefillMinutes={profileQuery.data.targetMinutesPerSession}
            hasActivePlan={!!plan}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
          <Dumbbell size={13} aria-hidden />
          我的训练
        </span>
      </header>
      {body}
    </div>
  );
}
