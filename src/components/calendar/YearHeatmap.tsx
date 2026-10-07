import React, { useState } from 'react';
import { TrainingRecord, WeeklyPlan } from '@/lib/types';
import { getDayStatus, formatLocalDate } from '@/lib/calendarUtils';
import { HeatCell } from './HeatCell';

interface Props {
  records: TrainingRecord[];
  plans: WeeklyPlan[];
  instance?: { startDate: string; targetWeeks: number };
  onCellClick: (date: string, dayIndex: number) => void;
}

interface MonthLabel {
  month: string;
  weekIndex: number;
  year?: number;
  isNewYear?: boolean;
}

export const YearHeatmap: React.FC<Props> = ({ records, plans, instance, onCellClick }) => {
  const [tooltip, setTooltip] = useState<{ date: string; x: number; y: number; count: number } | null>(null);

  // 计算滚动近 12 个月的日期范围（止于今天）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today); // 今天
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 365); // 近一年
  
  // 对齐 startDate 到周一
  const startWeekday = startDate.getDay();
  const mondayOffset = startWeekday === 0 ? -6 : 1 - startWeekday;
  startDate.setDate(startDate.getDate() + mondayOffset);
  
  // 计算需要多少周
  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const weeksCount = Math.ceil(diffDays / 7);
  
  // 生成网格，确保不超过今天
  const weeks: Array<Array<string | null>> = [];
  let currentDate = new Date(startDate);
  
  for (let week = 0; week < weeksCount; week++) {
    const weekDays: Array<string | null> = [];
    for (let day = 0; day < 7; day++) {
      if (currentDate <= endDate) {
        weekDays.push(formatLocalDate(currentDate));
      } else {
        weekDays.push(null); // 未来日期不渲染
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    weeks.push(weekDays);
  }
  
  // 计算月份标签位置
  const getMonthLabels = (): MonthLabel[] => {
    const labels: MonthLabel[] = [];
    let lastMonth = -1;
    let lastYear = -1;
    
    weeks.forEach((weekDays, weekIndex) => {
      const firstDay = weekDays.find(d => d !== null);
      if (firstDay) {
        const date = new Date(firstDay);
        const month = date.getMonth();
        const year = date.getFullYear();
        
        if (month !== lastMonth) {
          const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
          labels.push({
            month: monthNames[month],
            weekIndex,
            year,
            isNewYear: year !== lastYear
          });
          lastMonth = month;
          lastYear = year;
        }
      }
    });
    
    return labels;
  };
  
  const monthLabels = getMonthLabels();
  
  // 计算统计数据（排除未来日期的记录，避免数据污染导致统计失真）
  const totalCompletedDays = records.filter(r => r.completed && new Date(r.date) <= endDate).length;
  
  const handleMouseEnter = (e: React.MouseEvent, dateStr: string, status: any) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      date: dateStr,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      count: status.completedCount
    });
  };
  
  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="relative">
      {/* 头部统计 */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-text">近一年训练记录</h2>
        <div className="flex items-center justify-center gap-6 text-sm text-muted mt-2">
          <span>完成 <strong className="text-brand">{totalCompletedDays}</strong> 次</span>
          <span>最长连续 <strong className="text-brand">{calculateMaxStreak()}</strong> 天</span>
          <span>活跃 <strong className="text-brand">{calculateActiveWeeks()}</strong> 周</span>
        </div>
      </div>
      
      {/* 热力图网格 */}
      <div className="overflow-x-auto pb-4 scrollbar-hide">
        <div className="inline-block min-w-full">
          {/* 月份标签 + 年份分隔线 */}
          <div className="relative mb-2 pl-6" style={{ height: '24px' }}>
            {monthLabels.map((label) => (
              <React.Fragment key={label.weekIndex}>
                {/* 年份分隔线 */}
                {label.isNewYear && (
                  <>
                    <div 
                      className="absolute bg-muted/30"
                      style={{ 
                        left: `${label.weekIndex * 14}px`,
                        top: '0',
                        width: '1px',
                        height: '115px'
                      }}
                    />
                    {/* 年份标签 */}
                    <span 
                      className="absolute text-sm font-bold text-text"
                      style={{ 
                        left: `${label.weekIndex * 14 - 16}px`,
                        top: '-20px'
                      }}
                    >
                      {label.year}
                    </span>
                  </>
                )}
                
                {/* 月份标签 */}
                <div 
                  className="absolute text-xs text-muted"
                  style={{ left: `${label.weekIndex * 14}px` }}
                >
                  {label.month}
                </div>
              </React.Fragment>
            ))}
          </div>
          
          {/* 网格 */}
          <div className="flex gap-[3px]">
            {/* 周几标签（左侧） */}
            <div className="flex flex-col gap-[3px] pr-2">
              <div className="h-[11px] text-[10px] text-muted leading-[11px]">一</div>
              <div className="h-[11px] invisible">二</div>
              <div className="h-[11px] text-[10px] text-muted leading-[11px]">三</div>
              <div className="h-[11px] invisible">四</div>
              <div className="h-[11px] text-[10px] text-muted leading-[11px]">五</div>
              <div className="h-[11px] invisible">六</div>
              <div className="h-[11px] invisible">日</div>
            </div>
            
            {/* 53 列周格 */}
            {weeks.map((weekDays, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {weekDays.map((dateStr, dayIndex) => {
                  if (!dateStr) {
                    return <div key={dayIndex} className="w-[11px] h-[11px]" />;
                  }
                  
                  const status = getDayStatus(dateStr, records, plans, instance);
                  
                  return (
                    <div
                      key={dayIndex}
                      className="group relative"
                      onMouseEnter={(e) => handleMouseEnter(e, dateStr, status)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <HeatCell 
                        size="small" 
                        status={status}
                        onClick={() => {
                          const date = new Date(dateStr);
                          const jsDay = date.getDay();
                          const isoDay = jsDay === 0 ? 6 : jsDay - 1;
                          onCellClick(dateStr, isoDay);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Tooltip */}
      {tooltip && (
        <div 
          className="fixed bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none z-50 -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {formatDateText(tooltip.date)} · {tooltip.count > 0 ? `完成 ${tooltip.count} 次` : '未训练'}
        </div>
      )}
      
      {/* 空状态 */}
      {totalCompletedDays === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-xl">
          <div className="text-center">
            <p className="text-sm text-text mb-3">完成今天第一次训练，点亮第一格 🟩</p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-4 py-2 bg-brand text-white rounded-xl hover:bg-brand-dark transition-colors"
            >
              去训练
            </button>
          </div>
        </div>
      )}
    </div>
  );
  
  function calculateMaxStreak(): number {
    if (records.length === 0) return 0;

    const completedDates = records
      .filter(r => r.completed && new Date(r.date) <= endDate)
      .map(r => r.date)
      .sort();
    
    if (completedDates.length === 0) return 0;
    
    let maxStreak = 1;
    let currentStreak = 1;
    
    for (let i = 1; i < completedDates.length; i++) {
      const current = new Date(completedDates[i]);
      const previous = new Date(completedDates[i - 1]);
      const diffDays = Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    
    return maxStreak;
  }
  
  function calculateActiveWeeks(): number {
    const weekSet = new Set<string>();
    records
      .filter(r => r.completed && new Date(r.date) <= endDate)
      .forEach(r => {
        const date = new Date(r.date);
        const monday = new Date(date);
        const dayOfWeek = date.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        monday.setDate(monday.getDate() + mondayOffset);
        weekSet.add(formatLocalDate(monday));
      });
    return weekSet.size;
  }
  
  function formatDateText(dateStr: string): string {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    return `${month}月${day}日 ${weekday}`;
  }
};
