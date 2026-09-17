import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi, userApi, saveToken } from '@/lib/api';

type Mode = 'login' | 'register';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await authApi.login(email, password)
        : await authApi.register(email, password);
      saveToken(res.token);
      // 检查 onboarding 是否完成，新用户跳引导页
      const profile = await userApi.getProfile();
      if (!profile || !profile.onboarding_completed) {
        navigate('/onboarding');
      } else {
        navigate('/');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setLoading(true);
    try {
      const res = await authApi.guest();
      saveToken(res.token);
      // 游客模式：直接跳主页（游客不做 onboarding）
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 顶部 Banner */}
      <div className="bg-gradient-to-r from-[#7DC47A] to-[#10B981] text-white py-16 px-4 flex-shrink-0">
        <div className="max-w-sm mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <img src="./vite.svg" alt="Flourish AI" className="w-9 h-9" />
            </div>
            <h1 className="text-4xl font-bold">Flourish AI</h1>
          </div>
          <p className="text-white/90 mt-2">每天15分钟，遇见更好的自己</p>
        </div>
      </div>

      {/* 表单区域 */}
      <div className="flex-1 flex items-start justify-center px-4 pt-10">
        <div className="w-full max-w-sm">
          {/* Tab 切换 */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-8">
            <button
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
              onClick={() => { setMode('login'); setError(''); }}
            >
              登录
            </button>
            <button
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
              onClick={() => { setMode('register'); setError(''); }}
            >
              注册
            </button>
          </div>

          <div className="space-y-4">
            <Input
              id="email"
              label="邮箱"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <Input
              id="password"
              label="密码"
              type="password"
              placeholder={mode === 'register' ? '至少6位' : '请输入密码'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSubmit()}
            />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={loading}
            >
              {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">
              或者
            </div>
          </div>

          <button
            onClick={handleGuest}
            disabled={loading}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 text-sm hover:border-[#7DC47A] hover:text-[#7DC47A] transition-all"
          >
            游客体验（数据保存在本设备）
          </button>
        </div>
      </div>
    </div>
  );
};
