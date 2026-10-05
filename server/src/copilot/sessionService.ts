/**
 * Session Service - 会话管理服务
 * 
 * 负责创建、查询、更新 Copilot 会话和消息
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { CopilotSession, CopilotMessage, CopilotIntent, CopilotEvent, CopilotActionRecord } from './types';

export class SessionService {
  /**
   * 创建新会话
   */
  async create(userId: number | undefined, intent: CopilotIntent, event: CopilotEvent): Promise<CopilotSession> {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO copilot_sessions (id, user_id, intent, trigger_event, context_snapshot, started_at, updated_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId || null,
      intent,
      JSON.stringify(event),
      '{}', // context_snapshot 暂时为空，可以后续优化
      now,
      now,
      'active'
    );

    return {
      id,
      userId,
      intent,
      triggerEvent: JSON.stringify(event),
      contextSnapshot: '{}',
      startedAt: now,
      updatedAt: now,
      status: 'active',
    };
  }

  /**
   * 恢复会话（用于多轮对话）
   */
  async resume(sessionId: string): Promise<CopilotSession> {
    const row = db.prepare('SELECT * FROM copilot_sessions WHERE id = ?').get(sessionId) as any;
    
    if (!row) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return {
      id: row.id,
      userId: row.user_id,
      intent: row.intent,
      triggerEvent: row.trigger_event,
      contextSnapshot: row.context_snapshot,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      status: row.status,
    };
  }

  /**
   * 获取会话
   */
  async get(sessionId: string): Promise<CopilotSession> {
    return this.resume(sessionId);
  }

  /**
   * 添加消息到会话
   */
  async addMessage(sessionId: string, message: Omit<CopilotMessage, 'id' | 'createdAt'>): Promise<number> {
    const result = db.prepare(`
      INSERT INTO copilot_messages (session_id, role, content, message_type, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      sessionId,
      message.role,
      message.content,
      message.messageType || 'text',
      message.metadata ? JSON.stringify(message.metadata) : null
    );

    // 更新会话时间
    db.prepare('UPDATE copilot_sessions SET updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), sessionId);

    return Number(result.lastInsertRowid);
  }

  /**
   * 获取会话的所有消息
   */
  async getMessages(sessionId: string): Promise<CopilotMessage[]> {
    const rows = db.prepare(`
      SELECT * FROM copilot_messages 
      WHERE session_id = ? 
      ORDER BY created_at ASC
    `).all(sessionId) as any[];

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      messageType: row.message_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * 记录动作执行
   */
  async recordAction(
    sessionId: string,
    messageId: number,
    action: {
      actionId: string;
      params?: any;
      result?: any;
    }
  ): Promise<void> {
    db.prepare(`
      INSERT INTO copilot_actions (session_id, message_id, action_id, action_params, result)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      sessionId,
      messageId,
      action.actionId,
      action.params ? JSON.stringify(action.params) : null,
      action.result ? JSON.stringify(action.result) : null
    );
  }

  /**
   * 更新会话状态
   */
  async updateStatus(sessionId: string, status: 'active' | 'completed' | 'abandoned'): Promise<void> {
    db.prepare('UPDATE copilot_sessions SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), sessionId);
  }

  /**
   * 完成会话
   */
  async complete(sessionId: string): Promise<void> {
    await this.updateStatus(sessionId, 'completed');
  }
}
