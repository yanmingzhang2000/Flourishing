/**
 * RuleEngine Snapshot - 单一数据源计算
 * 
 * 一次遍历生成全局 streak + 三窗口进度，确保三视图洞察的数字来自同一份快照
 */

import { TrainingRecord, WeeklyPlan } from '@/lib/types';
import { calculateStreak, formatLocalDate } from '@/lib/calendarUtils';

export interface WindowProgress {
  completed: number;
  target: number;
  remaining: number;
}

export interface RuleEngineSnapshot {
  asOf: string;                         // YYYY-MM-DD，快照基准日
  // —— 全局量（三视图共用，算一次）——
  streakThroughYesterday: number;       // 截至昨天连续天数
  streakIncludingToday: number;         // 含今天（= 昨天 + (今天已完成?1:0)）
  todayPlan: {
    hasSession: boolean;
    projectId?: string;
    equipment?: string[];
  };
  // —— 三窗口进度（同份记录分桶）——
  week: WindowProgress;
  month: WindowProgress;
  year: WindowProgress;
  // —— 可选：月/年镜头增强——
  monthLongestStreak?: number;          // 本月最长连续（暂不实现，保留接口）
  yearTotalSessions?: number;           // 本年累计训练天数
}

/**
 * 计算规则引擎快照
 * 
 * @param records - 所有训练记录
 * @param weekPlan - 当前周计划
 * @param monthPlans - 当前月的所有周计划
 * @param yearPlans - 当前年的所有周计划
 * @param asOf - 基准日期（通常为今天）
 * @param projectId - 可选，当前项目 ID
 */
export function computeSnapshot(params: {
  records: TrainingRecord[];
  weekPlan: WeeklyPlan | null;
  monthPlans: WeeklyPlan[];
  yearPlans: WeeklyPlan[];
  asOf: Date;
  projectId?: string;
}): RuleEngineSnapshot {
  const { records, weekPlan, monthPlans, yearPlans, asOf, projectId } = params;
  const asOfStr = formatLocalDate(asOf);
  
  // ── 1. 全局 streak（单次计算）──────────────────────────────────────────
  const streakIncludingToday = calculateStreak(records); // 复用现有算法
  const todayRecord = records.find(r => r.date === asOfStr && r.completed);
  const streakThroughYesterday = todayRecord ? Math.max(0, streakIncludingToday - 1) : streakIncludingToday;
  
  // ── 2. 今日计划 ────────────────────────────────────────────────────────
  const todayDayOfWeek = asOf.getDay(); // 0=周日, 1=周一...6=周六
  const todayIsoDayIndex = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1; // 转为ISO: 0=周一...6=周日
  
  let todayPlan = { hasSession: false } as RuleEngineSnapshot['todayPlan'];
  if (weekPlan) {
    const todayDay = weekPlan.days.find(d => d.dayIndex === todayIsoDayIndex);
    if (todayDay && todayDay.exercises && todayDay.exercises.length > 0) {
      // 从 exercises 中提取 equipment（从 exercise.equipment 字段）
      const equipment = Array.from(
        new Set(
          todayDay.exercises
            .flatMap(ex => ex.exercise?.equipment || [])
        )
      );
      
      todayPlan = {
        hasSession: true,
        projectId: projectId,
        equipment: equipment.length > 0 ? equipment : undefined,
      };
    }
  }
  
  // ── 3. 周窗口进度（复用 CalendarPage.tsx:123-133 现有算法）───────────────
  let weekProgress: WindowProgress = { completed: 0, target: 0, remaining: 0 };
  if (weekPlan) {
    const completed = weekPlan.days.reduce((sum, day) => {
      const dayRecord = records.find(r => {
        const recordDate = new Date(r.date);
        const planStart = new Date(weekPlan.startDate);
        const daysDiff = Math.floor((recordDate.getTime() - planStart.getTime()) / (24 * 3600 * 1000));
        return daysDiff >= 0 && daysDiff < 7 && recordDate.getDay() === day.dayIndex && r.completed;
      });
      return sum + (dayRecord ? 1 : 0);
    }, 0);
    const target = weekPlan.days.filter(d => d.exercises.length > 0).length;
    weekProgress = { completed, target, remaining: Math.max(0, target - completed) };
  }
  
  // ── 4. 月窗口进度 ──────────────────────────────────────────────────────
  const monthStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const monthEnd = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0);
  const monthRecords = records.filter(r => {
    const date = new Date(r.date);
    return date >= monthStart && date <= monthEnd && r.completed;
  });
  const monthTarget = monthPlans.reduce((sum, plan) => 
    sum + plan.days.filter(d => d.exercises.length > 0).length, 0
  );
  const monthProgress: WindowProgress = {
    completed: monthRecords.length,
    target: monthTarget,
    remaining: Math.max(0, monthTarget - monthRecords.length),
  };
  
  // ── 5. 年窗口进度 ──────────────────────────────────────────────────────
  const yearStart = new Date(asOf.getFullYear(), 0, 1);
  const yearEnd = new Date(asOf.getFullYear(), 11, 31);
  const yearRecords = records.filter(r => {
    const date = new Date(r.date);
    return date >= yearStart && date <= yearEnd && r.completed;
  });
  const yearTarget = yearPlans.reduce((sum, plan) => 
    sum + plan.days.filter(d => d.exercises.length > 0).length, 0
  );
  const yearProgress: WindowProgress = {
    completed: yearRecords.length,
    target: yearTarget,
    remaining: Math.max(0, yearTarget - yearRecords.length),
  };
  const yearTotalSessions = yearRecords.length; // 本年累计训练天数
  
  return {
    asOf: asOfStr,
    streakThroughYesterday,
    streakIncludingToday,
    todayPlan,
    week: weekProgress,
    month: monthProgress,
    year: yearProgress,
    yearTotalSessions,
  };
}
