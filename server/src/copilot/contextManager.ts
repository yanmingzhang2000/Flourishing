/**
 * Context Manager - 上下文管理器
 * 
 * 负责加载和管理 Copilot 对话上下文
 */

import db from '../config/database';
import { CopilotContext, CopilotEvent, CopilotSession, CopilotSettings } from './types';

export class ContextManager {
  /**
   * 加载用户上下文
   */
  async load(userId: number | undefined, session: CopilotSession, event: CopilotEvent): Promise<CopilotContext> {
    const userProfile = userId ? await this.loadUserProfile(userId) : this.getGuestProfile();
    const trainingHistory = userId ? await this.loadTrainingHistory(userId) : this.getEmptyHistory();
    
    return {
      userId,
      sessionId: session.id,
      userProfile,
      trainingHistory,
      triggerEvent: event,
      feedback: event.type === 'training_feedback_submitted' ? event.data.feedback : undefined,
    };
  }

  /**
   * 加载用户档案
   */
  private async loadUserProfile(userId: number): Promise<CopilotContext['userProfile']> {
    const row = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId) as any;
    
    if (!row) {
      return {
        copilotSettings: {}
      };
    }

    let copilotSettings: CopilotSettings = {};
    try {
      copilotSettings = JSON.parse(row.copilot_settings || '{}');
    } catch {
      copilotSettings = {};
    }

    return {
      experience: row.experience,
      injuries: this.parseJsonArray(row.injuries),
      equipment: this.parseJsonArray(row.equipment),
      copilotSettings,
    };
  }

  /**
   * 加载训练历史
   */
  private async loadTrainingHistory(userId: number): Promise<CopilotContext['trainingHistory']> {
    const records = db.prepare(`
      SELECT feedback, date 
      FROM training_records 
      WHERE user_id = ? AND completed = 1 AND feedback IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(userId) as Array<{ feedback: string; date: string }>;

    const recentFeedback = records.map(r => ({ date: r.date, feedback: r.feedback }));
    
    // 统计最近 4 条记录中的 too_hard 和 too_easy 次数
    const recent4 = recentFeedback.slice(0, 4);
    const recentTooHardCount = recent4.filter(r => r.feedback === 'too_hard').length;
    const recentTooEasyCount = recent4.filter(r => r.feedback === 'too_easy').length;

    // 获取当前难度等级
    const currentDifficulty = this.getCurrentDifficulty(userId);

    return {
      recentFeedback,
      recentTooHardCount,
      recentTooEasyCount,
      currentDifficulty,
    };
  }

  /**
   * 获取当前难度等级（复制 plans.ts 的逻辑）
   */
  private getCurrentDifficulty(userId: number): 1 | 2 | 3 {
    // 检查用户偏好
    const profile = db.prepare('SELECT copilot_settings FROM user_profiles WHERE user_id = ?')
      .get(userId) as { copilot_settings?: string } | undefined;
    
    if (profile?.copilot_settings) {
      try {
        const settings: CopilotSettings = JSON.parse(profile.copilot_settings);
        if (settings.difficulty_preference === 'keep_low') return 1;
        if (settings.difficulty_preference === 'keep_high') return 3;
        if (settings.difficulty_preference === 'keep_standard') return 2;
      } catch {}
    }

    // 否则使用自动逻辑
    const recent = db.prepare(
      'SELECT feedback FROM training_records WHERE user_id = ? AND completed = 1 ORDER BY created_at DESC LIMIT 4'
    ).all(userId) as { feedback: string }[];
    
    if (!recent.length) return 2;
    if (recent.some(row => row.feedback === 'too_hard')) return 1;
    if (recent.filter(row => row.feedback === 'too_easy').length >= 2) return 3;
    return 2;
  }

  /**
   * 获取游客默认档案
   */
  private getGuestProfile(): CopilotContext['userProfile'] {
    return {
      copilotSettings: {}
    };
  }

  /**
   * 获取空历史
   */
  private getEmptyHistory(): CopilotContext['trainingHistory'] {
    return {
      recentFeedback: [],
      recentTooHardCount: 0,
      recentTooEasyCount: 0,
      currentDifficulty: 2,
    };
  }

  /**
   * 获取公开上下文（返回给前端）
   */
  getPublicContext(context: CopilotContext): Record<string, any> {
    return {
      recentFeedback: context.trainingHistory.recentFeedback,
      currentDifficulty: context.trainingHistory.currentDifficulty,
      recentTooHardCount: context.trainingHistory.recentTooHardCount,
      recentTooEasyCount: context.trainingHistory.recentTooEasyCount,
    };
  }

  /**
   * 解析 JSON 数组
   */
  private parseJsonArray(value: any): string[] {
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? value : [];
  }
}
