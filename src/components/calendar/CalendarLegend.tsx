import React from 'react';

interface Props {
  variant: 'week' | 'month' | 'year';
}

export const CalendarLegend: React.FC<Props> = ({ variant }) => {
  return (
    <div className="flex items-center justify-center gap-4 text-xs text-muted pt-4">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded bg-heat-empty" />
        <span>未训练</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded border-2 border-todo bg-white" />
        <span>待练·今日</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded bg-heat-1" />
        <div className="w-3 h-3 rounded bg-heat-2" />
        <div className="w-3 h-3 rounded bg-heat-3" />
        <span>已完成（深浅=次数）</span>
      </div>
    </div>
  );
};
