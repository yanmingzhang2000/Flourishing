import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Confetti from 'react-confetti';
import { toast } from 'sonner';
import { storage } from '@/lib/storage';
import { plansApi, recordsApi, isLoggedIn } from '@/lib/api';
import { WeeklyPlan, WorkoutExercise } from '@/lib/types';
import projectsData from '@/data/projects.json';
import { useCopilotContext } from '@/hooks/useCopilotContext';

const PROJECT_NAME_MAP: Record<string, string> = Object.fromEntries(
  (projectsData as any[]).map(p => [p.id, p.name])
);

export const DayWorkoutPage: React.FC = () => {
  const navigate = useNavigate();
  // V2 路由：/workout/:instanceId/:date/:dayIndex
  // 旧路由：/workout/:date/:dayIndex（兼容游客/旧链接）
  const params = useParams<{ instanceId?: string; date?: string; dayIndex?: string }>();

  // 如果有 instanceId 则是 V2 模式（instanceId 是纯数字字符串）
  const isV2 = !!params.instanceId && /^\d+$/.test(params.instanceId);
  const instanceId = isV2 ? params.instanceId! : undefined;
  const date = isV2 ? params.date : params.instanceId; // 旧路由 :instanceId slot 存的是 date
  const dayIndex = params.dayIndex;

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  const [hasJointPain, setHasJointPain] = useState(false);
  const [jointPainExerciseId, setJointPainExerciseId] = useState<string | null>(null);
  const [showJointPainModal, setShowJointPainModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'warmup' | 'workout' | 'cooldown'>('workout');
  const [showConfetti, setShowConfetti] = useState(false);
  const [trainingCompleted, setTrainingCompleted] = useState(false);

  // Copilot context
  const { triggerEvent, open: openCopilot } = useCopilotContext();
  
  // 返回时的目标路由
  const backPath = instanceId ? `/projects/${instanceId}/calendar` : '/calendar';

  useEffect(() => {
    if (!date || dayIndex === undefined) {
      navigate(backPath);
      return;
    }

    if (isLoggedIn()) {
      plansApi.getByDate(date).then(planRes => {
        if (!planRes) { navigate(backPath); return; }
        setPlan(planRes);
      }).catch(() => navigate(backPath));
    } else {
      const savedPlan = storage.getWeeklyPlan();
      if (!savedPlan) { navigate(backPath); return; }
      setPlan(savedPlan);
    }
  }, [navigate, date, dayIndex, backPath]);

  const handleTrainingComplete = async () => {
    setTrainingCompleted(true);
    
    // 1. 显示庆祝动画
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
    
    // 2. 记录完成状态（不含反馈）
    if (isLoggedIn()) {
      try {
        await recordsApi.submit({
          date: date!,
          dayIndex: parseInt(dayIndex!),
          completed: true,
          hasJointPain,
          jointPainExerciseId: jointPainExerciseId || undefined,
          completedExercises: Array.from(completedExercises),
        });
      } catch (error) {
        console.error('Failed to submit training record:', error);
      }
    } else {
      storage.addTrainingRecord({
        date: date!,
        weekPlanId: plan?.id || 0,
        dayIndex: parseInt(dayIndex!),
        completed: true,
        hasJointPain,
        completedExercises: Array.from(completedExercises),
      });
    }
    
    // 3. 触发 Copilot 事件（异步，不等待）
    triggerEvent({
      type: 'training_completed',
      data: {
        date: date!,
        completedExercises: Array.from(completedExercises),
      },
    });
    
    // 4. 显示庆祝 Toast（5秒）
    toast.success('🎉 训练完成！', {
      description: 'AI 教练正在为你准备反馈...',
      duration: 5000,
      action: {
        label: '查看反馈',
        onClick: () => openCopilot(),
      },
    });
    
    // 5. 延迟5秒后自动打开 Copilot（用户可选择提前离开）
    setTimeout(() => {
      openCopilot();
    }, 5000);
    
    // 6. 立即返回首页（而非日历页）
    setTimeout(() => {
      navigate('/');
    }, 500); // 短暂延迟确保动画效果
  };

  // 监听完成状态：所有动作完成时自动触发庆祝
  useEffect(() => {
    if (plan && dayIndex !== undefined) {
      const day = plan.days[parseInt(dayIndex)];
      if (day) {
        const allCompleted = day.exercises.every(ex => completedExercises.has(ex.exerciseId));
        if (allCompleted && !trainingCompleted) {
          handleTrainingComplete();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedExercises, trainingCompleted, plan, dayIndex]);

  if (!plan || dayIndex === undefined) return null;

  const day = plan.days[parseInt(dayIndex)];
  if (!day) return null;

  const toggleExercise = (exerciseId: string) => {
    setCompletedExercises(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  };

  const handleSubmitFeedback = async () => {
    // 如果勾选了关节不适但没有选择动作，打开模态框
    if (hasJointPain && !jointPainExerciseId) {
      setShowJointPainModal(true);
      return;
    }
    
    if (submitting) return;
    setSubmitting(true);

    // 更新训练记录，添加关节不适信息
    if (isLoggedIn() && jointPainExerciseId) {
      try {
        await recordsApi.submit({
          date: date!,
          dayIndex: parseInt(dayIndex!),
          completed: true,
          hasJointPain,
          jointPainExerciseId,
          completedExercises: Array.from(completedExercises),
        });
      } catch (error) {
        console.error('Failed to update training record:', error);
      }
    }

    setSubmitting(false);
    
    // 关闭模态框
    setShowJointPainModal(false);
  };

  const totalExercises = day.exercises.length;
  const completedCount = day.exercises.filter(ex => completedExercises.has(ex.exerciseId)).length;
  const allCompleted = day.exercises.every(ex => completedExercises.has(ex.exerciseId));

  return (
    <div className="h-screen flex flex-col bg-[#DCF0FB]">
      {/* 顶部导航栏 */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0">
        <button
          onClick={() => navigate(backPath)}
          className="p-2 rounded-lg hover:bg-gray-100 mr-3"
          aria-label="返回"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-800">{date}</h1>
          <p className="text-sm text-gray-500">
            {day.projectId ? PROJECT_NAME_MAP[day.projectId] ?? '力量训练' : '力量训练'}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <div className="text-sm text-gray-600">
            进度 <span className="font-bold text-[#7DC47A]">{completedCount}/{totalExercises}</span>
          </div>
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#7DC47A] transition-all duration-300"
              style={{ width: `${totalExercises > 0 ? (completedCount / totalExercises) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* 移动端 Tab 切换 */}
      <div className="md:hidden bg-white border-b border-gray-200 flex">
        {(['warmup', 'workout', 'cooldown'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === t ? 'text-brand border-b-2 border-brand' : 'text-gray-500'
            }`}
          >
            {t === 'warmup' ? '热身' : t === 'workout' ? `训练 (${completedCount}/${totalExercises})` : '拉伸'}
          </button>
        ))}
      </div>

      {/* 三栏布局 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 热身 */}
        <div className={`${activeTab === 'warmup' ? 'flex' : 'hidden'} md:flex md:w-72 border-r border-gray-200 bg-white overflow-y-auto p-4 flex-shrink-0 flex-col w-full`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-brand/60 text-white flex items-center justify-center text-xs font-bold">热</span>
            <h2 className="font-bold text-gray-800">热身</h2>
            <span className="text-xs text-gray-400 ml-auto">5分钟</span>
          </div>
          {day.warmup && day.warmup.length > 0 ? (
            <div className="space-y-3">
              {day.warmup.map(exercise => (
                <div key={exercise.id} className="p-3 bg-brand-light rounded-lg border border-brand/20">
                  <div className="font-medium text-gray-800 text-sm">{exercise.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{exercise.sets}组 × {exercise.reps}次</div>
                  <div className="text-xs text-brand mt-1">{exercise.rhythm}</div>
                  <p className="text-xs text-gray-500 mt-2">{exercise.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">今日无热身动作</div>
          )}
        </div>

        {/* 主训练 */}
        <div className={`${activeTab === 'workout' ? 'flex' : 'hidden'} md:flex flex-1 bg-[#DCF0FB] overflow-y-auto p-4 flex-col w-full`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-[#7DC47A] text-white flex items-center justify-center text-xs font-bold">练</span>
            <h2 className="font-bold text-gray-800">训练动作</h2>
            <span className="text-xs text-gray-400 ml-auto">点击查看详情</span>
          </div>

          {day.exercises && day.exercises.length > 0 ? (
            <>
              <div className="space-y-3">
                {day.exercises.map((workoutExercise, index) => (
                  <ExerciseCard
                    key={workoutExercise.exerciseId}
                    workoutExercise={workoutExercise}
                    index={index + 1}
                    isCompleted={completedExercises.has(workoutExercise.exerciseId)}
                    onToggle={() => toggleExercise(workoutExercise.exerciseId)}
                    onClick={() => navigate(`/exercise/${workoutExercise.exerciseId}`, {
                      state: {
                        snapshot: workoutExercise.exercise,
                        // Keep the legacy field for existing callers while making
                        // the historical-snapshot contract explicit.
                        exercise: workoutExercise.exercise,
                        planId: plan?.id,
                      },
                    })}
                  />
                ))}
              </div>

              <div className="mt-6">
                {!trainingCompleted ? (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-800">进度</div>
                        <div className="text-sm text-gray-500 mt-1">
                          已完成 {completedCount}/{totalExercises} 个动作
                        </div>
                      </div>
                      <div className="text-3xl">
                        {allCompleted ? '✅' : '⏳'}
                      </div>
                    </div>
                    {allCompleted && (
                      <div className="mt-3 text-sm text-[#7DC47A] font-medium">
                        🎉 训练完成！AI 教练正在为你准备反馈...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-[#7DC47A]/10 to-blue-50 rounded-xl p-5 border border-[#7DC47A]/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[#7DC47A] flex items-center justify-center text-white text-xl">
                        🎉
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">训练完成！</h3>
                        <p className="text-xs text-gray-500">查看右侧 AI 教练反馈</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={openCopilot}
                        className="flex-1 py-2.5 bg-[#7DC47A] text-white rounded-lg font-medium hover:bg-[#6DB569] transition"
                      >
                        查看反馈
                      </button>
                      <button
                        onClick={() => navigate(backPath)}
                        className="px-4 py-2.5 border-2 border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50 transition"
                      >
                        返回
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">今日无训练动作</div>
          )}
        </div>

        {/* 拉伸 */}
        <div className={`${activeTab === 'cooldown' ? 'flex' : 'hidden'} md:flex md:w-72 border-l border-gray-200 bg-white overflow-y-auto p-4 flex-shrink-0 flex-col w-full`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-accent/60 text-white flex items-center justify-center text-xs font-bold">拉</span>
            <h2 className="font-bold text-gray-800">拉伸</h2>
            <span className="text-xs text-gray-400 ml-auto">3分钟</span>
          </div>
          {day.cooldown && day.cooldown.length > 0 ? (
            <div className="space-y-3">
              {day.cooldown.map(exercise => (
                <div key={exercise.id} className="p-3 bg-accent-light rounded-lg border border-accent/20">
                  <div className="font-medium text-gray-800 text-sm">{exercise.name}</div>
                  <div className="text-xs text-gray-500 mt-1">保持{exercise.reps}秒</div>
                  <div className="text-xs text-accent mt-1">{exercise.rhythm}</div>
                  <p className="text-xs text-gray-500 mt-2">{exercise.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">今日无拉伸动作</div>
          )}
        </div>
      </div>
      
      {/* 底部安全提示 */}
      <div className="bg-yellow-50 border-t border-yellow-200 px-4 py-3">
        <p className="text-xs text-yellow-800 text-center">
          ⚠️ <strong>如感到任何不适、疼痛、头晕或呼吸困难，请立即停止训练</strong>
        </p>
      </div>
      
      {/* 关节不适动作选择模态框 */}
      {showJointPainModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-2">请选择导致不适的动作</h3>
            <p className="text-sm text-gray-600 mb-4">
              帮助我们记录这个动作，未来的训练计划将自动避开它。您也可以稍后在"个人档案"中管理禁用动作列表。
            </p>
            
            <div className="space-y-2 mb-6">
              {day.exercises.map((ex) => (
                <button
                  key={ex.exerciseId}
                  onClick={() => {
                    setJointPainExerciseId(ex.exerciseId);
                    setShowJointPainModal(false);
                    // 立即提交
                    setTimeout(() => handleSubmitFeedback(), 100);
                  }}
                  className="w-full p-3 text-left rounded-lg border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 transition-all"
                >
                  <div className="font-medium text-gray-800">{ex.exercise.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{ex.exercise.primary_muscle}</div>
                </button>
              ))}
            </div>
            
            <div className="bg-red-50 border-l-4 border-red-400 p-3 mb-4">
              <p className="text-xs text-red-800">
                <strong>⚠️ 重要提示：</strong>如果疼痛持续或加重，请及时就医。不要忍痛继续训练。
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowJointPainModal(false);
                  setHasJointPain(false);
                }}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-lg text-gray-600 font-medium hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowJointPainModal(false);
                  // 不选择动作，直接提交
                  setTimeout(() => handleSubmitFeedback(), 100);
                }}
                className="flex-1 py-2.5 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600"
              >
                稍后标记
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confetti 庆祝动画 */}
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}
    </div>
  );
};

interface ExerciseCardProps {
  workoutExercise: WorkoutExercise;
  index: number;
  isCompleted: boolean;
  onToggle: () => void;
  onClick: () => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ workoutExercise, index, isCompleted, onToggle, onClick }) => {
  const { exercise, sets, reps, restBetweenSet } = workoutExercise;
  return (
    <div
      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
        isCompleted ? 'border-[#7DC47A] bg-[#7DC47A]/10' : 'border-gray-200 bg-white hover:border-[#7DC47A]/50 hover:shadow-sm'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={e => { e.stopPropagation(); onToggle(); }}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            isCompleted ? 'border-[#7DC47A] bg-[#7DC47A] text-white' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          {isCompleted && (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#F59E0B]">#{index}</span>
            <h3 className="font-bold text-gray-800">{exercise.name}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-1">{exercise.primary_muscle}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-gray-800">{sets}组 × {reps}次</div>
          <div className="text-xs text-gray-400">休息{restBetweenSet}秒</div>
        </div>
        <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
};
