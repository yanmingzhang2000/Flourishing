/**
 * Intent Router - 意图路由器
 * 
 * 负责根据触发事件识别用户意图
 */

import { CopilotEvent, CopilotIntent } from './types';

export class IntentRouter {
  /**
   * 路由到对应的意图
   */
  route(event: CopilotEvent): CopilotIntent | null {
    // 规则 1: 训练完成
    if (event.type === 'training_completed') {
      return 'training_completed';
    }

    // 规则 2：训练反馈提交
    if (event.type === 'training_feedback_submitted') {
      return 'feedback_response';
    }

    // 规则 3：计划生成成功（且调整了难度）
    if (event.type === 'plan_generated' && event.data.difficultyAdjustment) {
      return 'plan_adjustment';
    }

    // 规则 4：用户连续 7 天未训练（预留）
    if (event.type === 'user_inactive' && event.data.daysSinceLastTraining >= 7) {
      return 'encouragement';
    }

    // 默认：无响应
    return null;
  }
}
