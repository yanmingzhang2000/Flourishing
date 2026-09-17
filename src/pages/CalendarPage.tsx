import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { storage } from '@/lib/storage';
import { plansApi, recordsApi, userApi, projectInstancesApi, isLoggedIn } from '@/lib/api';
import { WeeklyPlan, TrainingRecord } from '@/lib/types';
import { BottomNav } from '@/components/BottomNav';
import { WeekView } from '@/components/WeekView';
import { MonthView } from '@/components/MonthView';
import { YearView } from '@/components/YearView';
import projectsData from '@/data/projects.json';

const PROJECT_MAP = Object.fromEntries((projectsData as any[]).map(p => [p.id, p]));

type ViewType = 'week' | 'month' | 'year';

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  // instanceId 存在时为 V2 项目日历；不存在时为旧版全局日历（向后兼容）
  const { instanceId } = useParams<{ instanceId?: string }>();

  const [view, setView] = useState<ViewType>('week');
  const [currentPlan, setCurrentPlan] = useState<WeeklyPlan | null>(null);
  const [monthPlans, setMonthPlans] = useState<any[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [instance, setInstance] = useState<any | null>(null);
  const [stats, setStats] = useState<{ totalWorkouts: number; currentStreak: number }>({ totalWorkouts: 0, currentStreak: 0 });
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  const handleMonthChange = (y: number, m: number) => {
    setViewYear(y);
    setViewMonth(m);
  };

  useEffect(() => {
    if (isLoggedIn()) {
      const loadData = async () => {
        try {
          const [planRes, recordsRes, profileRes, statsRes] = await Promise.all([
            plansApi.getCurrent(),
            recordsApi.getAll(),
            userApi.getProfile(),
            recordsApi.getStats(),
          ]);

          // onboarding 未完成时跳引导
          if (!profileRes || !profileRes.experience) {
            navigate('/onboarding');
            return;
          }

          setProfile(profileRes);
          setRecords(recordsRes || []);
          setStats(statsRes);

          // 若有 instanceId，加载对应实例信息
          if (instanceId) {
            const instances = await projectInstancesApi.getAll();
            const inst = instances.find((i: any) => String(i.id) === instanceId);
            if (!inst) { navigate('/'); return; }
            setInstance(inst);

            // 为该实例所对应的 projectId 更新 selected_projects，再生成计划
            await userApi.updateProfile({ selected_projects: [inst.projectId] });
          }

          setCurrentPlan(planRes);

          if (!planRes) {
            setPlanLoading(true);
            try {
              await plansApi.generate();
              const fresh = await plansApi.getCurrent();
              setCurrentPlan(fresh);
            } finally {
              setPlanLoading(false);
            }
          }
        } catch {
          navigate('/');
        } finally {
          setLoading(false);
        }
      };
      loadData();
    } else {
      const savedPlan = storage.getWeeklyPlan();
      const savedRecords = storage.getTrainingRecords();
      const savedProfile = storage.getUserProfile();
      if (!savedPlan || !savedProfile) { navigate('/'); return; }
      setCurrentPlan(savedPlan);
      setRecords(savedRecords);
      setProfile(savedProfile);
      setStats({ totalWorkouts: savedRecords.filter(r => r.completed).length, currentStreak: calculateStreak(savedRecords) });
      setLoading(false);
    }
  }, [navigate, instanceId]);

  useEffect(() => {
    if (view === 'month' && isLoggedIn()) {
      plansApi.getMonth(viewYear, viewMonth).then(plans => {
        setMonthPlans(plans);
        if (plans.length === 0) {
          plansApi.generateMonth(viewYear, viewMonth).then(() => {
            plansApi.getMonth(viewYear, viewMonth).then(setMonthPlans);
          });
        }
      });
    }
  }, [view, viewYear, viewMonth]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 项目颜色（V2 日历有对应项目）
  const projectColor = instance ? (PROJECT_MAP[instance.projectId]?.color ?? '#7DC47A') : '#7DC47A';
  const projectName = instance ? (PROJECT_MAP[instance.projectId]?.name ?? '训练日历') : null;

  // 训练页路由：V2 带 instanceId，旧版不带
  const workoutPath = (date: string, dayIndex: number) =>
    instanceId
      ? `/workout/${instanceId}/${date}/${dayIndex}`
      : `/workout/${date}/${dayIndex}`;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <div className="flex items-center gap-3">
          {instanceId && (
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
              aria-label="返回"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted mb-0.5">
              {today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
            <h1 className="text-2xl font-bold text-text truncate">
              {projectName
                ? projectName
                : profile.display_name ? `你好，${profile.display_name} 👋` : '训练日历'}
            </h1>
            {instance && (
              <p className="text-sm mt-0.5" style={{ color: projectColor }}>
                第 {instance.currentWeek} 周 / 共 {instance.targetWeeks} 周
              </p>
            )}
          </div>
          {!instanceId && (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: projectColor }}
            >
              {(profile.display_name || '我')[0]}
            </div>
          )}
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
        {view === 'week' && (
          currentPlan
            ? <WeekView
                plan={currentPlan}
                records={records}
                onDayClick={(date, dayIndex) => navigate(workoutPath(date, dayIndex))}
              />
            : <div className="text-center text-muted py-10 text-sm">
                {planLoading ? '正在生成训练计划…' : '暂无本周计划'}
              </div>
        )}
        {view === 'month' && (
          <MonthView
            year={viewYear}
            month={viewMonth}
            records={records}
            plans={monthPlans}
            onMonthChange={handleMonthChange}
            onDayClick={(date, dayIndex) => navigate(workoutPath(date, dayIndex))}
          />
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
