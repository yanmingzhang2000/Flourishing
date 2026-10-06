import React from 'react';
import { TrainingRecord } from '@/lib/types';

interface Props {
  year: number;
  month: number;
  records: TrainingRecord[];
  plans: any[]; // 该月所有周计划
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

  // 将 Date 对象转换为本地日期字符串 (YYYY-MM-DD)，避免时区问题
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getRecordStatus = (dateStr: string): 'done' | 'missed' | 'rest' | null => {
    const record = records.find(r => r.date === dateStr);
    if (record) return record.completed ? 'done' : 'missed';

    // 检查是否在项目范围内
    if (instance) {
      const checkDate = new Date(dateStr);
      const startDate = new Date(instance.startDate);
      const endDate = new Date(instance.startDate);
      endDate.setDate(endDate.getDate() + instance.targetWeeks * 7);
      
      // 早于项目开始 或 晚于项目结束 → 不显示计划
      if (checkDate < startDate || checkDate >= endDate) {
        return null;
      }
    }

    // 检查是否在计划中
    for (const plan of plans) {
      for (let i = 0; i < 7; i++) {
        const d = new Date(plan.startDate);  // 每次循环都从原始 startDate 创建新的 Date 对象
        d.setDate(d.getDate() + i);  // 基于当前 Date 对象累加天数
        
        if (formatLocalDate(d) === dateStr) {
          // 计算这一天是星期几（ISO格式：0=周一...6=周日）
          const jsDay = d.getDay(); // 0=周日, 1=周一, ..., 6=周六
          const isoDayIndex = jsDay === 0 ? 6 : jsDay - 1; // 转为ISO标准
          
          // 在 plan.days 中查找匹配的 dayIndex
          const daysArray = Array.isArray(plan.days) ? plan.days : JSON.parse(plan.days);
          const matchedDay = daysArray.find((day: any) => day.dayIndex === isoDayIndex);
          
          if (matchedDay) {
            // 休息日返回 'rest'，训练日返回 'missed'（未完成的训练）
            return matchedDay.type === 'rest' ? 'rest' : 'missed';
          }
        }
      }
    }
    return null;
  };

  const calendarDays = getCalendarDays();
  const today = formatLocalDate(new Date());

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

  return (
    <div className="space-y-4">
      {/* 月份标题 */}
      <div className="flex items-center justify-center gap-3">
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
        <h2 className="text-xl font-bold text-text min-w-[120px] text-center">
          {year}年 {month}月
        </h2>
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
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map(n => (
            <div key={n} className="text-center text-[11px] font-medium text-muted py-1">{n}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((d, i) => {
            const status = getRecordStatus(d.date);
            const isToday = d.date === today;

            // 找到该日期对应的 dayIndex（用于跳转）
            const getDayIndex = (): number => {
              // 直接根据日期计算 dayIndex（ISO格式：0=周一...6=周日）
              const date = new Date(d.date);
              const jsDay = date.getDay(); // 0=周日, 1=周一...
              return jsDay === 0 ? 6 : jsDay - 1; // 转为ISO标准
            };

            // 计算是否可点击：必须是本月日期、有状态、且不是休息日
            const isClickable = d.inMonth && status && status !== 'rest';

            return (
              <div
                key={i}
                onClick={() => {
                  if (isClickable && onDayClick) {
                    onDayClick(d.date, getDayIndex());
                  }
                }}
                className={`aspect-square rounded-lg flex items-center justify-center relative transition-all
                  ${!d.inMonth ? 'opacity-30' : ''}
                  ${isClickable ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'}
                  ${status === 'done' ? 'bg-brand' :
                    status === 'missed' ? 'bg-accent-light' :
                    status === 'rest' ? 'bg-subtle' :
                    isToday ? 'ring-2 ring-brand bg-brand-light' :
                    'bg-white'
                  }`}
              >
                <span className={`text-xs font-semibold
                  ${status === 'done' ? 'text-white' :
                    isToday ? 'text-brand' :
                    d.inMonth ? 'text-text' : 'text-muted'}`}>
                  {d.day}
                </span>
                {status === 'done' && (
                  <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-brand" />
          <span>已完成</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-accent-light" />
          <span>未完成</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-subtle" />
          <span>休息</span>
        </div>
      </div>
    </div>
  );
};
