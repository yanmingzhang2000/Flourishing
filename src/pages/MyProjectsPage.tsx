import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { storage } from '@/lib/storage';
import { projectInstancesApi } from '@/lib/api';
import { ProjectInstance, Project } from '@/lib/types';
import projectsData from '@/data/projects.json';

export const MyProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [instances, setInstances] = useState<ProjectInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      try {
        const serverInstances = await projectInstancesApi.getAll();
        setInstances(serverInstances);
      } catch {
        const profile = storage.getUserProfile();
        if (profile?.projectInstances) {
          setInstances(profile.projectInstances);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const getProjectInfo = (projectId: string): Project | undefined => {
    return (projectsData as Project[]).find(p => p.id === projectId);
  };

  const handlePause = async (instance: ProjectInstance) => {
    const newStatus = instance.status === 'active' ? 'paused' : 'active';
    try {
      await projectInstancesApi.update(instance.id, { status: newStatus });
    } catch {
      storage.updateProjectInstance(instance.id, { status: newStatus });
    }
    loadProjects();
  };

  const activeInstances = instances.filter(i => i.status === 'active');
  const pausedInstances = instances.filter(i => i.status === 'paused');

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ice-light pb-24">
      {/* Header with brand gradient */}
      <div className="bg-gradient-to-br from-[#7DC47A] via-[#6DB569] to-[#10B981] px-5 pt-12 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">我的训练</h1>
            <p className="text-white/80 text-sm mt-1">加油 💪</p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-5 -mt-1">
        {/* Empty State */}
        {instances.length === 0 && (
          <div className="bg-white rounded-3xl shadow-sm p-8 text-center mt-4">
            {/* Illustration */}
            <div className="relative w-24 h-24 mx-auto mb-5">
              <div className="absolute inset-0 bg-brand-light rounded-full" />
              <div className="absolute inset-2 bg-brand/10 rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center text-5xl">
                🌱
              </div>
            </div>

            <h2 className="text-xl font-bold text-text mb-2">开始你的塑形之旅</h2>
            <p className="text-sm text-muted mb-6 max-w-[240px] mx-auto">
              6个专属训练项目，每天15分钟，遇见更好的自己
            </p>

            <button
              onClick={() => navigate('/projects')}
              className="w-full py-3.5 bg-brand hover:bg-brand-dark text-white font-bold rounded-2xl transition-all active:scale-[0.98]"
            >
              浏览训练项目
            </button>

            {/* Color dots decoration */}
            <div className="flex items-center justify-center gap-2 mt-6">
              <div className="w-2 h-2 rounded-full bg-brand" />
              <div className="w-2 h-2 rounded-full bg-accent" />
              <div className="w-2 h-2 rounded-full bg-[#60A5FA]" />
            </div>
          </div>
        )}

        {/* Active Projects */}
        {activeInstances.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full bg-brand" />
              <h2 className="text-sm font-semibold text-text">进行中</h2>
              <span className="text-xs text-muted ml-1">{activeInstances.length}</span>
            </div>
            <div className="space-y-3">
              {activeInstances.map(instance => {
                const project = getProjectInfo(instance.projectId);
                if (!project) return null;
                const progress = Math.min(100, Math.round((instance.currentWeek / instance.targetWeeks) * 100));

                return (
                  <div
                    key={instance.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm"
                  >
                    <div className="pl-4 pr-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ backgroundColor: `${project.color}18` }}
                        >
                          {project.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-text">{project.name}</h3>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${progress}%`, backgroundColor: project.color }}
                              />
                            </div>
                            <span className="text-[11px] text-muted whitespace-nowrap">
                              第{instance.currentWeek}/{instance.targetWeeks}周
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex border-t border-gray-100">
                      <button
                        onClick={() => navigate(`/projects/${instance.projectId}/calendar`)}
                        className="flex-1 py-3 text-sm font-semibold text-brand"
                      >
                        继续训练
                      </button>
                      <button
                        onClick={() => handlePause(instance)}
                        className="flex-1 py-3 text-sm font-medium text-muted border-l border-gray-100"
                      >
                        暂停
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Paused Projects */}
        {pausedInstances.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full bg-gray-300" />
              <h2 className="text-sm font-semibold text-muted">已暂停</h2>
            </div>
            <div className="space-y-3">
              {pausedInstances.map(instance => {
                const project = getProjectInfo(instance.projectId);
                if (!project) return null;

                return (
                  <div
                    key={instance.id}
                    className="bg-white/60 rounded-2xl overflow-hidden"
                  >
                    <div className="pl-4 pr-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 opacity-50"
                          style={{ backgroundColor: `${project.color}18` }}
                        >
                          {project.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-text opacity-60">{project.name}</h3>
                          <p className="text-[11px] text-muted">第{instance.currentWeek}/{instance.targetWeeks}周</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex border-t border-gray-100">
                      <button
                        onClick={() => handlePause(instance)}
                        className="flex-1 py-3 text-sm font-semibold text-brand"
                      >
                        恢复训练
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Button */}
        {instances.length > 0 && (
          <button
            onClick={() => navigate('/projects')}
            className="w-full mt-4 py-4 border-2 border-dashed border-brand/30 rounded-2xl text-sm font-medium text-brand hover:border-brand hover:bg-brand-light transition-all"
          >
            + 添加新项目
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  );
};
