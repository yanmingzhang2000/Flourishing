/**
 * Copilot 模板初始化脚本
 * 
 * 初始化反馈响应模板到数据库
 */

import db from '../config/database';

export function initCopilotTemplates() {
  const templates = [
    // ════════════════════════════════════════════════════════════════════════
    // 训练完成庆祝模板
    // ════════════════════════════════════════════════════════════════════════
    {
      id: 'training_completed_celebration',
      intent: 'training_completed',
      condition_expr: 'true', // 总是触发
      priority: 10,
      message_template: '🎉 太棒了！你完成了今天的训练！\n\n今天的训练感觉怎么样？',
      tone: 'celebratory',
      actions: JSON.stringify([
        { id: 'feedback_too_easy', label: '😊 太轻松', handler: 'submit_feedback_too_easy', style: 'secondary' },
        { id: 'feedback_just_right', label: '💪 刚刚好', handler: 'submit_feedback_just_right', style: 'primary' },
        { id: 'feedback_too_hard', label: '😫 太难了', handler: 'submit_feedback_too_hard', style: 'secondary' },
      ]),
      enabled: 1,
      version: 1,
    },

    // ════════════════════════════════════════════════════════════════════════
    // 训练反馈响应模板
    // ════════════════════════════════════════════════════════════════════════
    
    // 反馈响应 - 连续 2 次 too_hard
    {
      id: 'feedback_too_hard_warning',
      intent: 'feedback_response',
      condition_expr: 'feedback === "too_hard" && recentTooHardCount >= 1',
      priority: 10,
      message_template: '我注意到你最近{{recentTooHardCount + 1}}次训练都觉得有点难。\n\n下次生成计划时，我可以为你：\n• 选择难度更低的动作\n• 减少训练组数和次数\n\n要调整吗？',
      tone: 'warning',
      actions: JSON.stringify([
        {
          id: 'adjust_lower',
          label: '好的，帮我调整',
          handler: 'adjust_difficulty_lower',
          style: 'primary'
        },
        {
          id: 'keep_current',
          label: '暂不调整，我再试试',
          handler: 'keep_current_difficulty',
          style: 'secondary'
        }
      ]),
      enabled: 1,
      version: 1
    },
    
    // 反馈响应 - 连续 3 次 too_easy
    {
      id: 'feedback_too_easy_suggestion',
      intent: 'feedback_response',
      condition_expr: 'feedback === "too_easy" && recentTooEasyCount >= 2',
      priority: 10,
      message_template: '看起来现在的训练对你来说太轻松了！\n\n准备好挑战更高难度了吗？我可以为你：\n• 选择更有挑战的动作\n• 增加训练组数和次数',
      tone: 'encouraging',
      actions: JSON.stringify([
        {
          id: 'adjust_higher',
          label: '好的，提升难度',
          handler: 'adjust_difficulty_higher',
          style: 'primary'
        },
        {
          id: 'keep_current',
          label: '保持现状',
          handler: 'keep_current_difficulty',
          style: 'secondary'
        }
      ]),
      enabled: 1,
      version: 1
    },
    
    // 反馈响应 - just_right
    {
      id: 'feedback_just_right',
      intent: 'feedback_response',
      condition_expr: 'feedback === "just_right"',
      priority: 0,
      message_template: '太棒了！继续保持这个节奏💪',
      tone: 'celebratory',
      actions: JSON.stringify([]),
      enabled: 1,
      version: 1
    },
    
    // 反馈响应 - 首次 too_hard
    {
      id: 'feedback_too_hard_first',
      intent: 'feedback_response',
      condition_expr: 'feedback === "too_hard" && recentTooHardCount === 0',
      priority: 5,
      message_template: '收到！我会持续关注你的训练感受。\n如果接下来几次也觉得吃力，我会自动为你调整难度。',
      tone: 'informative',
      actions: JSON.stringify([]),
      enabled: 1,
      version: 1
    },
    
    // 反馈响应 - 首次 too_easy
    {
      id: 'feedback_too_easy_first',
      intent: 'feedback_response',
      condition_expr: 'feedback === "too_easy" && recentTooEasyCount <= 1',
      priority: 5,
      message_template: '收到！如果接下来几次也觉得轻松，我可以为你增加挑战。',
      tone: 'informative',
      actions: JSON.stringify([]),
      enabled: 1,
      version: 1
    }
  ];

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO copilot_templates 
      (id, intent, condition_expr, priority, message_template, tone, actions, enabled, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((templates: any[]) => {
    for (const t of templates) {
      insertStmt.run(
        t.id,
        t.intent,
        t.condition_expr,
        t.priority,
        t.message_template,
        t.tone,
        t.actions,
        t.enabled,
        t.version
      );
    }
  });

  insertMany(templates);
  console.log(`✅ Initialized ${templates.length} Copilot templates`);
}
