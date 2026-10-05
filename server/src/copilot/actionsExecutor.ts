/**
 * Actions Executor - 动作执行器
 * 
 * 负责执行用户选择的动作，调用业务 API
 */

import db from '../config/database';
import { CopilotContext, ActionExecutionResult } from './types';

type ActionHandler = (params: any, context: CopilotContext) => Promise<ActionExecutionResult>;

export class ActionsExecutor {
  private handlers: Map<string, ActionHandler> = new Map();

  constructor() {
    this.registerCoreActions();
  }

  /**
   * 注册核心动作
   */
  private registerCoreActions() {
    // 降低难度
    this.register('adjust_difficulty_lower', async (params, context) => {
      if (!context.userId) {
        return {
          success: false,
          message: '请先登录后再调整难度',
        };
      }

      await this.setDifficultyPreference(context.userId, 'keep_low');
      
      return {
        success: true,
        message: '已为你降低训练难度，下次生成计划时生效。',
      };
    });

    // 提高难度
    this.register('adjust_difficulty_higher', async (params, context) => {
      if (!context.userId) {
        return {
          success: false,
          message: '请先登录后再调整难度',
        };
      }

      await this.setDifficultyPreference(context.userId, 'keep_high');
      
      return {
        success: true,
        message: '已为你提高训练难度，准备好挑战吧！',
      };
    });

    // 保持当前难度
    this.register('keep_current_difficulty', async (params, context) => {
      if (!context.userId) {
        return {
          success: true,
          message: '好的，继续体验当前难度。',
        };
      }

      await this.setDifficultyPreference(context.userId, 'keep_standard');
      
      return {
        success: true,
        message: '好的，保持当前难度。如果后续觉得不合适，随时告诉我。',
      };
    });
  }

  /**
   * 注册动作处理器
   */
  register(actionId: string, handler: ActionHandler): void {
    this.handlers.set(actionId, handler);
  }

  /**
   * 执行动作
   */
  async execute(actionId: string, params: any, context: CopilotContext): Promise<ActionExecutionResult> {
    const handler = this.handlers.get(actionId);
    
    if (!handler) {
      return {
        success: false,
        message: `未知的动作: ${actionId}`,
      };
    }

    try {
      return await handler(params, context);
    } catch (error) {
      console.error(`Failed to execute action ${actionId}:`, error);
      return {
        success: false,
        message: '动作执行失败，请稍后重试',
      };
    }
  }

  /**
   * 设置用户难度偏好
   */
  private async setDifficultyPreference(
    userId: number,
    preference: 'keep_low' | 'keep_standard' | 'keep_high'
  ): Promise<void> {
    // 读取当前设置
    const row = db.prepare('SELECT copilot_settings FROM user_profiles WHERE user_id = ?')
      .get(userId) as { copilot_settings?: string } | undefined;

    let settings: any = {};
    if (row?.copilot_settings) {
      try {
        settings = JSON.parse(row.copilot_settings);
      } catch {}
    }

    // 更新偏好
    settings.difficulty_preference = preference;
    settings.last_interaction_at = new Date().toISOString();

    // 保存
    db.prepare('UPDATE user_profiles SET copilot_settings = ? WHERE user_id = ?')
      .run(JSON.stringify(settings), userId);
  }
}
