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
    medium: 'w-[52px] h-[52px]',   // 月视图
    large: 'w-16 h-16'              // 周视图
  }[size];
  
  // 背景色映射（静态类名，避免 JIT 扫描遗漏）
  const getBgClass = () => {
    switch (status.type) {
      case 'completed':
      case 'today-completed':
        const level = Math.min(status.completedCount, 3);
        return level === 1 ? 'bg-heat-1' : level === 2 ? 'bg-heat-2' : 'bg-heat-3';
      case 'todo':
        // 年视图用纯背景色，周/月视图用边框
        return size === 'small' ? 'bg-todo/30' : 'bg-white border border-todo';
      case 'today-todo':
        return size === 'small' ? 'bg-todo/50' : 'bg-todo/10 border-2 border-todo';
      case 'empty':
      default:
        return 'bg-heat-empty';
    }
  };
  
  // 今日标记：使用 status.isToday 而不是 type 判断
  const todayRingClass = status.isToday
    ? size === 'small' 
      ? 'ring-1 ring-today-ring' // 年视图：细环，不放大
      : 'ring-2 ring-todo ring-offset-1' // 周/月视图：橙圈 + 偏移
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
