import {
  experienceLevelSchema,
  injuryTagSchema,
  profileSchema,
  type ExperienceLevel,
  type Profile,
} from '@flourish/contracts';
import { INJURY_OPTION_TAG_MAP } from '@flourish/training-domain/safety';
import { zodResolver } from '@hookform/resolvers/zod';
import { RefreshCw, Save, UserRound } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useExercises } from '@/api/today';
import { useProfile, useUpdateProfile } from '@/api/profile';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { optionalNumber, requiredNumber } from '@/lib/form';
import { ApiError } from '@/lib/api';

/**
 * Injury options are the KEYS of training-domain's mapping table — the
 * single source of truth for SAFE-01 (option → contraindication tags).
 * The UI never restates this list locally.
 */
const INJURY_OPTIONS = Object.keys(INJURY_OPTION_TAG_MAP);

/** Display labels for canonical equipment tags (display copy only). */
const EQUIPMENT_LABELS: Record<string, string> = {
  bodyweight: '自重训练',
  mat_6mm: '瑜伽垫 6mm',
  dumbbell_1kg: '哑铃 1kg',
  dumbbell_2kg: '哑铃 2kg',
  band_light: '弹力带 · 轻阻力',
  band_mid: '弹力带 · 中阻力',
  foam_roller_plain: '泡沫轴 · 普通款',
  yoga_ball_55: '瑜伽球 55cm',
};

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'beginner', label: '零基础' },
  { value: 'intermediate', label: '偶尔练' },
  { value: 'advanced', label: '经常练' },
];

const profileFormSchema = z.object({
  // Required per PRD 维度1; numeric ranges come from the contract shapes.
  heightCm: requiredNumber(profileSchema.shape.heightCm),
  weightKg: requiredNumber(profileSchema.shape.weightKg),
  experienceLevel: experienceLevelSchema,
  age: optionalNumber(profileSchema.shape.age),
  targetMinutesPerSession: optionalNumber(profileSchema.shape.targetMinutesPerSession),
  targetSessionsPerWeek: optionalNumber(profileSchema.shape.targetSessionsPerWeek),
  injuries: z.array(injuryTagSchema),
  availableEquipment: profileSchema.shape.availableEquipment,
});

type ProfileFormInput = z.input<typeof profileFormSchema>;
type ProfileFormValues = z.output<typeof profileFormSchema>;

function toFormValues(profile: Profile): ProfileFormInput {
  return {
    heightCm: profile.heightCm === null ? '' : String(profile.heightCm),
    weightKg: profile.weightKg === null ? '' : String(profile.weightKg),
    experienceLevel: profile.experienceLevel ?? 'beginner',
    age: profile.age === null ? '' : String(profile.age),
    targetMinutesPerSession:
      profile.targetMinutesPerSession === null ? '' : String(profile.targetMinutesPerSession),
    targetSessionsPerWeek:
      profile.targetSessionsPerWeek === null ? '' : String(profile.targetSessionsPerWeek),
    injuries: profile.injuries,
    availableEquipment: profile.availableEquipment,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message || '保存失败，请稍后重试。';
  }
  return '网络异常，请稍后重试。';
}

function PageSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-surface p-8" data-testid="profile-skeleton">
      <div className="h-5 w-24 rounded bg-border" />
      <div className="mt-6 space-y-4">
        <div className="h-10 w-full rounded-md bg-border" />
        <div className="h-10 w-full rounded-md bg-border" />
        <div className="h-10 w-2/3 rounded-md bg-border" />
      </div>
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const updateProfile = useUpdateProfile();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const libraryQuery = useExercises();

  const equipmentOptions = useMemo(() => {
    const ordered = Object.keys(EQUIPMENT_LABELS);
    const seen = new Set(ordered);
    const add = (tag: string) => {
      if (!seen.has(tag)) {
        seen.add(tag);
        ordered.push(tag);
      }
    };
    for (const exercise of libraryQuery.data?.exercises ?? []) {
      for (const tag of exercise.equipment) add(tag);
    }
    for (const tag of profile.availableEquipment) add(tag);
    return ordered;
  }, [libraryQuery.data, profile.availableEquipment]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: toFormValues(profile),
  });

  const onSubmit = async (values: ProfileFormValues) => {
    setSubmitError(null);
    setSaved(false);
    try {
      await updateProfile.mutateAsync({
        heightCm: values.heightCm,
        weightKg: values.weightKg,
        experienceLevel: values.experienceLevel,
        age: values.age,
        targetMinutesPerSession: values.targetMinutesPerSession,
        targetSessionsPerWeek: values.targetSessionsPerWeek,
        injuries: values.injuries,
        availableEquipment: values.availableEquipment,
      });
      setSaved(true);
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit(onSubmit)} noValidate>
      <section className="space-y-4">
        <h2 className="text-base font-semibold">基础信息</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="profile-height">身高（cm）</Label>
            <Input
              id="profile-height"
              inputMode="decimal"
              placeholder="165"
              aria-invalid={!!errors.heightCm}
              {...register('heightCm')}
            />
            {errors.heightCm ? (
              <p className="text-xs text-danger">{errors.heightCm.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-weight">体重（kg）</Label>
            <Input
              id="profile-weight"
              inputMode="decimal"
              placeholder="52"
              aria-invalid={!!errors.weightKg}
              {...register('weightKg')}
            />
            {errors.weightKg ? (
              <p className="text-xs text-danger">{errors.weightKg.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-age">年龄（选填）</Label>
            <Input
              id="profile-age"
              inputMode="numeric"
              placeholder="28"
              aria-invalid={!!errors.age}
              {...register('age')}
            />
            {errors.age ? <p className="text-xs text-danger">{errors.age.message}</p> : null}
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">训练经验</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {EXPERIENCE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  value={option.value}
                  className="h-4 w-4 accent-brand-ink"
                  {...register('experienceLevel')}
                />
                {option.label}
              </label>
            ))}
          </div>
          {errors.experienceLevel ? (
            <p className="mt-1 text-xs text-danger">{errors.experienceLevel.message}</p>
          ) : null}
        </fieldset>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">训练偏好</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-minutes">单次训练时长（分钟，选填）</Label>
            <Input
              id="profile-minutes"
              inputMode="numeric"
              placeholder="30"
              aria-invalid={!!errors.targetMinutesPerSession}
              {...register('targetMinutesPerSession')}
            />
            {errors.targetMinutesPerSession ? (
              <p className="text-xs text-danger">{errors.targetMinutesPerSession.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-sessions">每周训练次数（选填）</Label>
            <Input
              id="profile-sessions"
              inputMode="numeric"
              placeholder="3"
              aria-invalid={!!errors.targetSessionsPerWeek}
              {...register('targetSessionsPerWeek')}
            />
            {errors.targetSessionsPerWeek ? (
              <p className="text-xs text-danger">{errors.targetSessionsPerWeek.message}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">伤病情况</h2>
          <p className="mt-1 text-xs text-muted">
            用于排除不适合你的动作，没有可不选。
          </p>
        </div>
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
          <legend className="sr-only">伤病情况（多选）</legend>
          {INJURY_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <Checkbox value={option} {...register('injuries')} />
              {option}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">可用器械</h2>
          <p className="mt-1 text-xs text-muted">决定计划中可以安排哪些器械动作。</p>
        </div>
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
          <legend className="sr-only">可用器械（多选）</legend>
          {equipmentOptions.map((tag) => (
            <label key={tag} className="flex items-center gap-2 text-sm">
              <Checkbox value={tag} {...register('availableEquipment')} />
              {EQUIPMENT_LABELS[tag] ?? tag}
            </label>
          ))}
        </fieldset>
        {errors.availableEquipment ? (
          <p className="text-xs text-danger">至少选择一件可用器械</p>
        ) : null}
      </section>

      {submitError ? (
        <p role="alert" className="text-sm text-danger">
          {submitError}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-accent">
          已保存。生成计划时将使用最新资料。
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        <Save size={15} aria-hidden className="mr-1.5" />
        {isSubmitting ? '保存中…' : '保存资料'}
      </Button>
    </form>
  );
}

export function ProfilePage() {
  const profileQuery = useProfile();

  let body: ReactNode;
  if (profileQuery.isLoading) {
    body = <PageSkeleton />;
  } else if (profileQuery.isError || !profileQuery.data) {
    body = (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="font-medium text-danger">训练资料加载失败</h2>
        <p className="mt-2 text-sm text-muted">网络或服务异常，请稍后重试。</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => void profileQuery.refetch()}
        >
          <RefreshCw size={15} aria-hidden className="mr-1.5" />
          重试
        </Button>
      </div>
    );
  } else {
    body = <ProfileForm key={profileQuery.data.userId} profile={profileQuery.data} />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
          <UserRound size={13} aria-hidden />
          我的
        </span>
        <h1 className="mt-3 text-2xl font-semibold">训练资料</h1>
        <p className="mt-1 text-sm text-muted">
          资料决定计划的安全边界与难度——伤病会排除相关动作，经验决定组次区间。
        </p>
      </header>

      <div className="rounded-xl border border-border bg-surface p-8 shadow-soft">{body}</div>
    </div>
  );
}
