import React from 'react';
import { TrainingRecord, WeeklyPlan } from '@/lib/types';
import { getDayStatus, calculateMaxStreak, formatLocalDate, getMonday } from '@/lib/calendarUtils';
import { HeatCell } from '@/components/calendar/HeatCell';
import { CalendarLegend } from '@/components/calendar/CalendarLegend';

interface Props {
  year: number;
  month: number;
  records: TrainingRecord[];
  plans: WeeklyPlan[]; // 该月所有周计划
  instance?: { startDate: string; targetWeeks: number }; // 项目实例信息
  onMonthChange: (year: number, month: number) => void;
  /** V2：由外部提供跳转逻辑 */
  onDayClick?: (date: string, dayIndex: number) => void;
}

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日'];

export const MonthView: React.FC<Props> = ({ year, month, records, plans, instance, onMonthChange, onDayClick }) => {

  // 生成日历格子（包含上月尾、本月、下月初）
  const getCalendarDays = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startWeekday = firstDay.getDay(); // 0=周日, 1=周一, ..., 6=周六
    const daysInMonth = lastDay.getDate();

    const days: { date: string; inMonth: boolean; day: number }[] = [];

    // 将 Date 对象转换为本地日期字符串 (YYYY-MM-DD)，避免时区问题
    const formatDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // 转换为周一开始的索引：周一=0, 周二=1, ..., 周日=6
    const mondayBasedWeekday = startWeekday === 0 ? 6 : startWeekday - 1;

    // 上月尾巴
    const prevMonthLast = new Date(year, month - 1, 0).getDate();
    for (let i = mondayBasedWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 2, prevMonthLast - i);
      days.push({ date: formatDate(d), inMonth: false, day: prevMonthLast - i });
    }

    // 本月
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month - 1, i);
      days.push({ date: formatDate(d), inMonth: true, day: i });
    }

    // 下月开头补齐到 6 周
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month, i);
      days.push({ date: formatDate(d), inMonth: false, day: i });
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const today = formatLocalDate(new Date());

  // 计算本月统计
  const monthRecords = records.filter(r => {
    const recordDate = new Date(r.date);
    return recordDate.getFullYear() === year && recordDate.getMonth() === month - 1;
  });
  const completedCount = monthRecords.filter(r => r.completed).length;
  
  // 计算本月目标（本月内的训练日总数，含未来）
  const monthDays = calendarDays.filter(d => d.inMonth);
  let targetCount = 0;
  
  monthDays.forEach(d => {
    // 检查是否为训练日（不限制日期范围）
    const isTrainingDay = plans.some(plan => {
      const planDays = Array.isArray(plan.days) ? plan.days : JSON.parse(plan.days);
      
      // 遍历计划的每一天，检查是否匹配当前日期
      for (let i = 0; i < 7; i++) {
        const planDate = new Date(plan.startDate);
        planDate.setDate(planDate.getDate() + i);
        const planDateStr = formatLocalDate(planDate);
        
        if (planDateStr === d.date) {
          const jsDay = planDate.getDay();
          const isoDayIndex = jsDay === 0 ? 6 : jsDay - 1;
          const matchedDay = planDays.find((day: any) => day.dayIndex === isoDayIndex);
          return matchedDay && matchedDay.type === 'strength';
        }
      }
      return false;
    });
    
    if (isTrainingDay) {
      targetCount++;
    }
  });
  
  const maxStreak = calculateMaxStreak(records);

  // 计算月份导航边界
  const getMonthNavigationBounds = () => {
    if (!instance) return { canGoPrev: true, canGoNext: true };
    
    const start = new Date(instance.startDate);
    const end = new Date(instance.startDate);
    end.setDate(end.getDate() + instance.targetWeeks * 7);
    
    const minYear = start.getFullYear();
    const minMonth = start.getMonth() + 1;
    const maxYear = end.getFullYear();
    const maxMonth = end.getMonth() + 1;
    
    // 当前月是否可以向前/向后
    const canGoPrev = (year > minYear) || (year === minYear && month > minMonth);
    const canGoNext = (year < maxYear) || (year === maxYear && month < maxMonth);
    
    return { canGoPrev, canGoNext };
  };

  const { canGoPrev, canGoNext } = getMonthNavigationBounds();

  // 点击日期跳转到周视图
  const handleDayClick = (date: string) => {
    if (onDayClick) {
      const dateObj = new Date(date);
      const jsDay = dateObj.getDay();
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
      onDayClick(date, dayIndex);
    }
  };

  return (
    <div className="space-y-4">
      {/* 月份导航 + 网格容器 - 412px 居中 */}
      <div className="max-w-[412px] mx-auto">
        {/* 月份标题 + 统计 */}
        <div className="flex items-center justify-between mb-4">
          <button
          onClick={() => onMonthChange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)}
          disabled={!canGoPrev}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            canGoPrev 
              ? 'bg-subtle hover:bg-ice-light cursor-pointer' 
              : 'bg-subtle/30 cursor-not-allowed'
          }`}
        >
          <svg className={`w-4 h-4 ${canGoPrev ? 'text-text' : 'text-muted/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="flex-1 text-center">
          <h2 className="text-xl font-bold text-text">{year}年 {month}月</h2>
          <div className="flex items-center justify-center gap-4 text-xs text-muted mt-1">
            <span>
              完成 <strong className="text-brand">{completedCount}</strong>
              {targetCount > 0 && `/${targetCount}`} 次
            </span>
            <span>最长连续 <strong className="text-brand">{maxStreak}</strong> 天</span>
          </div>
        </div>
        
        <button
          onClick={() => onMonthChange(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)}
          disabled={!canGoNext}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            canGoNext 
              ? 'bg-subtle hover:bg-ice-light cursor-pointer' 
              : 'bg-subtle/30 cursor-not-allowed'
          }`}
        >
          <svg className={`w-4 h-4 ${canGoNext ? 'text-text' : 'text-muted/30'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 日历格子 */}
      <div>
        <div className="grid grid-cols-7 gap-2 mb-1">
          {DAY_NAMES.map(n => (
            <div key={n} className="text-center text-[11px] font-medium text-muted py-1">{n}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((d, i) => {
            const status = getDayStatus(d.date, records, plans, instance);
            const isClickable = d.inMonth && (status.type === 'completed' || status.type === 'today-completed' || status.type === 'todo' || status.type === 'today-todo');

            return (
              <div key={i} className="relative">
                {d.inMonth ? (
                  <HeatCell
                    status={status}
                    size="medium"
                    onClick={isClickable ? () => handleDayClick(d.date) : undefined}
                  >
                    <span className={`text-xs font-semibold ${
                      status.type === 'completed' || status.type === 'today-completed' ? 'text-white' :
                      status.type.includes('today') ? 'text-todo' :
                      'text-text'
                    }`}>
                      {d.day}
                    </span>
                  </HeatCell>
                ) : (
                  // 邻月：纯背景色 + 数字
                  <div className="w-8 h-8 flex items-center justify-center bg-subtle/30 rounded-[2px]">
                    <span className="text-xs text-muted/50">{d.day}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {/* 统一图例 */}
      <CalendarLegend variant="month" />
    </div>
  );
};
