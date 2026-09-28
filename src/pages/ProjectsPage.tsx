import React from 'react';
import { useNavigate } from 'react-router-dom';
import projectsData from '@/data/projects.json';
import { Project } from '@/lib/types';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const projects = projectsData as Project[];

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '新手友好';
      case 'intermediate': return '有一定基础';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/')} className="text-brand text-sm font-medium">
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-text">浏览项目</h1>
          <div className="w-12" />
        </div>
        <p className="text-sm text-muted">选择一个项目开始训练</p>
      </div>

      {/* Project List */}
      <div className="px-5 space-y-3">
        {projects.map(project => (
          <div
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}/start`)}
            className="relative bg-white rounded-2xl overflow-hidden cursor-pointer transition-all shadow-sm hover:shadow-md"
          >
            {/* Left color bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
              style={{ backgroundColor: project.color }}
            />

            <div className="pl-6 pr-5 py-5">
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ backgroundColor: `${project.color}18` }}
                >
                  {project.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-lg font-bold text-gray-800">{project.name}</h3>
                    <span className="text-sm text-gray-400">{project.subtitle}</span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-3">{project.description}</p>
                  <div className="flex flex-wrap gap-2">
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

                <div className="text-gray-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
