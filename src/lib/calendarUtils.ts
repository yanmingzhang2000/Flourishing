import { TrainingRecord, WeeklyPlan } from './types';
import projectsData from '@/data/projects.json';

// 项目名称映射表（projectId → 中文名），从 projects.json 静态构建
const PROJECT_NAME_MAP: Record<string, string> = Object.fromEntries(
  (projectsData as any[]).map(p => [p.id, p.name])
);

export type DayStatus = {
  type: 'completed' | 'todo' | 'today-todo' | 'today-completed' | 'empty';
  completedCount: number; // 0, 1, 2, 3+
  isToday: boolean; // 独立的今日标记，与 type 解耦
};

export interface ProjectInstance {
  startDate: string;
  targetWeeks: number;
}

// 将 Date 对象转换为本地日期字符串 (YYYY-MM-DD)
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 检查日期是否在项目范围内
function isDateInProjectRange(dateStr: string, instance: ProjectInstance): boolean {
  const checkDate = new Date(dateStr);
  const startDate = new Date(instance.startDate);
  const endDate = new Date(instance.startDate);
  endDate.setDate(endDate.getDate() + instance.targetWeeks * 7);
  
  return checkDate >= startDate && checkDate < endDate;
}

// 检查日期是否在计划中且为训练日
function isDateInPlans(dateStr: string, plans: WeeklyPlan[]): boolean {
  for (const plan of plans) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(plan.startDate);
      d.setDate(d.getDate() + i);
      
      if (formatLocalDate(d) === dateStr) {
        const jsDay = d.getDay(); // 0=周日, 1=周一...
        const isoDayIndex = jsDay === 0 ? 6 : jsDay - 1; // 转为ISO: 0=周一...6=周日
        
        const daysArray = Array.isArray(plan.days) ? plan.days : JSON.parse(plan.days);
        const matchedDay = daysArray.find((day: any) => day.dayIndex === isoDayIndex);
        
        return matchedDay && matchedDay.type === 'strength'; // 训练日
      }
    }
  }
  return false;
}

// 获取某天的状态（核心逻辑）
export function getDayStatus(
  dateStr: string,
  records: TrainingRecord[],
  plans: WeeklyPlan[],
  instance?: ProjectInstance
): DayStatus {
  const today = formatLocalDate(new Date());
  const isToday = dateStr === today;
  
  // 1. 检查记录（优先级最高）
  const dayRecords = records.filter(r => r.date === dateStr && r.completed);
  if (dayRecords.length > 0) {
    return {
      type: isToday ? 'today-completed' : 'completed',
      completedCount: Math.min(dayRecords.length, 3),
      isToday
    };
  }
  
  // 2. 检查是否在项目范围内
  if (instance && !isDateInProjectRange(dateStr, instance)) {
    return { type: 'empty', completedCount: 0, isToday };
  }
  
  // 3. 检查是否在计划中（使用正确的 dayIndex 映射）
  const isPlannedTrainingDay = isDateInPlans(dateStr, plans);
  
  if (isPlannedTrainingDay) {
    const dateObj = new Date(dateStr);
    const todayObj = new Date(today);
    const isFuture = dateObj > todayObj;
    
    if (isToday) {
      return { type: 'today-todo', completedCount: 0, isToday };
    } else if (isFuture) {
      return { type: 'todo', completedCount: 0, isToday: false };
    } else {
      // 过去未完成的训练日 → empty（不强调、不制造负罪感）
      return { type: 'empty', completedCount: 0, isToday: false };
    }
  }
  
  return { type: 'empty', completedCount: 0, isToday };
}

// 计算某个日期所在周的周一
export function getMonday(dateStr: string): string {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay(); // 0=周日, 1=周一...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(monday.getDate() + mondayOffset);
  return formatLocalDate(monday);
}

// 计算连续训练天数
export function calculateStreak(records: TrainingRecord[]): number {
  if (records.length === 0) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const completedDates = records
    .filter(r => r.completed && new Date(r.date) <= today) // 排除未来日期
    .map(r => r.date)
    .sort()
    .reverse(); // 从最近的日期开始
  
  if (completedDates.length === 0) return 0;
  
  let streak = 1;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);
  const todayStr = formatLocalDate(today);
  
  // 如果最近一次训练不是今天或昨天，连续天数为0
  if (completedDates[0] !== todayStr && completedDates[0] !== yesterdayStr) {
    return 0;
  }
  
  for (let i = 1; i < completedDates.length; i++) {
    const current = new Date(completedDates[i]);
    const previous = new Date(completedDates[i - 1]);
    const diffDays = Math.round((previous.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

// 计算最长连续天数
export function calculateMaxStreak(records: TrainingRecord[]): number {
  if (records.length === 0) return 0;
  
  const completedDates = records
    .filter(r => r.completed)
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

// 器械标签映射（完整枚举值 → 中文显示）
export function equipmentLabel(key: string): string {
  const equipmentMap: Record<string, string> = {
    // 哑铃系列
    'dumbbell_1kg_pair': '哑铃 1kg',
    'dumbbell_1.5kg_pair': '哑铃 1.5kg',
    'dumbbell_2kg_pair': '哑铃 2kg',
    'dumbbell_2.5kg_pair': '哑铃 2.5kg',
    'dumbbell_3kg_pair': '哑铃 3kg',
    'dumbbell': '哑铃',
    // 弹力带系列
    'resistance_band': '弹力带',
    'resistance_band_light': '弹力带（轻）',
    'resistance_band_medium': '弹力带（中）',
    'resistance_band_heavy': '弹力带（重）',
    // 其他器械
    'kettlebell': '壶铃',
    'barbell': '杠铃',
    'foam_roller': '泡沫轴',
    'yoga_mat': '瑜伽垫',
    'none': '自重',
    'bodyweight': '自重'
  };
  
  return equipmentMap[key] || '器械';
}

// 项目名称映射（projectId → 项目中文名）
export function getProjectName(projectId: string): string {
  return PROJECT_NAME_MAP[projectId] || '训练计划';
}
