/**
 * Copilot 系统类型定义
 */

// ────────────────────────────────────────────────────────────────────────────
// 意图类型
// ────────────────────────────────────────────────────────────────────────────

export type CopilotIntent = 
  | 'feedback_response'      // 训练反馈响应
  | 'training_completed'     // 训练完成庆祝
  | 'plan_adjustment'        // 计划调整
  | 'knowledge_query'        // 知识问答（预留）
  | 'progress_insight'       // 进度洞察（预留）
  | 'encouragement';         // 鼓励与提醒（预留）

// ────────────────────────────────────────────────────────────────────────────
// 事件类型
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotEvent {
  type: 'training_feedback_submitted' | 'training_completed' | 'plan_generated' | 'user_text_input' | 'user_inactive';
  data: Record<string, any>;
}

// ────────────────────────────────────────────────────────────────────────────
// 上下文类型
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotSettings {
  difficulty_preference?: 'auto' | 'keep_low' | 'keep_standard' | 'keep_high';
  notification_frequency?: 'minimal' | 'normal' | 'frequent';
  tone_preference?: 'friendly' | 'professional' | 'motivational';
  disabled_intents?: CopilotIntent[];
  last_interaction_at?: string;
}

export interface CopilotContext {
  userId?: number;
  sessionId: string;
  
  // 用户档案
  userProfile: {
    experience?: string;
    injuries?: string[];
    equipment?: string[];
    copilotSettings: CopilotSettings;
  };
  
  // 训练历史
  trainingHistory: {
    recentFeedback: Array<{ date: string; feedback: string }>;
    recentTooHardCount: number;
    recentTooEasyCount: number;
    currentDifficulty: 1 | 2 | 3;
  };
  
  // 触发事件
  triggerEvent: CopilotEvent;
  
  // 当前反馈（用于模板条件）
  feedback?: 'too_easy' | 'just_right' | 'too_hard';
}

// ────────────────────────────────────────────────────────────────────────────
// 会话类型
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotSession {
  id: string;
  userId?: number;
  intent: CopilotIntent;
  triggerEvent: string;
  contextSnapshot: string;
  startedAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'abandoned';
}

// ────────────────────────────────────────────────────────────────────────────
// 消息类型
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotMessage {
  id?: number;
  sessionId: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  messageType?: 'text' | 'action_prompt' | 'insight' | 'action';
  metadata?: {
    actions?: CopilotAction[];
    tone?: string;
    [key: string]: any;
  };
  createdAt?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 动作类型
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotAction {
  id: string;
  label: string;
  handler: string;
  style?: 'primary' | 'secondary' | 'danger';
  params?: Record<string, any>;
}

export interface CopilotActionRecord {
  id?: number;
  sessionId: string;
  messageId: number;
  actionId: string;
  actionParams?: string;
  result?: string;
  executedAt?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 响应类型
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotResponse {
  sessionId: string;
  message: {
    id: number;
    role: 'assistant';
    content: string;
    tone: string;
    actions: CopilotAction[];
  };
  context?: {
    recentFeedback?: Array<{ date: string; feedback: string }>;
    currentDifficulty?: number;
    [key: string]: any;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 模板类型
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotTemplate {
  id: string;
  intent: CopilotIntent;
  conditionExpr: string;
  priority: number;
  messageTemplate: string;
  tone: string;
  actions: CopilotAction[];
  enabled: boolean;
  version: number;
}

export interface CopilotTemplateRow {
  id: string;
  intent: string;
  condition_expr: string;
  priority: number;
  message_template: string;
  tone: string;
  actions: string;
  enabled: number;
  version: number;
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// 处理结果类型
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotProcessResult {
  shouldRespond: boolean;
  sessionId?: string;
  message?: CopilotResponse['message'];
  context?: Record<string, any>;
}

export interface ActionExecutionResult {
  success: boolean;
  message?: string;
  nextMessage?: CopilotResponse['message'];
}
