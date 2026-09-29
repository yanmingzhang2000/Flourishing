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

function getCompletionDate(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

const WEEK_OPTIONS: Array<4 | 6 | 8> = [4, 6, 8];

const WEEK_DESC: Record<number, string> = {
  4: '快速体验，适合先了解项目',
  6: '效果最佳，循序渐进',
  8: '深度强化，塑形更持久',
};

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
    <div className="min-h-screen bg-subtle flex flex-col">
      {/* Header */}
      <div className="bg-brand px-8 pt-12 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="返回"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">开始训练</h1>
        </div>
      </div>

      {/* 两栏内容区 */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-8 py-8 grid grid-cols-2 gap-8 items-start">

        {/* 左栏：项目信息 */}
        <div
          className="bg-white rounded-2xl overflow-hidden shadow-sm h-full flex flex-col"
          style={{ borderTop: `4px solid ${project.color}` }}
        >
          <div className="p-7 flex flex-col flex-1">
            {/* 图标 + 名称 */}
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl flex-shrink-0"
                style={{ backgroundColor: `${project.color}18` }}
              >
                {project.icon}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text">{project.name}</h2>
                <p className="text-sm text-muted mt-1">{project.subtitle}</p>
              </div>
            </div>

            {/* 描述 */}
            <p className="text-sm text-gray-600 leading-relaxed mb-6">{project.description}</p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mt-auto">
              <div
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: `${project.color}12` }}
              >
                <div className="text-xs text-muted mb-1">目标部位</div>
                <div className="text-sm font-semibold" style={{ color: project.color }}>{project.target_area}</div>
              </div>
              <div
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: `${project.color}12` }}
              >
                <div className="text-xs text-muted mb-1">每次时长</div>
                <div className="text-sm font-semibold" style={{ color: project.color }}>{project.duration_minutes} 分钟</div>
              </div>
              <div
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: `${project.color}12` }}
              >
                <div className="text-xs text-muted mb-1">难度</div>
                <div className="text-sm font-semibold" style={{ color: project.color }}>
                  {project.difficulty === 'beginner' ? '新手' : project.difficulty === 'intermediate' ? '中级' : '进阶'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右栏：周期选择 + CTA */}
        <div className="bg-white rounded-2xl shadow-sm p-7 flex flex-col gap-5">
          <div>
            <h3 className="text-base font-bold text-text mb-1">选择训练周期</h3>
            <p className="text-xs text-muted">根据你的目标选择合适的时长</p>
          </div>

          {/* 周期选项 */}
          <div className="flex flex-col gap-3">
            {WEEK_OPTIONS.map(w => (
              <button
                key={w}
                onClick={() => setTargetWeeks(w)}
                className={`flex items-center gap-4 px-4 py-4 rounded-2xl border-2 text-left transition-all ${
                  targetWeeks === w ? 'shadow-sm' : 'border-gray-200 hover:border-gray-300'
                }`}
                style={targetWeeks === w
                  ? { borderColor: project.color, backgroundColor: `${project.color}0E` }
                  : {}
                }
              >
                <div
                  className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-bold text-xl"
                  style={targetWeeks === w
                    ? { backgroundColor: project.color, color: '#fff' }
                    : { backgroundColor: '#F3F4F6', color: '#374151' }
                  }
                >
                  {w}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">{w} 周计划</span>
                    {w === 6 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${project.color}18`, color: project.color }}
                      >
                        推荐
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">{WEEK_DESC[w]}</p>
                </div>
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

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleStart}
            disabled={submitting}
            className="w-full py-4 rounded-2xl font-bold text-base text-white transition-all disabled:opacity-60 hover:opacity-90 mt-auto"
            style={{ backgroundColor: project.color }}
          >
            {submitting ? '创建中…' : `开始 ${targetWeeks} 周训练计划`}
          </button>
        </div>
      </div>
    </div>
  );
};
