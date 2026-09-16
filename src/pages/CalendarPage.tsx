import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '@/lib/storage';
import { plansApi, recordsApi, userApi, isLoggedIn, clearToken } from '@/lib/api';
import { WeeklyPlan, TrainingRecord } from '@/lib/types';
import { BottomNav } from '@/components/BottomNav';

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [stats, setStats] = useState<{ totalWorkouts: number; currentStreak: number }>({ totalWorkouts: 0, currentStreak: 0 });

  useEffect(() => {
    if (isLoggedIn()) {
      Promise.all([
        plansApi.getCurrent(),
        recordsApi.getAll(),
        userApi.getProfile(),
        recordsApi.getStats(),
      ]).then(([planRes, recordsRes, profileRes, statsRes]) => {
        if (!profileRes || !profileRes.experience) { navigate('/intake'); return; }
        if (!planRes) { navigate('/'); return; }
        setPlan(planRes);
        setRecords(recordsRes || []);
        setProfile(profileRes);
        setStats(statsRes);
      }).catch(() => navigate('/'));
    } else {
      const savedPlan = storage.getWeeklyPlan();
      const savedRecords = storage.getTrainingRecords();
      const savedProfile = storage.getUserProfile();
      if (!savedPlan || !savedProfile) { navigate('/'); return; }
      setPlan(savedPlan);
      setRecords(savedRecords);
      setProfile(savedProfile);
      setStats({ totalWorkouts: savedRecords.filter(r => r.completed).length, currentStreak: calculateStreak(savedRecords) });
    }
  }, [navigate]);

  const isToday = (dayIndex: number): boolean => {
    if (!plan) return false;
    const startDate = new Date(plan.startDate);
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + dayIndex);
    const today = new Date();
    return targetDate.toDateString() === today.toDateString();
  };

  const getRecord = (dayIndex: number): TrainingRecord | undefined => {
    if (!plan) return undefined;
    const startDate = new Date(plan.startDate);
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + dayIndex);
    const dateStr = targetDate.toISOString().split('T')[0];
    return records.find(r => r.date === dateStr);
  };

  const getWorkoutDate = (dayIndex: number): string => {
    if (!plan) return '';
    const startDate = new Date(plan.startDate);
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + dayIndex);
    return targetDate.toISOString().split('T')[0];
  };

  const handleDayClick = (dayIndex: number) => {
    if (!plan) return;
    const day = plan.days[dayIndex];
    if (day.type === 'rest') return;
    navigate(`/workout/${getWorkoutDate(dayIndex)}/${dayIndex}`);
  };

  if (!plan || !profile) return null;

  const todayIndex = plan.days.findIndex((_, i) => isToday(i));
  const todayDay = todayIndex >= 0 ? plan.days[todayIndex] : null;

  const EXPERIENCE_LABELS: Record<string, string> = {
    zero: '零基础', occasional: '偶尔练', regular: '经常练',
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* 顶部 Header */}
      <div className="px-5 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted mb-0.5">
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
            <h1 className="text-2xl font-bold text-text">
              {profile.display_name ? `你好，${profile.display_name} 👋` : '本周训练计划'}
            </h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold text-lg">
            {(profile.display_name || '我')[0]}
          </div>
        </div>
      </div>

      {/* 统计数字 */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl p-4 bg-ice-light text-center">
            <div className="text-2xl font-bold text-brand">{stats.totalWorkouts}</div>
            <div className="text-xs text-muted mt-0.5">累计完成</div>
          </div>
          <div className="rounded-2xl p-4 bg-ice-light text-center">
            <div className="text-2xl font-bold text-brand">{stats.currentStreak}</div>
            <div className="text-xs text-muted mt-0.5">连续天数</div>
          </div>
          <div className="rounded-2xl p-4 bg-ice-light text-center">
            <div className="text-2xl font-bold text-text">{profile.bmi ? Number(profile.bmi).toFixed(1) : '--'}</div>
            <div className="text-xs text-muted mt-0.5">BMI</div>
          </div>
        </div>
      </div>

      {/* 今日训练提示 */}
      {todayDay && todayDay.type !== 'rest' && (
        <div className="px-5 mb-5">
          <button
            onClick={() => handleDayClick(todayIndex)}
            className="w-full bg-brand rounded-2xl p-4 flex items-center justify-between text-white"
          >
            <div>
              <p className="text-xs text-white/70 mb-0.5">今天</p>
              <p className="font-bold text-lg">开始训练</p>
              <p className="text-sm text-white/80 mt-0.5">{todayDay.exercises.length} 个动作</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* 本周日历 */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text">本周安排</h2>
          <span className="text-xs text-muted">第 {plan.weekNumber} 周</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_LABELS.map(l => (
            <div key={l} className="text-center text-xs text-muted py-1">{l}</div>
          ))}
          {plan.days.map((day, index) => {
            const record = getRecord(index);
            const today = isToday(index);
            const isRest = day.type === 'rest';
            const done = !!record?.completed;

            return (
              <button
                key={index}
                onClick={() => handleDayClick(index)}
                disabled={isRest}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all
                  ${isRest ? 'cursor-default' : 'cursor-pointer active:scale-95'}
                  ${done ? 'bg-brand' :
                    today ? 'bg-brand-light ring-2 ring-brand' :
                    isRest ? 'bg-subtle' :
                    'bg-ice-light hover:bg-ice'
                  }`}
              >
                <span className={`text-xs font-bold
                  ${done ? 'text-white' : today ? 'text-brand' : isRest ? 'text-muted' : 'text-text'}`}>
                  {getWorkoutDate(index).slice(8)}
                </span>
                <span className={`text-[10px] mt-0.5
                  ${done ? 'text-white/80' : isRest ? 'text-muted/60' : 'text-muted'}`}>
                  {done ? '✓' : isRest ? '休' : '练'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 本周所有训练日列表 */}
      <div className="px-5">
        <h2 className="font-semibold text-text mb-3">训练详情</h2>
        <div className="space-y-2">
          {plan.days.map((day, index) => {
            if (day.type === 'rest') return null;
            const record = getRecord(index);
            const done = !!record?.completed;
            const today = isToday(index);
            const dateStr = getWorkoutDate(index);

            return (
              <button
                key={index}
                onClick={() => handleDayClick(index)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left
                  ${done ? 'bg-brand-light' : today ? 'bg-ice-light ring-1 ring-brand/30' : 'bg-subtle hover:bg-ice-light'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                  ${done ? 'bg-brand' : today ? 'bg-brand' : 'bg-white'}`}>
                  {done
                    ? <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm ${done ? 'text-brand' : 'text-text'}`}>
                    {DAY_LABELS[index]}曜日 · {dateStr.slice(5)}
                    {today && <span className="ml-2 text-xs bg-brand text-white px-1.5 py-0.5 rounded-full">今天</span>}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{day.exercises.length} 个动作</p>
                </div>
                <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

function calculateStreak(records: TrainingRecord[]): number {
  const completedDates = records
    .filter(r => r.completed)
    .map(r => new Date(r.date))
    .sort((a, b) => b.getTime() - a.getTime());
  if (completedDates.length === 0) return 0;
  let streak = 1;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const last = new Date(completedDates[0]); last.setHours(0, 0, 0, 0);
  if (Math.floor((today.getTime() - last.getTime()) / 86400000) > 1) return 0;
  for (let i = 0; i < completedDates.length - 1; i++) {
    const a = new Date(completedDates[i]); a.setHours(0, 0, 0, 0);
    const b = new Date(completedDates[i + 1]); b.setHours(0, 0, 0, 0);
    if (Math.floor((a.getTime() - b.getTime()) / 86400000) === 1) streak++;
    else break;
  }
  return streak;
}
