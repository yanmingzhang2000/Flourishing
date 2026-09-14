import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { storage } from '@/lib/storage';
import projectsData from '@/data/projects.json';
import { Project } from '@/lib/types';

export const ProjectSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const projects = projectsData as Project[];
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };

  const handleContinue = () => {
    if (selectedProjects.length === 0) return;

    const existing = storage.getUserProfile();
    // 保存已选项目到临时 profile，intake 页面会补完其余信息
    storage.setUserProfile({
      ...(existing || {}),
      selectedProjects,
    } as any);
    navigate('/intake');
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return '⭐ 新手友好';
      case 'intermediate':
        return '⭐⭐ 有一定基础';
      case 'advanced':
        return '⭐⭐⭐ 进阶挑战';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-[#DCF0FB] p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">选择你的训练目标</h1>
          <p className="text-gray-600">可以选择多个项目，系统会为你智能安排训练计划</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`cursor-pointer transition-all ${
                selectedProjects.includes(project.id)
                  ? 'ring-4 ring-[#7DC47A]'
                  : ''
              }`}
              onClick={() => toggleProject(project.id)}
            >
              <Card
                className={selectedProjects.includes(project.id) ? 'bg-[#7DC47A]/5' : ''}
              >
                <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className="text-4xl flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${project.color}20` }}
                  >
                    {project.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{project.name}</h3>
                    <p className="text-sm text-gray-500 mb-2">{project.subtitle}</p>
                    <p className="text-sm text-gray-600 mb-3">{project.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{getDifficultyLabel(project.difficulty)}</span>
                      <span>⏱ {project.duration_minutes}分钟</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedProjects.includes(project.id)
                          ? 'bg-[#7DC47A] border-[#7DC47A]'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedProjects.includes(project.id) && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="flex-1"
          >
            返回
          </Button>
          <Button onClick={handleContinue} className="flex-1">
            继续 {selectedProjects.length > 0 && `(已选 ${selectedProjects.length} 个)`}
          </Button>
        </div>

        {selectedProjects.length > 0 && (
          <div className="mt-6 p-4 bg-white rounded-lg">
            <p className="text-sm text-gray-600">
              💡 提示：选择多个项目时，系统会根据你的可训练天数，自动安排每个项目的训练频率
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
