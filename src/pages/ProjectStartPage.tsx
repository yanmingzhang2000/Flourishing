import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectInstancesApi } from '@/lib/api';
import projectsData from '@/data/projects.json';
import { Project } from '@/lib/types';

const PROJECTS = Object.fromEntries((projectsData as Project[]).map(p => [p.id, p]));

const getDifficultyLabel = (d: string) => {
  if (d === 'beginner') return '新手友好 🌱';
  if (d === 'intermediate') return '有一定基础 🚶';
  return '进阶 💪';
};

// 格式化完成日期：从今天往后 n 周
function getCompletionDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

const WEEK_OPTIONS: Array<4 | 6 | 8> = [4, 6, 8];

export const ProjectStartPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const project = projectId ? PROJECTS[projectId] : null;

  const [targetWeeks, setTargetWeeks] = useState<4 | 6 | 8>(6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!project) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-muted">找不到该项目</p>
        <button onClick={() => navigate('/projects')} className="text-brand text-sm font-medium">
          返回项目列表
        </button>
      </div>
    );
  }

  const handleStart = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const instance = await projectInstancesApi.create(project.id, targetWeeks);
      navigate(`/projects/${instance.id}/calendar`);
    } catch (e: any) {
      setError(e.message || '创建失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="返回"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-text">开始训练</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-5 py-6 space-y-5">

          {/* 项目卡片 */}
          <div
            className="bg-white rounded-2xl overflow-hidden shadow-sm"
            style={{ borderLeft: `4px solid ${project.color}` }}
          >
            <div className="px-5 py-5">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0"
                  style={{ backgroundColor: `${project.color}18` }}
                >
                  {project.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text">{project.name}</h2>
                  <p className="text-sm text-muted mt-0.5">{project.subtitle}</p>
                </div>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-4">{project.description}</p>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <circle cx="12" cy="11" r="3" />
                  </svg>
                  {project.target_area}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                  </svg>
                  {project.duration_minutes} 分钟 / 次
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {getDifficultyLabel(project.difficulty)}
                </div>
              </div>
            </div>
          </div>

          {/* 时间线选择 */}
          <div className="bg-white rounded-2xl px-5 py-5 shadow-sm">
            <h3 className="text-sm font-bold text-text mb-1">训练时长</h3>
            <p className="text-xs text-muted mb-4">选择你的训练周期，可以随时查看进度</p>

            <div className="grid grid-cols-3 gap-3 mb-5">
              {WEEK_OPTIONS.map(w => (
                <button
                  key={w}
                  onClick={() => setTargetWeeks(w)}
                  className={`py-4 rounded-2xl border-2 text-center transition-all ${
                    targetWeeks === w
                      ? 'border-brand shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  style={targetWeeks === w ? { backgroundColor: `${project.color}12`, borderColor: project.color } : {}}
                >
                  <div
                    className="text-2xl font-bold"
                    style={targetWeeks === w ? { color: project.color } : { color: '#374151' }}
                  >
                    {w}
                  </div>
                  <div className="text-xs text-muted mt-0.5">周</div>
                  {w === 6 && <div className="text-xs mt-1 font-medium" style={{ color: project.color }}>推荐</div>}
                </button>
              ))}
            </div>

            {/* 预计完成 */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ backgroundColor: `${project.color}10` }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 flex-shrink-0" stroke="currentColor" strokeWidth={2} style={{ color: project.color }}>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M3 9h18" strokeLinecap="round" />
                <path d="M8 2v4M16 2v4" strokeLinecap="round" />
              </svg>
              <div>
                <p className="text-xs text-muted">预计完成</p>
                <p className="text-sm font-semibold" style={{ color: project.color }}>
                  {getCompletionDate(targetWeeks)}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* 底部 CTA（固定） */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 py-4">
        <button
          onClick={handleStart}
          disabled={submitting}
          className="w-full py-4 rounded-2xl font-bold text-base text-white transition-all disabled:opacity-60"
          style={{ backgroundColor: project.color }}
        >
          {submitting ? '创建中…' : `开始 ${targetWeeks} 周训练计划`}
        </button>
      </div>
    </div>
  );
};
