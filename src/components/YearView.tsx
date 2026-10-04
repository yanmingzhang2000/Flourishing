import React from 'react';
import { TrainingRecord } from '@/lib/types';

interface Props {
  year: number;
  records: TrainingRecord[];
  plans: any[]; // 该年所有周计划
  instance?: { startDate: string; targetWeeks: number }; // 项目实例信息
}

export const YearView: React.FC<Props> = ({ year, records, plans, instance }) => {
  const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  // 将 Date 对象转换为本地日期字符串 (YYYY-MM-DD)，避免时区问题
  const formatLocalDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // 获取某天的状态（优先检查记录，然后检查计划）
  const getDayStatus = (dateStr: string): 'done' | 'missed' | 'rest' | null => {
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
        const d = new Date(plan.startDate);
        d.setDate(d.getDate() + i);
        if (formatLocalDate(d) === dateStr) {
          const day = (Array.isArray(plan.days) ? plan.days : JSON.parse(plan.days))[i];
          // 休息日返回 'rest'，训练日返回 'missed'（未完成的训练）
          return day.type === 'rest' ? 'rest' : 'missed';
        }
      }
    }
    return null;
  };

  // 生成某月的日期格子（按周排列）
  const getMonthDays = (month: number) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const days: string[] = [];

    // 将 Date 对象转换为本地日期字符串 (YYYY-MM-DD)，避免时区问题
    const formatDate = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month - 1, i);
      days.push(formatDate(d));
    }
    return days;
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text">{year} 年训练记录</h2>
        <p className="text-xs text-muted mt-1">共完成 {records.filter(r => r.completed).length} 次训练</p>
      </div>

      {/* 12个月热力图 */}
      <div className="grid grid-cols-3 gap-4">
        {MONTH_NAMES.map((name, index) => {
          const month = index + 1;
          const days = getMonthDays(month);
          const completedDays = days.filter(d => getDayStatus(d) === 'done').length;

          return (
            <div key={month} className="bg-subtle rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-text">{name}</h3>
                <span className="text-[10px] text-muted">{completedDays}天</span>
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((dateStr, i) => {
                  const status = getDayStatus(dateStr);
                  return (
                    <div
                      key={i}
                      className={`aspect-square rounded-sm
                        ${status === 'done' ? 'bg-brand' :
                          status === 'missed' ? 'bg-accent-light' :
                          status === 'rest' ? 'bg-subtle' :
                          'bg-white'
                        }`}
                      title={dateStr}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted pt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-brand" />
          <span>已完成</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-accent-light" />
          <span>训练日</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-ice" />
          <span>休息日</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-white" />
          <span>无计划</span>
        </div>
      </div>
    </div>
  );
};
