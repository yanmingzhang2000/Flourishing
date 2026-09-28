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
    <div className="min-h-screen bg-ice-light pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-10 pb-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/')} className="text-brand text-sm font-medium">
            ← 返回
          </button>
          <h1 className="text-lg font-bold text-text">选择训练项目</h1>
          <div className="w-12" />
        </div>
        <p className="text-sm text-muted">选择你想改善的目标部位</p>
      </div>

      {/* Project Grid */}
      <div className="px-4 pt-4 grid grid-cols-3 gap-3">
        {projects.map(project => (
          <div
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}/start`)}
            className="bg-white rounded-2xl overflow-hidden cursor-pointer transition-all shadow-sm hover:shadow-md active:scale-[0.97]"
          >
            {/* Icon */}
            <div
              className="pt-5 pb-3 flex justify-center"
              style={{ backgroundColor: `${project.color}12` }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ backgroundColor: `${project.color}20` }}
              >
                {project.icon}
              </div>
            </div>

            {/* Content */}
            <div className="px-2.5 py-3 text-center">
              <h3 className="text-sm font-bold text-gray-800 leading-tight">{project.name}</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{project.subtitle}</p>

              <div className="flex items-center justify-center gap-1.5 mt-2.5">
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: `${project.color}15`, color: project.color }}
                >
                  {project.duration_minutes}min
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: `${project.color}15`, color: project.color }}
                >
                  {getDifficultyLabel(project.difficulty)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
