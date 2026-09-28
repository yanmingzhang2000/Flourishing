import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { projectsApi, projectInstancesApi } from '@/lib/api';
import { Project } from '@/lib/types';
import projectsData from '@/data/projects.json';
import { storage } from '@/lib/storage';
import { ProjectInstance } from '@/lib/types';

export const ProjectStartPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [targetWeeks, setTargetWeeks] = useState<4 | 6 | 8>(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const found = (projectsData as Project[]).find(p => p.id === id);
    if (found) {
      setProject(found);
    } else {
      navigate('/projects');
    }
  }, [id, navigate]);

  const calculateEndDate = () => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + targetWeeks * 7);
    return endDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleStart = async () => {
    if (!project) return;
    setLoading(true);
    setError('');

    try {
      // Try server API first
      try {
        await projectInstancesApi.create({
          project_id: project.id,
          target_weeks: targetWeeks,
        });
      } catch {
        // Fallback to local storage for guest mode
        const profile = storage.getUserProfile();
        if (profile) {
          const instance: ProjectInstance = {
            id: `${project.id}_${Date.now()}`,
            projectId: project.id,
            status: 'active',
            startDate: new Date().toISOString().split('T')[0],
            targetWeeks,
            currentWeek: 1,
            trainingDaysPerWeek: profile.maxTrainingDaysPerWeek || 3,
            sessionMinutes: profile.singleSessionMaxMin || 30,
            createdAt: new Date().toISOString(),
          };
          storage.addProjectInstance(instance);
        }
      }
      navigate(`/projects/${project.id}/calendar`);
    } catch (e) {
      setError('启动失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!project) {
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
        <button onClick={() => navigate('/projects')} className="text-brand text-sm font-medium mb-4 block">
          ← 返回
        </button>
      </div>

      <div className="px-5">
        {/* Project Info */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0"
            style={{ backgroundColor: `${project.color}18` }}
          >
            {project.icon}
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">{project.name}</h1>
            <p className="text-sm text-muted">{project.subtitle}</p>
          </div>
        </div>

        {/* Details */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">针对部位</span>
            <span className="font-medium text-text">{project.target_area}</span>
          </div>
          <div className="w-full h-px bg-gray-200" />
          <div className="flex justify-between text-sm">
            <span className="text-muted">难度</span>
            <span className="font-medium text-text">
              {project.difficulty === 'beginner' ? '新手友好' : '有一定基础'}
            </span>
          </div>
          <div className="w-full h-px bg-gray-200" />
          <div className="flex justify-between text-sm">
            <span className="text-muted">单次时长</span>
            <span className="font-medium text-text">{project.duration_minutes} 分钟</span>
          </div>
          <div className="w-full h-px bg-gray-200" />
          <div className="flex justify-between text-sm">
            <span className="text-muted">所需器械</span>
            <span className="font-medium text-text">{project.equipment_needed.join('、')}</span>
          </div>
        </div>

        {/* Timeline Config */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-text mb-3">训练时长</h2>
          <div className="flex gap-2">
            {[4, 6, 8].map(weeks => (
              <button
                key={weeks}
                onClick={() => setTargetWeeks(weeks as 4 | 6 | 8)}
                className={`flex-1 py-4 rounded-xl border-2 text-center font-semibold transition-all ${
                  targetWeeks === weeks
                    ? 'border-brand bg-brand text-white'
                    : 'border-gray-200 text-text'
                }`}
              >
                {weeks}周
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-3 text-center">
            预计完成：{calculateEndDate()}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        <Button onClick={handleStart} className="w-full" disabled={loading}>
          {loading ? '启动中…' : '开始训练'}
        </Button>
      </div>
    </div>
  );
};
