import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectInstancesApi, userApi, plansApi, recordsApi } from '@/lib/api';
import { ProjectInstance } from '@/lib/types';
import { BottomNav } from '@/components/BottomNav';
import { calculateStreak } from '@/lib/calendarUtils';
import projectsData from '@/data/projects.json';

const PROJECT_MAP = Object.fromEntries((projectsData as any[]).map(p => [p.id, p]));

// 进度条颜色按项目 color 渲染
function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600 font-medium">进行中</span>
  );
  if (status === 'paused') return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-medium">已暂停</span>
  );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">已完成</span>
  );
}

export const MyProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<ProjectInstance[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [todayTraining, setTodayTraining] = useState<{ instanceId: string; date: string; dayIndex: number; projectName: string; projectIcon: string; projectColor: string } | null>(null);
  const [dynamicSubtitle, setDynamicSubtitle] = useState<string>('加油 💪');

  const load = async () => {
    try {
      const [insts, prof, records] = await Promise.all([
        projectInstancesApi.getAll(),
        userApi.getProfile(),
        recordsApi.getAll().catch(() => []),
      ]);
      setInstances(insts);
      setProfile(prof);
      
      // 生成动态副标
      const today = new Date().toISOString().split('T')[0];
      const todayRecord = records.find((r: any) => r.date === today);
      const streak = calculateStreak(records);
      
      // 获取今日训练（从第一个 active 项目）
      const activeInst = insts.find(i => i.status === 'active');
      if (activeInst) {
        try {
          const plan = await plansApi.getByDate(today);
          if (plan && plan.days) {
            // 今天是星期几（0=周一...6=周日，ISO 8601标准）
            const todayDate = new Date(today);
            const todayJsDay = todayDate.getDay(); // JS: 0=周日, 1=周一, ..., 6=周六
            const todayIsoDay = todayJsDay === 0 ? 6 : todayJsDay - 1; // ISO: 0=周一, ..., 6=周日
            
            // 在计划中查找今天对应的训练（plan.days[i].dayIndex 是 ISO 格式）
            const todayPlan = plan.days.find(d => d.dayIndex === todayIsoDay);
            
            if (todayPlan && todayPlan.type !== 'rest' && todayPlan.exercises.length > 0) {
              const project = PROJECT_MAP[activeInst.projectId];
              setTodayTraining({
                instanceId: activeInst.id,
                date: today,
                dayIndex: todayIsoDay,
                projectName: project?.name || '训练',
                projectIcon: project?.icon || '💪',
                projectColor: project?.color || '#7DC47A',
              });
              
              // 动态副标：今天有训练
              if (!todayRecord?.completed) {
                // 计算预计时长
                const totalMinutes = todayPlan.exercises?.reduce((sum: number, ex: any) => {
                  const workTime = (ex.sets * ex.reps * 3) / 60;
                  const restTime = ((ex.sets - 1) * ex.restBetweenSet) / 60;
                  return sum + workTime + restTime;
                }, 0) || 0;
                const roundedMinutes = Math.ceil(totalMinutes / 5) * 5;
                setDynamicSubtitle(`今天有 1 项训练待练，${roundedMinutes} 分钟就能完成 ✨`);
              } else {
                setDynamicSubtitle(`今天的训练已完成，太棒了！🎉`);
              }
            } else {
              // 今天休息日
              if (streak > 0) {
                setDynamicSubtitle(`已连续 ${streak} 天，今天休息，明天继续加油 💪`);
              } else {
                setDynamicSubtitle(`今天休息，明天开始新的训练节奏 💪`);
              }
            }
          }
        } catch (err) {
          console.error('Failed to load today training:', err);
          // 失败时用连续天数兜底
          if (streak > 0) {
            setDynamicSubtitle(`已连续 ${streak} 天，继续保持 🔥`);
          }
        }
      } else {
        // 没有活跃项目
        setDynamicSubtitle('开始你的第一个训练计划吧 🌟');
      }
    } catch {
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleTogglePause = async (inst: ProjectInstance) => {
    setTogglingId(inst.id);
    try {
      const newStatus = inst.status === 'active' ? 'paused' : 'active';
      await projectInstancesApi.update(inst.id, { status: newStatus });
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (inst: ProjectInstance) => {
    if (!confirm(`确定要删除「${PROJECT_MAP[inst.projectId]?.name ?? inst.projectId}」吗？训练记录不会删除。`)) return;
    setTogglingId(inst.id);
    try {
      await projectInstancesApi.remove(inst.id);
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeInstances = instances.filter(i => i.status !== 'completed');
  const completedInstances = instances.filter(i => i.status === 'completed');

  return (
    <div className="min-h-screen bg-surface pb-28">
      {/* Header */}
      <div className="bg-brand px-5 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">我的训练</h1>
            <p className="text-sm text-white/70 mt-0.5">
              {dynamicSubtitle}
            </p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="设置"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-3 max-w-4xl mx-auto">
        {/* 今日训练快捷入口 */}
        {todayTraining && (
          <div className="bg-gradient-to-br from-[#7DC47A] to-[#6DB569] rounded-2xl p-5 shadow-lg mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">
                {todayTraining.projectIcon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">今日训练</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">{todayTraining.projectName}</h3>
              </div>
            </div>
            <button
              onClick={() => navigate(`/workout/${todayTraining.instanceId}/${todayTraining.date}/${todayTraining.dayIndex}`)}
              className="w-full py-3 rounded-xl bg-white text-[#7DC47A] font-bold text-sm hover:bg-white/90 transition-all flex items-center justify-center gap-2 shadow-md"
            >
              <span>🔥</span>
              <span>开始训练</span>
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        )}

        {/* 空状态 */}
        {activeInstances.length === 0 && completedInstances.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 rounded-full bg-brand/10 flex items-center justify-center text-5xl mb-4">
              🌱
            </div>
            <h2 className="text-lg font-bold text-text mb-2">还没有训练项目</h2>
            <p className="text-sm text-muted mb-6">选择一个项目，开始你的塑形之旅</p>
            <button
              onClick={() => navigate('/projects')}
              className="px-6 py-3 bg-brand text-white rounded-2xl font-semibold text-sm hover:bg-brand/90 transition-colors"
            >
              浏览项目
            </button>
          </div>
        )}

        {/* 进行中 & 暂停中 */}
        {activeInstances.map(inst => {
          const project = PROJECT_MAP[inst.projectId];
          if (!project) return null;
          const isToggling = togglingId === inst.id;

          return (
            <div
              key={inst.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border-l-4 border-brand"
            >
              <div className="px-5 py-4">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: `${project.color}18` }}
                  >
                    {project.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-text">{project.name}</h3>
                      <StatusBadge status={inst.status} />
                    </div>
                    <p className="text-xs text-muted mt-0.5">{project.subtitle} · {project.target_area}</p>
                  </div>
                </div>

                {/* 进度 */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-muted">第 {inst.currentWeek} 周 / 共 {inst.targetWeeks} 周</span>
                    <span className="text-xs font-semibold text-brand">
                      {Math.round((inst.currentWeek / inst.targetWeeks) * 100)}%
                    </span>
                  </div>
                  <ProgressBar current={inst.currentWeek} total={inst.targetWeeks} color="#7DC47A" />
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  {inst.status === 'active' && (
                    <button
                      onClick={() => navigate(`/projects/${inst.id}/calendar`)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand hover:bg-brand-dark transition-colors"
                    >
                      继续训练
                    </button>
                  )}
                  {inst.status === 'paused' && (
                    <button
                      onClick={() => navigate(`/projects/${inst.id}/calendar`)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-400 hover:bg-gray-500 transition-colors"
                    >
                      查看日历
                    </button>
                  )}
                  <button
                    onClick={() => handleTogglePause(inst)}
                    disabled={isToggling}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-gray-200 text-muted hover:border-gray-300 transition-colors disabled:opacity-50"
                  >
                    {isToggling ? '…' : inst.status === 'active' ? '暂停' : '继续'}
                  </button>
                  <button
                    onClick={() => handleDelete(inst)}
                    disabled={isToggling}
                    className="px-3 py-2.5 rounded-xl text-sm border-2 border-red-100 text-red-400 hover:border-red-300 transition-colors disabled:opacity-50"
                    aria-label="删除"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* 添加新项目 */}
        {activeInstances.length > 0 && (
          <button
            onClick={() => navigate('/projects')}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-muted hover:border-brand hover:text-brand transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            添加新项目
          </button>
        )}

        {/* 已完成 */}
        {completedInstances.length > 0 && (
          <div className="pt-4">
            <h2 className="text-sm font-semibold text-muted mb-3">已完成</h2>
            <div className="space-y-2">
              {completedInstances.map(inst => {
                const project = PROJECT_MAP[inst.projectId];
                if (!project) return null;
                return (
                  <div key={inst.id} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 opacity-60">
                    <span className="text-xl">{project.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-text">{project.name}</span>
                      <span className="text-xs text-muted ml-2">· {inst.targetWeeks} 周计划</span>
                    </div>
                    <span className="text-xs text-green-500 font-medium">✓ 完成</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};
