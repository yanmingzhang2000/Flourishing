import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectInstancesApi, userApi } from '@/lib/api';
import { ProjectInstance } from '@/lib/types';
import { BottomNav } from '@/components/BottomNav';
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

  const load = async () => {
    try {
      const [insts, prof] = await Promise.all([
        projectInstancesApi.getAll(),
        userApi.getProfile(),
      ]);
      setInstances(insts);
      setProfile(prof);
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
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">我的训练</h1>
            <p className="text-sm text-muted mt-0.5">
              {profile?.display_name ? `${profile.display_name}，` : ''}加油 💪
            </p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-full bg-subtle flex items-center justify-center hover:bg-gray-200 transition-colors"
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

      <div className="px-5 pt-5 space-y-3">
        {/* 空状态 */}
        {activeInstances.length === 0 && completedInstances.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🌱</div>
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
              className="bg-white rounded-2xl overflow-hidden shadow-sm"
              style={{ borderLeft: `4px solid ${project.color}` }}
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
                    <span className="text-xs font-semibold" style={{ color: project.color }}>
                      {Math.round((inst.currentWeek / inst.targetWeeks) * 100)}%
                    </span>
                  </div>
                  <ProgressBar current={inst.currentWeek} total={inst.targetWeeks} color={project.color} />
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  {inst.status === 'active' && (
                    <button
                      onClick={() => navigate(`/projects/${inst.id}/calendar`)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                      style={{ backgroundColor: project.color }}
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
