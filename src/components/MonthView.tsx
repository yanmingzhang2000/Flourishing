import React from 'react';
import { TrainingRecord } from '@/lib/types';

interface Props {
  year: number;
  month: number;
  records: TrainingRecord[];
  plans: any[]; // 该月所有周计划
  onMonthChange: (year: number, month: number) => void;
}

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export const MonthView: React.FC<Props> = ({ year, month, records, plans, onMonthChange }) => {

  // 生成日历格子（包含上月尾、本月、下月初）
  const getCalendarDays = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startWeekday = firstDay.getDay(); // 0=周日
    const daysInMonth = lastDay.getDate();

    const days: { date: string; inMonth: boolean; day: number }[] = [];

    // 上月尾巴
    const prevMonthLast = new Date(year, month - 1, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month - 2, prevMonthLast - i);
      days.push({ date: d.toISOString().split('T')[0], inMonth: false, day: prevMonthLast - i });
    }

    // 本月
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month - 1, i);
      days.push({ date: d.toISOString().split('T')[0], inMonth: true, day: i });
    }

    // 下月开头补齐到 6 周
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d.toISOString().split('T')[0], inMonth: false, day: i });
    }

    return days;
  };

  const getRecordStatus = (dateStr: string): 'done' | 'missed' | 'rest' | null => {
    const record = records.find(r => r.date === dateStr);
    if (record) return record.completed ? 'done' : 'missed';

    // 检查是否在计划中
    for (const plan of plans) {
      const startDate = new Date(plan.startDate);
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        if (d.toISOString().split('T')[0] === dateStr) {
          const day = (Array.isArray(plan.days) ? plan.days : JSON.parse(plan.days))[i];
          return day.type === 'rest' ? 'rest' : null;
        }
      }
    }
    return null;
  };

  const calendarDays = getCalendarDays();
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* 月份标题 */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => onMonthChange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)}
          className="w-8 h-8 rounded-lg bg-subtle hover:bg-ice-light flex items-center justify-center"
        >
          <svg className="w-4 h-4 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-text min-w-[120px] text-center">
          {year}年 {month}月
        </h2>
        <button
          onClick={() => onMonthChange(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)}
          className="w-8 h-8 rounded-lg bg-subtle hover:bg-ice-light flex items-center justify-center"
        >
          <svg className="w-4 h-4 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            return (
              <div
                key={i}
                className={`aspect-square rounded-lg flex items-center justify-center relative
                  ${!d.inMonth ? 'opacity-30' : ''}
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
