import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '@/lib/storage';
import { plansApi, recordsApi, userApi, isLoggedIn } from '@/lib/api';
import { WeeklyPlan, PlanSnapshot, TrainingRecord, StructuredUnavailableResult } from '@/lib/types';
import { BottomNav } from '@/components/BottomNav';
import { WeekView } from '@/components/WeekView';
import { MonthView } from '@/components/MonthView';
import { YearView } from '@/components/YearView';

type ViewType = 'week' | 'month' | 'year';

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewType>('week');
  const [currentPlan, setCurrentPlan] = useState<WeeklyPlan | null>(null);
  const [monthPlans, setMonthPlans] = useState<PlanSnapshot[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [unavailable, setUnavailable] = useState<StructuredUnavailableResult | null>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  // 月/年视图切换年月
  const handleMonthChange = (y: number, m: number) => {
    setViewYear(y);
    setViewMonth(m);
  };

  useEffect(() => {
    if (isLoggedIn()) {
      Promise.all([
        plansApi.getCurrent(),
        recordsApi.getAll(),
        userApi.getProfile(),
        recordsApi.getStats(),
      ]).then(([planRes, recordsRes, profileRes, statsRes]) => {
        if (!profileRes || !profileRes.experience) { navigate('/intake'); return; }
        setCurrentPlan(planRes);
        setRecords(recordsRes || []);
        setProfile(profileRes);
        setStats(statsRes);

        // 如果当前没有计划，自动生成
        if (!planRes) {
          plansApi.generate().then(result => {
            if (result.outcome === 'temporarily_unavailable') {
              setUnavailable(result);
              return;
            }
            plansApi.getCurrent().then(setCurrentPlan);
          });
        }
      }).catch(() => navigate('/'));
    } else {
      const savedPlan = storage.getWeeklyPlan();
      const savedRecords = storage.getTrainingRecords();
      const savedProfile = storage.getUserProfile();
      if (!savedPlan || !savedProfile) { navigate('/'); return; }
      setCurrentPlan(savedPlan);
      setRecords(savedRecords);
      setProfile(savedProfile);
      setStats({ totalWorkouts: savedRecords.filter(r => r.completed).length, currentStreak: calculateStreak(savedRecords) });
    }
  }, [navigate]);

  // 月视图需要加载该月所有计划
  useEffect(() => {
    if (view === 'month' && isLoggedIn()) {
      plansApi.getMonth(viewYear, viewMonth).then(plans => {
        setMonthPlans(plans);
        if (plans.length === 0) {
          plansApi.generateMonth(viewYear, viewMonth).then(result => {
            if (result.outcome === 'temporarily_unavailable') {
              setUnavailable(result);
              return;
            }
            plansApi.getMonth(viewYear, viewMonth).then(setMonthPlans);
          });
        }
      });
    }
  }, [view, viewYear, viewMonth]);

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted mb-0.5">
              {today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
            <h1 className="text-2xl font-bold text-text">
              {profile.display_name ? `你好，${profile.display_name} 👋` : '训练日历'}
            </h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white font-bold text-lg">
            {(profile.display_name || '我')[0]}
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
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

      {unavailable && (
        <div className="mx-5 mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="font-semibold text-amber-800">{unavailable.display_message}</p>
          <p className="mt-1 text-xs text-amber-700">当前条件下没有安全、合格的动作，请调整训练偏好后重试。</p>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="px-5 mb-5">
        <div className="bg-subtle rounded-2xl p-1 flex gap-1">
          {(['week', 'month', 'year'] as ViewType[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all
                ${view === v ? 'bg-white text-brand shadow-sm' : 'text-muted hover:text-text'}`}
            >
              {v === 'week' ? '周' : v === 'month' ? '月' : '年'}
            </button>
          ))}
        </div>
      </div>

      {/* 视图内容 */}
      <div className="px-5">
        {view === 'week' && currentPlan && (
          <WeekView plan={currentPlan} records={records} />
        )}
        {view === 'month' && (
          <MonthView year={viewYear} month={viewMonth} records={records} plans={monthPlans} onMonthChange={handleMonthChange} />
        )}
        {view === 'year' && (
          <YearView year={viewYear} records={records} />
        )}
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
