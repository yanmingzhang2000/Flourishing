import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { BottomNav } from '@/components/BottomNav';
import { storage } from '@/lib/storage';
import { userApi, projectInstancesApi } from '@/lib/api';
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
      // Try server API first
      try {
        const serverInstances = await projectInstancesApi.getAll();
        setInstances(serverInstances);
      } catch {
        // Fallback to local storage
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
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-text">我的训练</h1>
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-5">
        {/* Active Projects */}
        {activeInstances.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">进行中</h2>
            <div className="space-y-3">
              {activeInstances.map(instance => {
                const project = getProjectInfo(instance.projectId);
                if (!project) return null;
                const progress = Math.min(100, Math.round((instance.currentWeek / instance.targetWeeks) * 100));
                
                return (
                  <div
                    key={instance.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
                  >
                    <div className="pl-5 pr-4 py-4">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ backgroundColor: `${project.color}18` }}
                        >
                          {project.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-text">{project.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${progress}%`, backgroundColor: project.color }}
                              />
                            </div>
                            <span className="text-xs text-muted">
                              第{instance.currentWeek}周/共{instance.targetWeeks}周
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex border-t border-gray-100">
                      <button
                        onClick={() => navigate(`/projects/${instance.projectId}/calendar`)}
                        className="flex-1 py-3 text-sm font-medium text-brand"
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
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">已暂停</h2>
            <div className="space-y-3">
              {pausedInstances.map(instance => {
                const project = getProjectInfo(instance.projectId);
                if (!project) return null;
                
                return (
                  <div
                    key={instance.id}
                    className="bg-gray-50 rounded-2xl overflow-hidden"
                  >
                    <div className="pl-5 pr-4 py-4">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 opacity-60"
                          style={{ backgroundColor: `${project.color}18` }}
                        >
                          {project.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-text opacity-70">{project.name}</h3>
                          <p className="text-xs text-muted">第{instance.currentWeek}周/共{instance.targetWeeks}周</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex border-t border-gray-200">
                      <button
                        onClick={() => handlePause(instance)}
                        className="flex-1 py-3 text-sm font-medium text-brand"
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

        {/* Empty State */}
        {instances.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">💪</div>
            <h2 className="text-lg font-bold text-text mb-2">还没有训练项目</h2>
            <p className="text-sm text-muted mb-6">开始你的第一个训练吧</p>
            <Button onClick={() => navigate('/projects')} className="inline-flex">
              浏览项目
            </Button>
          </div>
        )}

        {/* Add Button */}
        {instances.length > 0 && (
          <button
            onClick={() => navigate('/projects')}
            className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-medium text-muted hover:border-brand hover:text-brand transition-all"
          >
            + 添加新项目
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  );
};
