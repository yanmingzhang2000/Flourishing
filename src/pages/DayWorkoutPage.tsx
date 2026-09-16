import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { storage } from '@/lib/storage';
import { plansApi, recordsApi, isLoggedIn } from '@/lib/api';
import { WeeklyPlan, WorkoutExercise } from '@/lib/types';
import projectsData from '@/data/projects.json';

const PROJECT_NAME_MAP: Record<string, string> = Object.fromEntries(
  (projectsData as any[]).map(p => [p.id, p.name])
);

export const DayWorkoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { date, dayIndex } = useParams<{ date: string; dayIndex: string }>();
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<'too_easy' | 'just_right' | 'too_hard' | null>(null);
  const [hasJointPain, setHasJointPain] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'warmup' | 'workout' | 'cooldown'>('workout');

  useEffect(() => {
    if (!date || dayIndex === undefined) {
      navigate('/calendar');
      return;
    }

    if (isLoggedIn()) {
      plansApi.getByDate(date).then(planRes => {
        if (!planRes) {
          navigate('/calendar');
          return;
        }
        setPlan(planRes);
      }).catch(() => navigate('/calendar'));
    } else {
      const savedPlan = storage.getWeeklyPlan();
      if (!savedPlan) {
        navigate('/calendar');
        return;
      }
      setPlan(savedPlan);
    }
  }, [navigate, date, dayIndex]);

  if (!plan || dayIndex === undefined) {
    return null;
  }

  const day = plan.days[parseInt(dayIndex)];
  if (!day) {
    return null;
  }

  const toggleExercise = (exerciseId: string) => {
    setCompletedExercises(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId);
      } else {
        newSet.add(exerciseId);
      }
      return newSet;
    });
  };

  const allCompleted = day.exercises.every(ex => completedExercises.has(ex.exerciseId));

  const handleComplete = () => {
    setShowFeedback(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedback || submitting) return;
    setSubmitting(true);

    if (isLoggedIn()) {
      try {
        await recordsApi.submit({
          date: date!,
          dayIndex: parseInt(dayIndex!),
          completed: true,
          feedback,
          hasJointPain,
          completedExercises: Array.from(completedExercises),
        });
      } catch (e) {
        storage.addTrainingRecord({
          date: date!,
          weekPlanId: plan.id,
          dayIndex: parseInt(dayIndex!),
          completed: true,
          feedback,
          hasJointPain,
          completedExercises: Array.from(completedExercises),
        });
      }
    } else {
      storage.addTrainingRecord({
        date: date!,
        weekPlanId: plan.id,
        dayIndex: parseInt(dayIndex!),
        completed: true,
        feedback,
        hasJointPain,
        completedExercises: Array.from(completedExercises),
      });
    }

    navigate('/calendar');
  };

  const totalExercises = day.exercises.length;
  const completedCount = day.exercises.filter(ex => completedExercises.has(ex.exerciseId)).length;

  return (
    <div className="h-screen flex flex-col bg-[#DCF0FB]">
      {/* 顶部导航栏 */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0">
        <button
          onClick={() => navigate('/calendar')}
          className="p-2 rounded-lg hover:bg-gray-100 mr-3"
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
              style={{ width: `${(completedCount / totalExercises) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 移动端 Tab 切换 */}
      <div className="md:hidden bg-white border-b border-gray-200 flex">
        <button
          onClick={() => setActiveTab('warmup')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'warmup'
              ? 'text-brand border-b-2 border-brand'
              : 'text-gray-500'
          }`}
        >
          热身
        </button>
        <button
          onClick={() => setActiveTab('workout')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'workout'
              ? 'text-[#7DC47A] border-b-2 border-[#7DC47A]'
              : 'text-gray-500'
          }`}
        >
          训练 ({completedCount}/{totalExercises})
        </button>
        <button
          onClick={() => setActiveTab('cooldown')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'cooldown'
              ? 'text-accent border-b-2 border-accent'
              : 'text-gray-500'
          }`}
        >
          拉伸
        </button>
      </div>

      {/* 桌面端三栏布局 / 移动端单栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左栏：热身 */}
        <div className={`${activeTab === 'warmup' ? 'flex' : 'hidden'} md:flex md:w-72 border-r border-gray-200 bg-white overflow-y-auto p-4 flex-shrink-0 flex-col w-full`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-brand/60 text-white flex items-center justify-center text-xs font-bold">
              热
            </span>
            <h2 className="font-bold text-gray-800">热身</h2>
            <span className="text-xs text-gray-400 ml-auto">5分钟</span>
          </div>
          
          {day.warmup && day.warmup.length > 0 ? (
            <div className="space-y-3">
              {day.warmup.map((exercise) => (
                <div key={exercise.id} className="p-3 bg-brand-light rounded-lg border border-brand/20">
                  <div className="font-medium text-gray-800 text-sm">{exercise.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{exercise.sets}组 × {exercise.reps}次</div>
                  <div className="text-xs text-brand mt-1">{exercise.rhythm}</div>
                  <p className="text-xs text-gray-500 mt-2">{exercise.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              今日无热身动作
            </div>
          )}
        </div>

        {/* 中栏：主训练动作 */}
        <div className={`${activeTab === 'workout' ? 'flex' : 'hidden'} md:flex flex-1 bg-[#DCF0FB] overflow-y-auto p-4 flex-col w-full`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-[#7DC47A] text-white flex items-center justify-center text-xs font-bold">
              练
            </span>
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
                    onClick={() => navigate(`/exercise/${workoutExercise.exerciseId}`)}
                  />
                ))}
              </div>

              {/* 完成按钮 */}
              <div className="mt-6">
                {!showFeedback ? (
                  <button
                    onClick={handleComplete}
                    disabled={!allCompleted}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                      allCompleted
                        ? 'bg-[#7DC47A] hover:bg-[#6DB569] text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {allCompleted ? '完成训练' : `完成所有动作 (${completedCount}/${totalExercises})`}
                  </button>
                ) : (
                  <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <h3 className="font-bold text-gray-800 mb-2">训练反馈</h3>
                    <p className="text-sm text-gray-500 mb-4">今天的训练感觉如何？</p>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <button
                        onClick={() => setFeedback('too_easy')}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          feedback === 'too_easy'
                            ? 'border-brand bg-brand-light'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">😊</div>
                        <div className="text-xs font-medium">太轻松</div>
                      </button>
                      <button
                        onClick={() => setFeedback('just_right')}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          feedback === 'just_right'
                            ? 'border-[#7DC47A] bg-[#7DC47A]/10'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">💪</div>
                        <div className="text-xs font-medium">刚刚好</div>
                      </button>
                      <button
                        onClick={() => setFeedback('too_hard')}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          feedback === 'too_hard'
                            ? 'border-[#F59E0B] bg-[#F59E0B]/10'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-2xl mb-1">😫</div>
                        <div className="text-xs font-medium">太难了</div>
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                      <input
                        type="checkbox"
                        checked={hasJointPain}
                        onChange={(e) => setHasJointPain(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#7DC47A] focus:ring-[#7DC47A]"
                      />
                      有关节不适
                    </label>

                    <button
                      onClick={handleSubmitFeedback}
                      disabled={!feedback || submitting}
                      className={`w-full py-3 rounded-lg font-medium transition-all ${
                        feedback && !submitting
                          ? 'bg-[#7DC47A] hover:bg-[#6DB569] text-white'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {submitting ? '提交中...' : '提交反馈'}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              今日无训练动作
            </div>
          )}
        </div>

        {/* 右栏：拉伸 */}
        <div className={`${activeTab === 'cooldown' ? 'flex' : 'hidden'} md:flex md:w-72 border-l border-gray-200 bg-white overflow-y-auto p-4 flex-shrink-0 flex-col w-full`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-accent/60 text-white flex items-center justify-center text-xs font-bold">
              拉
            </span>
            <h2 className="font-bold text-gray-800">拉伸</h2>
            <span className="text-xs text-gray-400 ml-auto">3分钟</span>
          </div>

          {day.cooldown && day.cooldown.length > 0 ? (
            <div className="space-y-3">
              {day.cooldown.map((exercise) => (
                <div key={exercise.id} className="p-3 bg-accent-light rounded-lg border border-accent/20">
                  <div className="font-medium text-gray-800 text-sm">{exercise.name}</div>
                  <div className="text-xs text-gray-500 mt-1">保持{exercise.reps}秒</div>
                  <div className="text-xs text-accent mt-1">{exercise.rhythm}</div>
                  <p className="text-xs text-gray-500 mt-2">{exercise.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              今日无拉伸动作
            </div>
          )}
        </div>
      </div>
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

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  workoutExercise,
  index,
  isCompleted,
  onToggle,
  onClick,
}) => {
  const { exercise, sets, reps, restBetweenSet } = workoutExercise;

  return (
    <div
      className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
        isCompleted
          ? 'border-[#7DC47A] bg-[#7DC47A]/10'
          : 'border-gray-200 bg-white hover:border-[#7DC47A]/50 hover:shadow-sm'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            isCompleted
              ? 'border-[#7DC47A] bg-[#7DC47A] text-white'
              : 'border-gray-300 hover:border-gray-400'
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