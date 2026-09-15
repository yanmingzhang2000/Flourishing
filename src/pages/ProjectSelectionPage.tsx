import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { userApi, clearToken } from '@/lib/api';
import projectsData from '@/data/projects.json';
import { Project } from '@/lib/types';

export const ProjectSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const projects = projectsData as Project[];
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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
      navigate('/intake');
    } catch {
      navigate('/intake');
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
    <div className="min-h-screen bg-white">
      {/* 品牌 Banner */}
      <div className="bg-gradient-to-r from-[#7DC47A] to-[#10B981] text-white py-12 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-3 mb-3">
              <img src="./vite.svg" alt="Flourish AI" className="w-12 h-12 drop-shadow-lg" />
              <h1 className="text-4xl font-bold">Flourish AI</h1>
            </div>
            <p className="text-white/90">选择训练目标，开启蜕变之旅</p>
          </div>
          <button onClick={handleLogout} className="text-white/70 text-sm hover:text-white absolute right-4 top-4">
            退出
          </button>
        </div>
      </div>

      {/* 项目列表 */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-4 mb-6">
          {projects.map((project) => {
            const isSelected = selectedProjects.includes(project.id);
            return (
              <div
                key={project.id}
                className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all ${
                  isSelected ? 'ring-4 ring-white shadow-2xl scale-[1.02]' : 'shadow-lg hover:shadow-xl'
                }`}
                style={{ background: `linear-gradient(135deg, ${project.color} 0%, ${(project as any).colorEnd || project.color}dd 100%)` }}
                onClick={() => toggleProject(project.id)}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-[#7DC47A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div className="p-6 text-white">
                  <div className="flex items-start gap-4">
                    <div className="text-5xl flex-shrink-0 drop-shadow-lg">{project.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-1">{project.name}</h3>
                      <p className="text-white/90 text-sm mb-3">{project.subtitle}</p>
                      <p className="text-white/80 text-sm leading-relaxed mb-4">{project.description}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">{getDifficultyLabel(project.difficulty)}</span>
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">{project.duration_minutes} 分钟</span>
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium">{project.target_area}</span>
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
            {loading ? '保存中...' : `继续 ${selectedProjects.length > 0 ? `(${selectedProjects.length})` : ''}`}
          </Button>
        </div>

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

