import React from 'react';
import { TrainingRecord, WeeklyPlan } from '@/lib/types';
import { YearHeatmap } from '@/components/calendar/YearHeatmap';
import { CalendarLegend } from '@/components/calendar/CalendarLegend';

interface Props {
  year: number;
  records: TrainingRecord[];
  plans: WeeklyPlan[]; // 该年所有周计划
  instance?: { startDate: string; targetWeeks: number }; // 项目实例信息
  onDayClick?: (date: string, dayIndex: number) => void; // 点击格子跳转到周视图
}

export const YearView: React.FC<Props> = ({ year, records, plans, instance, onDayClick }) => {
  
  const handleCellClick = (date: string) => {
    if (onDayClick) {
      const dateObj = new Date(date);
      const jsDay = dateObj.getDay();
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
      onDayClick(date, dayIndex);
    }
  };

  return (
    <div className="space-y-6">
      {/* GitHub 风格热力图 */}
      <YearHeatmap
        records={records}
        plans={plans}
        instance={instance}
        onCellClick={handleCellClick}
      />
      
      {/* 统一图例 */}
      <CalendarLegend variant="year" />
    </div>
  );
};
