/**
 * Copilot Client - 前端客户端
 * 
 * 封装 Copilot API 调用
 */

import { CopilotEvent, CopilotProcessResponse, CopilotExecuteResponse } from './types';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || '请求失败');
  }

  return res.json();
}

export class CopilotClient {
  /**
   * 处理事件，触发 Copilot 响应
   */
  async process(event: CopilotEvent, sessionId?: string): Promise<CopilotProcessResponse> {
    return request<CopilotProcessResponse>('/api/copilot/process', {
      method: 'POST',
      body: JSON.stringify({ event, sessionId }),
    });
  }

  /**
   * 执行用户选择的动作
   */
  async executeAction(
    sessionId: string,
    messageId: number,
    actionId: string,
    params: any = {}
  ): Promise<CopilotExecuteResponse> {
    return request<CopilotExecuteResponse>('/api/copilot/execute', {
      method: 'POST',
      body: JSON.stringify({ sessionId, messageId, actionId, params }),
    });
  }

  /**
   * 获取会话历史
   */
  async getSessionHistory(sessionId: string): Promise<any> {
    return request(`/api/copilot/sessions/${sessionId}`);
  }

  /**
   * 发送聊天消息（调用 LLM）
   */
  async chat(message: string, history: Array<{ role: string; content: string }> = []): Promise<{ content: string }> {
    return request<{ content: string }>('/api/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ 
        message, 
        history,
        stream: false,
      }),
    });
  }

  /**
   * 发送聊天消息（流式响应）
   */
  async *chatStream(
    message: string,
    history: Array<{ role: string; content: string }> = []
  ): AsyncGenerator<string, void, unknown> {
    const token = getToken();
    const response = await fetch(`${BASE_URL}/api/copilot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        history,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error('Stream request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // 保留最后一个不完整的行
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                yield parsed.content;
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// 导出单例
export const copilotClient = new CopilotClient();
