import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { userApi, recordsApi, clearToken } from '@/lib/api';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<{ totalWorkouts: number; currentStreak: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([userApi.getProfile(), recordsApi.getStats()])
      .then(([p, s]) => { setProfile(p); setStats(s); })
      .catch(() => navigate('/auth'))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const bmi = profile?.bmi ? Number(profile.bmi).toFixed(1) : null;
  const bmiLabel = bmi
    ? Number(bmi) < 18.5 ? '偏瘦' : Number(bmi) < 24 ? '正常' : Number(bmi) < 28 ? '偏重' : '偏胖'
    : null;

  const expLabel: Record<string, string> = {
    zero: '零基础', occasional: '偶尔练', regular: '经常练',
  };

  return (
    <div className="min-h-screen bg-surface pb-28">
      {/* 顶部：头像 + 基础信息 */}
      <div className="bg-white px-5 pt-12 pb-6 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {(profile?.display_name || '我')[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-text truncate">
              {profile?.display_name || '未设置昵称'}
            </h1>
            <p className="text-sm text-muted mt-0.5">
              {profile?.experience ? expLabel[profile.experience] || profile.experience : '未设置'}
              {profile?.training_days?.length
                ? ` · 每周 ${profile.training_days.length} 天`
                : profile?.max_days_per_week
                  ? ` · 每周 ${profile.max_days_per_week} 天`
                  : ''}
            </p>
          </div>
          {/* 设置入口 */}
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-full bg-subtle flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
            aria-label="设置"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-text" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="px-5 pt-5">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl p-4 bg-white text-center shadow-sm">
            <div className="text-2xl font-bold text-brand">{stats?.totalWorkouts ?? 0}</div>
            <div className="text-xs text-muted mt-0.5">累计完成</div>
          </div>
          <div className="rounded-2xl p-4 bg-white text-center shadow-sm">
            <div className="text-2xl font-bold text-brand">{stats?.currentStreak ?? 0}</div>
            <div className="text-xs text-muted mt-0.5">连续天数</div>
          </div>
          <div className="rounded-2xl p-4 bg-white text-center shadow-sm">
            <div className="text-2xl font-bold text-text">{bmi ?? '--'}</div>
            <div className="text-xs text-muted mt-0.5">{bmiLabel ?? 'BMI'}</div>
          </div>
        </div>

        {/* 身体信息摘要 */}
        {(profile?.height || profile?.weight) && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <h3 className="text-sm font-semibold text-text mb-3">身体信息</h3>
            <div className="grid grid-cols-3 gap-3">
              {profile.height && (
                <div className="text-center">
                  <div className="text-lg font-bold text-text">{profile.height}</div>
                  <div className="text-xs text-muted">身高 cm</div>
                </div>
              )}
              {profile.weight && (
                <div className="text-center">
                  <div className="text-lg font-bold text-text">{profile.weight}</div>
                  <div className="text-xs text-muted">体重 kg</div>
                </div>
              )}
              {bmi && (
                <div className="text-center">
                  <div className="text-lg font-bold text-text">{bmi}</div>
                  <div className="text-xs text-muted">{bmiLabel}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 快捷操作 */}
        <div className="space-y-2">
          <button
            onClick={() => navigate('/settings')}
            className="w-full bg-white rounded-2xl px-4 py-4 flex items-center gap-3 shadow-sm hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-brand" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text">个人设置</p>
              <p className="text-xs text-muted mt-0.5">修改身体信息、器械、训练偏好</p>
            </div>
            <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full bg-white rounded-2xl px-4 py-4 flex items-center gap-3 shadow-sm hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-ice-light flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-brand" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text">我的训练</p>
              <p className="text-xs text-muted mt-0.5">查看进行中的训练项目</p>
            </div>
            <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 退出登录 */}
        <div className="mt-6">
          <button
            onClick={() => { clearToken(); navigate('/auth'); }}
            className="w-full py-3.5 rounded-2xl border-2 border-gray-200 text-muted text-sm font-medium hover:border-red-200 hover:text-red-400 transition-colors"
          >
            退出登录
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};
