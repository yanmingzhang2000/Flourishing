import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WeeklyPlan, TrainingRecord } from '@/lib/types';
import { getDayStatus, calculateStreak, formatLocalDate } from '@/lib/calendarUtils';
import { HeatCell } from '@/components/calendar/HeatCell';
import { SessionAccordion } from '@/components/calendar/SessionAccordion';
import projectsData from '@/data/projects.json';

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

// projectId → 项目名称的映射，供训练列表显示
const PROJECT_NAME_MAP: Record<string, string> = Object.fromEntries(
  (projectsData as any[]).map(p => [p.id, p.name])
);

interface Props {
  plan: WeeklyPlan;
  records: TrainingRecord[];
  instance?: { startDate: string; targetWeeks: number }; // 项目实例信息
  /** V2：由外部提供跳转逻辑（携带 instanceId）；不传时使用内部默认路由 */
  onDayClick?: (date: string, dayIndex: number) => void;
}

export const WeekView: React.FC<Props> = ({ plan, records, instance, onDayClick }) => {
  const navigate = useNavigate();

  const goToDay = (date: string, dayIndex: number) => {
    if (onDayClick) {
      onDayClick(date, dayIndex);
    } else {
      navigate(`/workout/${date}/${dayIndex}`);
    }
  };

  const getDate = (dayIndex: number): string => {
    const d = new Date(plan.startDate);
    d.setDate(d.getDate() + dayIndex);
    return formatLocalDate(d);
  };

  const isToday = (dayIndex: number) =>
    getDate(dayIndex) === formatLocalDate(new Date());

  const getRecord = (dayIndex: number) =>
    records.find(r => r.date === getDate(dayIndex));

  // 检查日期是否在项目范围内
  const isDateInRange = (dayIndex: number): boolean => {
    if (!instance) return true; // 无实例限制 → 全部显示
    
    const checkDate = new Date(getDate(dayIndex));
    const startDate = new Date(instance.startDate);
    const endDate = new Date(instance.startDate);
    endDate.setDate(endDate.getDate() + instance.targetWeeks * 7);
    
    return checkDate >= startDate && checkDate < endDate;
  };

  // Q4: 默认展开逻辑 - 今天有训练展开今天，否则展开本周最近的未来待练日
  const getDefaultSelectedDay = (): number | null => {
    const todayIndex = plan.days.findIndex((_, i) => isToday(i));
    
    if (todayIndex >= 0) {
      const todayDay = plan.days[todayIndex];
      if (todayDay.type === 'strength' && isDateInRange(todayIndex)) {
        return todayIndex; // 今天有训练，展开今天
      }
    }
    
    // 今天是休息日，找本周最近的未来待练日
    const today = new Date(formatLocalDate(new Date()));
    const futureDays = plan.days
      .map((day, i) => ({ day, index: i, date: new Date(getDate(i)) }))
      .filter(({ day, index, date }) => 
        day.type === 'strength' && 
        isDateInRange(index) && 
        date > today
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    if (futureDays.length > 0) {
      return futureDays[0].index;
    }
    
    // 兜底：展开今天或第一个训练日
    if (todayIndex >= 0) return todayIndex;
    const firstTrainingDay = plan.days.findIndex((day, i) => day.type === 'strength' && isDateInRange(i));
    return firstTrainingDay >= 0 ? firstTrainingDay : null;
  };

  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(getDefaultSelectedDay);

  // 准备 session 数据
  const sessions = plan.days
    .map((day, index) => {
      if (day.type === 'rest' || !isDateInRange(index)) return null;
      const done = !!getRecord(index)?.completed;
      return {
        date: getDate(index),
        dayIndex: index,
        dayLabel: `周${DAY_LABELS[index]}`,
        projectName: day.projectId ? PROJECT_NAME_MAP[day.projectId] : undefined,
        exerciseCount: day.exercises?.length || 0,
        status: done ? 'completed' as const : 'todo' as const,
        isToday: isToday(index)
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // 计算统计数据
  const trainingDaysCount = plan.days.filter((d, i) => d.type === 'strength' && isDateInRange(i)).length;
  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const remainingCount = trainingDaysCount - completedCount;
  const streakDays = calculateStreak(records);

  const todayIndex = plan.days.findIndex((_, i) => isToday(i));
  const todayDay = todayIndex >= 0 ? plan.days[todayIndex] : null;

  return (
    <div className="space-y-5">
      {/* 今日快捷入口 */}
      {todayDay && todayDay.type !== 'rest' && !getRecord(todayIndex)?.completed && isDateInRange(todayIndex) && (
        <button
          onClick={() => goToDay(getDate(todayIndex), todayIndex)}
          className="w-full bg-brand rounded-2xl p-4 flex items-center justify-between text-white"
        >
          <div>
            <p className="text-xs text-white/70 mb-0.5">今天</p>
            <p className="font-bold text-lg">开始训练</p>
            <p className="text-sm text-white/80 mt-0.5">{todayDay.exercises.length} 个动作</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
        </button>
      )}

      {/* 本周格子 */}
      <div>
        <div className="grid grid-cols-7 gap-1.5 mb-1">
          {DAY_LABELS.map(l => (
            <div key={l} className="text-center text-[11px] text-muted font-medium py-1">{l}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {plan.days.map((day, index) => {
            const dateStr = getDate(index);
            const inRange = isDateInRange(index);
            const status = getDayStatus(dateStr, records, [plan], instance);
            const isRest = day.type === 'rest';
            const isSelected = selectedDayIndex === index;
            
            return (
              <button
                key={index}
                onClick={() => {
                  if (!isRest && inRange) {
                    setSelectedDayIndex(index);
                  }
                }}
                disabled={isRest || !inRange}
                className={`relative ${(isRest || !inRange) ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <HeatCell
                  status={status}
                  size="large"
                >
                  <div className="flex flex-col items-center justify-center">
                    <span className={`text-xs font-bold ${
                      !inRange ? 'text-muted/30' :
                      status.type === 'completed' || status.type === 'today-completed' ? 'text-white' : 
                      status.type.includes('today') ? 'text-todo' : 
                      isRest ? 'text-muted' : 'text-text'
                    }`}>
                      {dateStr.slice(8)}
                    </span>
                    <span className={`text-[10px] mt-0.5 ${
                      !inRange ? 'text-transparent' :
                      status.type === 'completed' || status.type === 'today-completed' ? 'text-white/80' : 
                      isRest ? 'text-muted/50' : 'text-muted'
                    }`}>
                      {inRange ? (
                        status.type === 'completed' || status.type === 'today-completed' ? '✓' : 
                        isRest ? '休' : '练'
                      ) : ''}
                    </span>
                  </div>
                </HeatCell>
                {isSelected && !isRest && inRange && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 手风琴 session 卡 */}
      <div>
        <h3 className="text-sm font-semibold text-muted mb-3">训练详情</h3>
        <SessionAccordion
          selectedDayIndex={selectedDayIndex}
          sessions={sessions}
          onStartWorkout={goToDay}
        />
      </div>

      {/* 底部统计 */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted pt-2 border-t border-subtle">
        <span>本周 <strong className="text-brand">{completedCount}</strong>/{trainingDaysCount} 次</span>
        <span>还差 <strong className="text-text">{remainingCount}</strong> 次</span>
        <span>连续 <strong className="text-brand">{streakDays}</strong> 天</span>
      </div>
    </div>
  );
};
