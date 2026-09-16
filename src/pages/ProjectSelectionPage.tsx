import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { userApi, plansApi, clearToken } from '@/lib/api';
import { StructuredUnavailableResult } from '@/lib/types';
import projectsData from '@/data/projects.json';
import { Project } from '@/lib/types';

export const ProjectSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const projects = projectsData as Project[];
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<StructuredUnavailableResult | null>(null);

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  const handleContinue = async () => {
    if (selectedProjects.length === 0) return;
    setLoading(true);
    try {
      await userApi.updateProfile({ selected_projects: selectedProjects });
      const result = await plansApi.generate(1);
      if (result.outcome === 'temporarily_unavailable') {
        setUnavailable(result);
        return;
      }
      navigate('/calendar');
    } catch {
      // A failed generation is not a successful plan. Keep the selected
      // projects visible so the user can adjust them and retry explicitly.
      setUnavailable({
        outcome: 'temporarily_unavailable',
        display_message: '暂不可生成',
        requested_project_ids: [...selectedProjects],
        failed_eligibility_categories_by_project: {},
        unknown_input_values: [],
        experience: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate('/auth');
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '新手友好';
      case 'intermediate': return '有一定基础';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* 品牌 Banner */}
      <div className="bg-gradient-to-r from-[#7DC47A] to-[#10B981] text-white py-12 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <img src="./vite.svg" alt="Flourish AI" className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-bold">Flourish AI</h1>
            </div>
            <p className="text-white/90">每天15分钟，遇见更好的自己</p>
          </div>
          <button onClick={handleLogout} className="text-white/70 text-sm hover:text-white absolute right-4 top-4">
            退出
          </button>
        </div>
      </div>

      {/* 项目列表 */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-3 mb-6">
          {projects.map((project) => {
            const isSelected = selectedProjects.includes(project.id);
            return (
              <div
                key={project.id}
                className={`relative bg-white rounded-2xl overflow-hidden cursor-pointer transition-all shadow-sm hover:shadow-md ${
                  isSelected
                    ? 'ring-2 shadow-md'
                    : ''
                }`}
                style={isSelected ? { boxShadow: `0 0 0 2px ${project.color}` } : {}}
                onClick={() => toggleProject(project.id)}
              >
                {/* 左侧彩色竖条 */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
                  style={{ backgroundColor: project.color }}
                />

                {/* 选中勾 */}
                {isSelected && (
                  <div
                    className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: project.color }}
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                <div className="pl-6 pr-5 py-5">
                  <div className="flex items-center gap-4">
                    {/* icon 圆圈 */}
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleLogout} className="flex-1">退出登录</Button>
          <Button onClick={handleContinue} className="flex-1" disabled={selectedProjects.length === 0 || loading}>
          {loading ? '生成计划中…' : `开始训练 ${selectedProjects.length > 0 ? `(${selectedProjects.length})` : ''}`}
          </Button>
        </div>

        {unavailable && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="font-semibold text-amber-800">{unavailable.display_message}</p>
            <p className="mt-1 text-sm text-amber-700">当前选择没有安全且合格的动作，请调整个人偏好。</p>
          </div>
        )}

        {selectedProjects.length > 0 && (
          <div className="mt-6 p-4 bg-gradient-to-r from-[#7DC47A]/10 to-[#10B981]/10 rounded-xl border border-[#7DC47A]/20">
            <p className="text-sm text-gray-600 text-center">
              💡 已选择 <span className="font-bold text-[#7DC47A]">{selectedProjects.length}</span> 个项目，系统会智能安排训练频率
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

