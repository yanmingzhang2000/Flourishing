/**
 * Copilot 前端类型定义
 */

// ────────────────────────────────────────────────────────────────────────────
// 事件类型
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotEvent {
  type: 'training_feedback_submitted' | 'training_completed' | 'plan_generated' | 'user_text_input' | 'user_inactive';
  data: Record<string, any>;
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
// API 响应类型
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotProcessResponse {
  shouldRespond: boolean;
  sessionId?: string;
  message?: CopilotResponse['message'];
  context?: Record<string, any>;
}

export interface CopilotExecuteResponse {
  success: boolean;
  message?: string;
  nextMessage?: CopilotResponse['message'];
}
