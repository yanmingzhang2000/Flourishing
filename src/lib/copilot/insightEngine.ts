/**
 * Insight Engine - 洞察消息规则引擎
 * 
 * 根据用户训练数据生成洞察文案
 */

export interface InsightFacts {
  view: 'week' | 'month' | 'year';
  week_progress?: { completed: number; target: number; remaining: number };
  month_progress?: { completed: number; target: number; remaining: number };
  year_stats?: { total: number; activeWeeks: number; maxStreak: number };
  current_streak: number;
  today_status: 'todo' | 'completed' | 'rest' | 'future';
  milestone?: 'first_workout' | 'streak_7' | 'streak_30' | 'target_achieved' | 'month_complete';
}

export interface InsightMessage {
  content: string;
  summary: string; // 用于 peek 胶囊的短摘要
  cta?: string; // Call-to-action 按钮文案
  ctaAction?: string; // CTA 按钮对应的动作
}

/**
 * 生成洞察消息
 */
export function generateInsight(facts: InsightFacts, trigger: 'page_load' | 'view_switch' | 'workout_complete'): InsightMessage {
  const { view, week_progress, month_progress, year_stats, current_streak, today_status, milestone } = facts;

  // 处理里程碑
  if (milestone) {
    return generateMilestoneMessage(milestone, facts);
  }

  // 根据视图生成消息
  if (view === 'week' && week_progress) {
    return generateWeekInsight(week_progress, today_status, current_streak);
  }

  if (view === 'month' && month_progress) {
    return generateMonthInsight(month_progress, today_status);
  }

  if (view === 'year' && year_stats) {
    return generateYearInsight(year_stats);
  }

  // 默认消息
  return {
    content: '继续保持训练节奏，每一次努力都在积累！💪',
    summary: '继续保持 💪',
  };
}

/**
 * 生成周视图洞察
 */
function generateWeekInsight(
  progress: { completed: number; target: number; remaining: number },
  todayStatus: string,
  streak: number
): InsightMessage {
  const { completed, target, remaining } = progress;
  
  // 已完成目标
  if (remaining <= 0) {
    const templates = [
      {
        content: `🎉 本周目标达成！你已完成 ${completed} 次训练，太棒了！\n\n${streak > 1 ? `连续 ${streak} 天训练，保持这个节奏！🔥` : '继续保持这个节奏！'}`,
        summary: `🎉 本周 ${completed}/${target}，已达成！`,
      },
      {
        content: `💪 本周 ${completed} 次训练全部完成！你的坚持让人佩服。\n\n${streak > 3 ? `已经连续 ${streak} 天了，势不可挡！🚀` : '继续加油！'}`,
        summary: `💪 本周已完成 ${completed} 次`,
      },
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // 进行中 + 今天待练
  if (todayStatus === 'todo') {
    const templates = [
      {
        content: `本周已练 ${completed}/${target}，还差 ${remaining} 次 💪\n\n今天的训练准备好了，动起来不难！`,
        summary: `本周 ${completed}/${target}，还差 ${remaining} 次`,
        cta: '开始今天训练',
        ctaAction: 'start_today_workout',
      },
      {
        content: `这周完成 ${completed} 次训练，${remaining === 1 ? '再坚持一次就达标了' : `还有 ${remaining} 次等你完成`}！\n\n${streak > 0 ? `已经连续 ${streak} 天训练，别让记录断了～` : '今天开始新的连续记录！'}`,
        summary: `本周 ${completed}/${target}`,
        cta: '开始训练',
        ctaAction: 'start_today_workout',
      },
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // 进行中 + 今天已完成
  if (todayStatus === 'completed') {
    const templates = [
      {
        content: `本周已练 ${completed}/${target}，${remaining === 0 ? '目标达成！🎉' : `还差 ${remaining} 次`}\n\n今天的训练已完成，感觉怎么样？`,
        summary: `本周 ${completed}/${target}`,
      },
      {
        content: `今天训练完成！本周进度 ${completed}/${target}。\n\n${remaining > 0 ? `继续加油，还有 ${remaining} 次就达标了！💪` : '本周目标已完成，真棒！🎉'}`,
        summary: `本周 ${completed}/${target}`,
      },
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // 进行中 + 今天休息
  const templates = [
    {
      content: `本周已练 ${completed}/${target}，还差 ${remaining} 次。\n\n今天是休息日，明天继续加油！💪`,
      summary: `本周 ${completed}/${target}`,
    },
  ];
  return templates[0];
}

/**
 * 生成月视图洞察
 */
function generateMonthInsight(
  progress: { completed: number; target: number; remaining: number },
  todayStatus: string
): InsightMessage {
  const { completed, target, remaining } = progress;
  const completionRate = Math.round((completed / target) * 100);

  if (remaining <= 0) {
    return {
      content: `🎉 本月训练目标达成！完成 ${completed} 次训练，完成率 ${completionRate}%。\n\n你的坚持正在带来改变！`,
      summary: `🎉 本月达成 ${completed} 次`,
    };
  }

  if (todayStatus === 'todo') {
    const templates = [
      {
        content: `本月已练 ${completed}/${target}，完成率 ${completionRate}%。\n\n今天继续保持节奏，每一次训练都是进步！💪`,
        summary: `本月 ${completed}/${target}，${completionRate}%`,
        cta: '开始今天训练',
        ctaAction: 'start_today_workout',
      },
    ];
    return templates[0];
  }

  return {
    content: `本月已练 ${completed}/${target}，完成率 ${completionRate}%。\n\n${remaining === 1 ? '再坚持一次就达标了！' : `还有 ${remaining} 次，继续加油！`}`,
    summary: `本月 ${completed}/${target}`,
  };
}

/**
 * 生成年视图洞察
 */
function generateYearInsight(stats: { total: number; activeWeeks: number; maxStreak: number }): InsightMessage {
  const { total, activeWeeks, maxStreak } = stats;

  if (total === 0) {
    return {
      content: '📊 这是你的年度训练记录。\n\n开始第一次训练，点亮日历吧！🌟',
      summary: '开始第一次训练 🌟',
    };
  }

  if (maxStreak >= 7) {
    return {
      content: `📊 近一年训练概览\n\n✅ 完成 ${total} 次训练\n🔥 最长连续 ${maxStreak} 天\n📅 活跃 ${activeWeeks} 周\n\n你的坚持令人敬佩！继续保持！`,
      summary: `年度 ${total} 次，最长 ${maxStreak} 天`,
    };
  }

  return {
    content: `📊 近一年训练概览\n\n✅ 完成 ${total} 次训练\n📅 活跃 ${activeWeeks} 周\n🔥 最长连续 ${maxStreak} 天\n\n每一次训练都是对自己的投资！💪`,
    summary: `年度 ${total} 次训练`,
  };
}

/**
 * 生成里程碑消息
 */
function generateMilestoneMessage(milestone: string, facts: InsightFacts): InsightMessage {
  switch (milestone) {
    case 'first_workout':
      return {
        content: '🎉 恭喜完成第一次训练！\n\n万事开头难，你已经迈出了最重要的一步。坚持下去，改变就会发生！',
        summary: '完成第一次训练 🎉',
      };
    
    case 'streak_7':
      return {
        content: '🔥 连续 7 天训练达成！\n\n你的坚持让人敬佩。习惯的养成需要 21 天，继续加油！',
        summary: '连续 7 天 🔥',
      };
    
    case 'streak_30':
      return {
        content: '🏆 连续 30 天训练达成！\n\n这已经不是坚持，而是生活方式了。为你点赞！👏',
        summary: '连续 30 天 🏆',
      };
    
    case 'target_achieved':
      return {
        content: '🎯 本周目标达成！\n\n你说到做到，这份自律值得骄傲。下周继续保持！',
        summary: '本周目标达成 🎯',
      };
    
    case 'month_complete':
      return {
        content: '🌟 本月训练计划全部完成！\n\n这个月的你，真的很棒。为自己鼓掌！👏',
        summary: '本月计划完成 🌟',
      };
    
    default:
      return {
        content: '继续保持训练节奏，每一次努力都在积累！💪',
        summary: '继续保持 💪',
      };
  }
}

/**
 * 生成消息摘要（用于 peek 胶囊）
 */
export function generateSummary(content: string): string {
  // 提取第一句话，最多 20 个字符
  const firstLine = content.split('\n')[0];
  if (firstLine.length <= 20) {
    return firstLine;
  }
  return firstLine.slice(0, 20) + '...';
}
