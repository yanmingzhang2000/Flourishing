import React from 'react';
import { useNavigate } from 'react-router-dom';
import projectsData from '@/data/projects.json';
import { Project } from '@/lib/types';

const getDifficultyLabel = (d: string) => {
  if (d === 'beginner') return '新手友好';
  if (d === 'intermediate') return '有一定基础';
  return '进阶';
};

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const projects = projectsData as Project[];

  return (
    <div className="min-h-screen bg-surface pb-10">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 border-b border-gray-100">
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
          <div>
            <h1 className="text-xl font-bold text-text">选择训练项目</h1>
            <p className="text-sm text-muted mt-0.5">选择你想改善的目标部位</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-3">
        {projects.map(project => (
          <button
            key={project.id}
            className="w-full text-left bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
            style={{ borderLeft: `4px solid ${project.color}` }}
            onClick={() => navigate(`/projects/${project.id}/start`)}
          >
            <div className="pl-5 pr-5 py-4">
              <div className="flex items-center gap-4">
                {/* 图标 */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ backgroundColor: `${project.color}18` }}
                >
                  {project.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <h3 className="text-base font-bold text-gray-800">{project.name}</h3>
                    <span className="text-sm text-gray-400">{project.subtitle}</span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-2.5 line-clamp-2">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${project.color}15`, color: project.color }}
                    >
                      {getDifficultyLabel(project.difficulty)}
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${project.color}15`, color: project.color }}
                    >
                      {project.duration_minutes} 分钟
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${project.color}15`, color: project.color }}
                    >
                      {project.target_area}
                    </span>
                  </div>
                </div>

                {/* 箭头 */}
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  style={{ color: project.color }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
