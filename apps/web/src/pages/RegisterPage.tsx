import { registerInputSchema, type RegisterInput } from '@flourish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'email_taken' || error.status === 409) {
      return '该邮箱已被注册，请直接登录。';
    }
    return error.message || '注册失败，请稍后重试。';
  }
  return '网络异常，请稍后重试。';
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerAccount } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerInputSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (input: RegisterInput) => {
    setSubmitError(null);
    try {
      await registerAccount(input);
      navigate('/', { replace: true });
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center py-10">
      <div className="rounded-xl border border-border bg-surface p-8 shadow-soft">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-foreground">
            <Sparkles size={20} aria-hidden />
          </span>
          <h1 className="text-xl font-semibold">创建账号</h1>
          <p className="text-sm text-muted">注册后即可获得为你生成的训练计划</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="register-email">邮箱</Label>
            <Input
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email ? (
              <p className="text-xs text-danger">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="register-password">密码</Label>
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位字符"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password ? (
              <p className="text-xs text-danger">{errors.password.message}</p>
            ) : null}
          </div>

          {submitError ? (
            <p role="alert" className="text-sm text-danger">
              {submitError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? '注册中…' : '注册'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          已经有账号？{' '}
          <Link to="/login" className="font-medium text-brand-ink hover:underline">
            直接登录
          </Link>
        </p>
      </div>
    </div>
  );
}
