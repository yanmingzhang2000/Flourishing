import { loginInputSchema, type LoginInput } from '@flourish/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Maps backend error codes to user-facing Chinese copy. */
function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'invalid_credentials' || error.status === 401) {
      return '邮箱或密码不正确。';
    }
    return error.message || '登录失败，请稍后重试。';
  }
  return '网络异常，请稍后重试。';
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (input: LoginInput) => {
    setSubmitError(null);
    try {
      await login(input);
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
            <LogIn size={20} aria-hidden />
          </span>
          <h1 className="text-xl font-semibold">欢迎回来</h1>
          <p className="text-sm text-muted">登录后继续你的训练计划</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="login-email">邮箱</Label>
            <Input
              id="login-email"
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
            <Label htmlFor="login-password">密码</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="输入密码"
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
            {isSubmitting ? '登录中…' : '登录'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          还没有账号？{' '}
          <Link to="/register" className="font-medium text-brand-ink hover:underline">
            立即注册
          </Link>
        </p>
      </div>
    </div>
  );
}
