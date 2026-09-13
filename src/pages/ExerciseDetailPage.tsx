import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import exercisesData from '@/data/exercises.json';
import { Exercise, ExerciseData } from '@/lib/types';

export const ExerciseDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [mediaMode, setMediaMode] = useState<'video' | 'image'>('video');

  useEffect(() => {
    const exercises = exercisesData as ExerciseData;
    const allExercises = [...exercises.warmup, ...exercises.exercises, ...exercises.cooldown];
    const found = allExercises.find(e => e.id === exerciseId);
    if (!found) {
      navigate('/calendar');
      return;
    }
    setExercise(found);
  }, [exerciseId, navigate]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, timerSeconds]);

  const startTimer = (seconds: number) => {
    setTimerSeconds(seconds);
    setTimerActive(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!exercise) {
    return null;
  }

  const getEquipmentLabel = (equip: string) => {
    const labels: Record<string, string> = {
      none: '自重',
      chair: '椅子',
      'dumbbell_1kg_pair': '1kg哑铃',
      'dumbbell_1.5kg_pair': '1.5kg哑铃',
      'dumbbell_2kg_pair': '2kg哑铃',
      resistance_band: '弹力带',
    };
    return labels[equip] || equip;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 顶部导航栏 */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 mr-3"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-800">{exercise.name}</h1>
          <p className="text-sm text-gray-500">{exercise.primary_muscle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-rose-500 bg-rose-50 px-3 py-1 rounded-full font-medium">
            {exercise.sets}组 × {exercise.reps}次
          </span>
        </div>
      </div>

      {/* 三栏布局：图大字小 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左栏：步骤简述 */}
        <div className="w-56 border-r border-gray-200 bg-white overflow-y-auto p-4 flex-shrink-0">
          <h3 className="font-bold text-gray-800 mb-3 text-sm">执行步骤</h3>
          <div className="space-y-2">
            {exercise.steps.map((step, index) => (
              <div key={index} className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                  {index + 1}
                </span>
                <p className="text-xs text-gray-600 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-xs text-green-700">{exercise.tips}</p>
          </div>

          <div className="mt-3 p-3 bg-orange-50 rounded-lg">
            <p className="text-xs text-orange-700">{exercise.warning}</p>
          </div>
        </div>

        {/* 中栏：视频/图片切换 */}
        <div className="flex-1 bg-gray-900 flex flex-col min-w-0 min-h-0">
          {/* 模式切换按钮 */}
          <div className="flex justify-center gap-2 p-2 flex-shrink-0">
            <button
              onClick={() => setMediaMode('video')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                mediaMode === 'video'
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              视频
            </button>
            <button
              onClick={() => setMediaMode('image')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                mediaMode === 'image'
                  ? 'bg-white text-gray-900'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              图片
            </button>
          </div>

          {/* 媒体内容区域 - 关键：用flex-1 + overflow-hidden撑满剩余空间 */}
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center px-4 pb-4">
            {mediaMode === 'video' ? (
              <video
                key={`video-${exercise.id}`}
                src={`./videos/${exercise.id}.mp4`}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-full max-w-full"
                style={{ objectFit: 'contain' }}
                onError={(e) => {
                  const target = e.target as HTMLVideoElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.video-fallback')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'video-fallback text-center text-gray-400';
                    fallback.innerHTML = `
                      <svg class="w-24 h-24 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p class="text-lg mb-1">视频暂未上传</p>
                      <p class="text-sm">请将视频放入 videos/ 文件夹</p>
                      <p class="text-sm">文件名: ${exercise.id}.mp4</p>
                      <button class="mt-4 px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-medium cursor-pointer" onclick="this.closest('[class*=bg-gray-900]').querySelectorAll('button')[1]?.click()">切换到图片模式</button>
                    `;
                    parent.appendChild(fallback);
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
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `./images/${exercise.id}.jpg`;
                  target.onerror = () => {
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.img-fallback')) {
                      const fallback = document.createElement('div');
                      fallback.className = 'img-fallback text-center text-gray-400';
                      fallback.innerHTML = `
                        <svg class="w-32 h-32 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p class="text-lg mb-1">图片暂未上传</p>
                        <p class="text-sm">请将图片放入 images/ 文件夹</p>
                        <p class="text-sm">文件名: ${exercise.id}.png</p>
                      `;
                      parent.appendChild(fallback);
                    }
                  };
                }}
              />
            )}
          </div>
        </div>

        {/* 右栏：训练信息 + 计时器 */}
        <div className="w-64 bg-white border-l border-gray-200 overflow-y-auto p-4 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-rose-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-rose-500">{exercise.sets}</div>
              <div className="text-xs text-gray-500">组</div>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-rose-500">{exercise.reps}</div>
              <div className="text-xs text-gray-500">次</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-500">节奏</p>
            <p className="text-sm text-rose-500 font-medium">{exercise.rhythm}</p>
            <p className="text-xs text-gray-400 mt-1">休息 {exercise.rest_between_set}秒</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-500 mb-2">装备</p>
            <div className="flex flex-wrap gap-1">
              {exercise.equipment.map((equip) => (
                <span
                  key={equip}
                  className="px-2 py-1 bg-white border border-gray-200 text-gray-600 rounded text-xs"
                >
                  {getEquipmentLabel(equip)}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 text-center">
            <div className="text-3xl font-mono font-bold text-white mb-3">
              {formatTime(timerSeconds)}
            </div>
            <button
              onClick={() => startTimer(exercise.rest_between_set)}
              className="w-full py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors mb-2"
            >
              休息 {exercise.rest_between_set}秒
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => startTimer(60)}
                className="py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors"
              >
                1分钟
              </button>
              <button
                onClick={() => startTimer(90)}
                className="py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors"
              >
                90秒
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};