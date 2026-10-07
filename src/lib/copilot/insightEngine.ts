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
 * 违规词过滤（合规检查）
 */
const BANNED_WORDS = ['瘦', '减脂', '燃脂', '医疗', '治疗', '疾病'];

function sanitizeMessage(text: string): string {
  let cleaned = text;
  BANNED_WORDS.forEach(word => {
    cleaned = cleaned.replace(new RegExp(word, 'g'), '');
  });
  return cleaned;
}

/**
 * 生成 Hero 展示态的大字寄语（确定性模板保底）
 */
export function generateHeroMessage(weekProgress: { completed: number; target: number }): string {
  const { completed, target } = weekProgress;
  const remaining = target - completed;

  // 确定性模板（合规保底）
  let message = '';
  if (remaining <= 0) {
    message = "本周达标，真棒 🎉";
  } else if (remaining === 1) {
    message = "再练一次就达标 💪";
  } else if (completed === 0) {
    message = "开始第一次训练 ✨";
  } else if (completed >= Math.ceil(target / 2)) {
    message = "继续保持节奏 🔥";
  } else {
    message = "继续，就很美 ✨";
  }

  return sanitizeMessage(message);
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
        content: `🎉 本周 ${completed} 次训练全达成！${streak > 1 ? `连续 ${streak} 天，保持节奏🔥` : '继续保持！'}`,
        summary: `🎉 本周 ${completed}/${target}，已达成！`,
      },
      {
        content: `💪 本周训练完成！${streak > 3 ? `连续 ${streak} 天，势不可挡🚀` : '继续加油！'}`,
        summary: `💪 本周已完成 ${completed} 次`,
      },
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // 进行中 + 今天待练
  if (todayStatus === 'todo') {
    const templates = [
      {
        content: `本周已练 ${completed}/${target}，还差 ${remaining} 次💪 今天动起来！`,
        summary: `本周 ${completed}/${target}，还差 ${remaining} 次`,
        cta: '开始今天训练',
        ctaAction: 'start_today_workout',
      },
      {
        content: `本周完成 ${completed} 次，${remaining === 1 ? '再练一次就达标！' : `还有 ${remaining} 次`}${streak > 0 ? ` 已连续 ${streak} 天～` : ''}`,
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
        content: `本周 ${completed}/${target}，${remaining === 0 ? '目标达成🎉' : `还差 ${remaining} 次`} 今天已完成！`,
        summary: `本周 ${completed}/${target}`,
      },
      {
        content: `今天训练完成！本周 ${completed}/${target}${remaining > 0 ? `，还有 ${remaining} 次💪` : '，目标达成🎉'}`,
        summary: `本周 ${completed}/${target}`,
      },
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // 进行中 + 今天休息
  const templates = [
    {
      content: `本周 ${completed}/${target}，还差 ${remaining} 次 今天休息，明天继续💪`,
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
      content: `🎉 本月目标达成！完成 ${completed} 次，${completionRate}% 你的坚持在带来改变！`,
      summary: `🎉 本月达成 ${completed} 次`,
    };
  }

  if (todayStatus === 'todo') {
    const templates = [
      {
        content: `本月 ${completed}/${target}，${completionRate}% 今天继续保持💪`,
        summary: `本月 ${completed}/${target}，${completionRate}%`,
        cta: '开始今天训练',
        ctaAction: 'start_today_workout',
      },
    ];
    return templates[0];
  }

  return {
    content: `本月 ${completed}/${target}，${completionRate}% ${remaining === 1 ? '再练一次就达标！' : `还有 ${remaining} 次💪`}`,
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
      content: '📊 年度训练记录 开始第一次训练，点亮日历🌟',
      summary: '开始第一次训练 🌟',
    };
  }

  if (maxStreak >= 7) {
    return {
      content: `📊 近一年：${total} 次训练、最长 ${maxStreak} 天、活跃 ${activeWeeks} 周 你的坚持令人敬佩！`,
      summary: `年度 ${total} 次，最长 ${maxStreak} 天`,
    };
  }

  return {
    content: `📊 近一年：${total} 次训练、${activeWeeks} 周活跃 每一次都是投资💪`,
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
        content: '🎉 完成第一次训练！迈出最重要一步，坚持下去改变会发生！',
        summary: '完成第一次训练 🎉',
      };
    
    case 'streak_7':
      return {
        content: '🔥 连续 7 天达成！习惯养成需要 21 天，继续加油！',
        summary: '连续 7 天 🔥',
      };
    
    case 'streak_30':
      return {
        content: '🏆 连续 30 天达成！这已是生活方式，为你点赞👏',
        summary: '连续 30 天 🏆',
      };
    
    case 'target_achieved':
      return {
        content: '🎯 本周目标达成！你说到做到，这份自律值得骄傲',
        summary: '本周目标达成 🎯',
      };
    
    case 'month_complete':
      return {
        content: '🌟 本月训练全部完成！这个月的你真的很棒👏',
        summary: '本月计划完成 🌟',
      };
    
    default:
      return {
        content: '继续保持训练节奏，每一次努力都在积累💪',
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
