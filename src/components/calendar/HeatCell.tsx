import React from 'react';
import { DayStatus } from '@/lib/calendarUtils';

interface Props {
  status: DayStatus;
  size?: 'small' | 'medium' | 'large'; // year / month / week
  onClick?: () => void;
  children?: React.ReactNode;
}

export const HeatCell: React.FC<Props> = ({ status, size = 'medium', onClick, children }) => {
  const sizeClass = {
    small: 'w-[11px] h-[11px]',   // 年视图
    medium: 'w-8 h-8',              // 月视图
    large: 'w-12 h-12'              // 周视图
  }[size];
  
  // 背景色映射
  const getBgClass = () => {
    switch (status.type) {
      case 'completed':
        return `bg-heat-${Math.min(status.completedCount, 3)}`;
      case 'today-completed':
        return `bg-heat-${Math.min(status.completedCount, 3)}`;
      case 'todo':
        return 'bg-white border-2 border-todo';
      case 'today-todo':
        return 'bg-white border-2 border-todo';
      case 'empty':
      default:
        return 'bg-heat-empty';
    }
  };
  
  // 今天标记
  const todayRingClass = status.type.startsWith('today-') 
    ? size === 'small' 
      ? 'ring-2 ring-today-ring scale-110' // 年视图：深圈+放大
      : 'ring-2 ring-todo' // 周/月视图：橙圈
    : '';
  
  const clickable = onClick ? 'cursor-pointer hover:scale-105' : '';
  
  return (
    <div
      className={`${sizeClass} ${getBgClass()} ${todayRingClass} ${clickable} rounded-[2px] transition-transform flex items-center justify-center text-xs font-medium`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
