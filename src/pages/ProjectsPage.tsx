import React from 'react';
import { useNavigate } from 'react-router-dom';
import projectsData from '@/data/projects.json';
import { Project } from '@/lib/types';

const getDifficultyLabel = (d: string) => {
  if (d === 'beginner') return '新手友好';
  if (d === 'intermediate') return '有一定基础';
  return '进阶';
};

// 品牌绿相近色系，按项目顺序分配（与 projects.json 顺序对应）
const BRAND_PALETTE = [
  '#7DC47A', // 品牌绿
  '#5BAD89', // 深青绿
  '#4A9E8E', // 海绿
  '#6DB569', // 深品牌绿
  '#52C4A0', // 薄荷绿
  '#8FD4A0', // 浅叶绿
];

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const projects = projectsData as Project[];

  return (
    <div className="min-h-screen bg-subtle pb-10">
      {/* Header */}
      <div className="bg-brand px-8 pt-12 pb-6">
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="返回"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">选择训练项目</h1>
            <p className="text-sm text-white/70 mt-0.5">选择你想改善的目标部位</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 grid grid-cols-3 gap-6">
        {projects.map((project, idx) => {
          const accentColor = BRAND_PALETTE[idx % BRAND_PALETTE.length];
          return (
            <button
              key={project.id}
              className="text-left bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group"
              onClick={() => navigate(`/projects/${project.id}/start`)}
            >
              {/* 顶部彩色条纹 */}
              <div
                className="h-2 w-full"
                style={{ backgroundColor: accentColor }}
              />

              <div className="p-5">
                {/* 图标 + 标题行 */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: `${accentColor}18` }}
                  >
                    {project.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800 leading-tight">{project.name}</h3>
                    <span className="text-xs text-gray-400">{project.subtitle}</span>
                  </div>
                </div>

                {/* 描述 */}
                <p className="text-sm text-gray-500 leading-relaxed mb-4 line-clamp-2">
                  {project.description}
                </p>

                {/* 标签行 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                  >
                    {getDifficultyLabel(project.difficulty)}
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                  >
                    {project.duration_minutes} 分钟
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                  >
                    {project.target_area}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
