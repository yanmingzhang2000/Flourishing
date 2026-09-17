import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsApi, isLoggedIn } from '@/lib/api';
import { Exercise, ProjectExercises } from '@/lib/types';
import exercisesData from '@/data/exercises.json';
import { storage } from '@/lib/storage';

// 在所有项目的动作数据里搜索 exerciseId
function findExerciseInData(exerciseId: string, data: ProjectExercises): Exercise | null {
  for (const projectId of Object.keys(data)) {
    const proj = data[projectId];
    const all = [...(proj.warmup || []), ...(proj.exercises || []), ...(proj.cooldown || [])];
    const found = all.find(e => e.id === exerciseId);
    if (found) return found;
  }
  return null;
}

export const ExerciseDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [mediaMode, setMediaMode] = useState<'video' | 'image'>('video');

  useEffect(() => {
    if (!exerciseId) { navigate(-1); return; }

    const loadExercise = async () => {
      // 1. 先尝试本地全量 JSON 搜索（涵盖所有项目）
      const localData = exercisesData as ProjectExercises;
      const localFound = findExerciseInData(exerciseId, localData);
      if (localFound) { setExercise(localFound); return; }

      // 2. 本地没找到 → 如果已登录，从 API 拉取各项目动作再搜索
      if (isLoggedIn()) {
        try {
          // 优先用游客 profile 里的项目；若没有则遍历所有6个项目
          const profileProjects: string[] = storage.getUserProfile()?.selectedProjects || [];
          const projectIds = profileProjects.length > 0
            ? profileProjects
            : ['tricep_tone', 'hip_thigh_tone', 'lower_abs_tone', 'trap_relax', 'round_shoulder_fix', 'full_body_basic'];

          for (const pid of projectIds) {
            const data = await projectsApi.getExercises(pid);
            if (!data) continue;
            const all = [...(data.warmup || []), ...(data.exercises || []), ...(data.cooldown || [])];
            const found = all.find((e: Exercise) => e.id === exerciseId);
            if (found) { setExercise(found); return; }
          }
        } catch {
          // API 失败时降级到提示
        }
      }

      // 3. 都找不到 → 返回上一页
      navigate(-1);
    };

    loadExercise();
  }, [exerciseId, navigate]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) { setTimerActive(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [timerActive, timerSeconds]);

  const startTimer = (seconds: number) => { setTimerSeconds(seconds); setTimerActive(true); };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!exercise) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getEquipmentLabel = (equip: string) => {
    const labels: Record<string, string> = {
      none: '自重', chair: '椅子',
      'dumbbell_1kg_pair': '1kg哑铃', 'dumbbell_1.5kg_pair': '1.5kg哑铃',
      'dumbbell_2kg_pair': '2kg哑铃', 'dumbbell_3kg_pair': '3kg哑铃',
      'dumbbell_4kg_pair': '4kg哑铃', 'dumbbell_5kg_pair': '5kg哑铃',
      resistance_band: '弹力带',
    };
    return labels[equip] || equip;
  };

  return (
    <div className="h-screen flex flex-col bg-[#DCF0FB]">
      {/* 顶部导航栏 */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 mr-3" aria-label="返回">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-800">{exercise.name}</h1>
          <p className="text-sm text-gray-500">{exercise.primary_muscle}</p>
        </div>
        <span className="text-sm text-[#7DC47A] bg-[#7DC47A]/10 px-3 py-1 rounded-full font-medium">
          {exercise.sets}组 × {exercise.reps}次
        </span>
      </div>

      {/* 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左栏：步骤 */}
        <div className="w-56 border-r border-gray-200 bg-white overflow-y-auto p-4 flex-shrink-0">
          <h3 className="font-bold text-gray-800 mb-3 text-sm">执行步骤</h3>
          <div className="space-y-2">
            {exercise.steps.map((step, index) => (
              <div key={index} className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-[#7DC47A] text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                  {index + 1}
                </span>
                <p className="text-xs text-gray-600 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
          {exercise.tips && (
            <div className="mt-4 p-3 bg-[#7DC47A]/10 rounded-lg">
              <p className="text-xs text-[#7DC47A]">{exercise.tips}</p>
            </div>
          )}
          {exercise.warning && (
            <div className="mt-3 p-3 bg-[#F59E0B]/10 rounded-lg">
              <p className="text-xs text-[#F59E0B]">{exercise.warning}</p>
            </div>
          )}
        </div>

        {/* 中栏：视频/图片 */}
        <div className="flex-1 bg-white flex flex-col min-w-0 min-h-0">
          <div className="flex justify-center gap-2 p-2 flex-shrink-0">
            {(['video', 'image'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMediaMode(m)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  mediaMode === m ? 'bg-[#7DC47A] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {m === 'video' ? '视频' : '图片'}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center px-4 pb-4">
            {mediaMode === 'video' ? (
              <video
                key={`video-${exercise.id}`}
                src={`./videos/${exercise.id}.mp4`}
                controls autoPlay loop playsInline
                className="max-h-full max-w-full"
                style={{ objectFit: 'contain' }}
                onError={e => {
                  const t = e.target as HTMLVideoElement;
                  t.style.display = 'none';
                  const p = t.parentElement;
                  if (p && !p.querySelector('.media-fallback')) {
                    const d = document.createElement('div');
                    d.className = 'media-fallback text-center text-gray-400';
                    d.innerHTML = `<p class="text-lg mb-1">视频暂未上传</p><p class="text-sm">${exercise.id}.mp4</p>`;
                    p.appendChild(d);
                  }
                }}
              />
            ) : (
              <img
                key={`image-${exercise.id}`}
                src={`./images/${exercise.id}.png`}
                alt={exercise.name}
                className="max-h-full max-w-full"
                style={{ objectFit: 'contain' }}
                onError={e => {
                  const t = e.target as HTMLImageElement;
                  t.src = `./images/${exercise.id}.jpg`;
                  t.onerror = () => {
                    t.style.display = 'none';
                    const p = t.parentElement;
                    if (p && !p.querySelector('.media-fallback')) {
                      const d = document.createElement('div');
                      d.className = 'media-fallback text-center text-gray-400';
                      d.innerHTML = `<p class="text-lg mb-1">图片暂未上传</p><p class="text-sm">${exercise.id}.png</p>`;
                      p.appendChild(d);
                    }
                  };
                }}
              />
            )}
          </div>
        </div>

        {/* 右栏：信息 + 计时器 */}
        <div className="w-64 bg-white border-l border-gray-200 overflow-y-auto p-4 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#7DC47A]/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[#7DC47A]">{exercise.sets}</div>
              <div className="text-xs text-gray-500">组</div>
            </div>
            <div className="bg-[#7DC47A]/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-[#7DC47A]">{exercise.reps}</div>
              <div className="text-xs text-gray-500">次</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-500">节奏</p>
            <p className="text-sm text-[#7DC47A] font-medium">{exercise.rhythm}</p>
            <p className="text-xs text-gray-400 mt-1">休息 {exercise.rest_between_set}秒</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-500 mb-2">装备</p>
            <div className="flex flex-wrap gap-1">
              {exercise.equipment.map(equip => (
                <span key={equip} className="px-2 py-1 bg-white border border-gray-200 text-gray-600 rounded text-xs">
                  {getEquipmentLabel(equip)}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 text-center">
            <div className="text-3xl font-mono font-bold text-white mb-3">{formatTime(timerSeconds)}</div>
            <button
              onClick={() => startTimer(exercise.rest_between_set)}
              className="w-full py-2 bg-[#7DC47A] hover:bg-[#6DB569] text-white rounded-lg text-sm font-medium transition-colors mb-2"
            >
              休息 {exercise.rest_between_set}秒
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => startTimer(60)} className="py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors">1分钟</button>
              <button onClick={() => startTimer(90)} className="py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors">90秒</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
