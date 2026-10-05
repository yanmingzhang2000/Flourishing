/**
 * LLM Service - 大语言模型服务
 * 
 * 使用 SiliconFlow API (Qwen2.5-7B-Instruct)
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// 初始化 OpenAI 客户端（SiliconFlow 兼容 OpenAI API）
const client = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: process.env.SILICONFLOW_BASE_URL,
});

const MODEL = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen2.5-7B-Instruct';

// ────────────────────────────────────────────────────────────────────────────
// 系统提示词
// ────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `你是 Flourishing 应用的 AI 健身教练，专注于帮助用户完成训练目标。

**你的角色定位：**
- 友好、鼓励、专业的健身教练
- 了解用户的训练计划和进度
- 提供简短、实用的建议（每次回复控制在100字以内）

**你擅长的领域：**
- 训练动作指导（如何正确完成动作）
- 训练计划建议（难度调整、频率安排）
- 运动科学知识（肌肉、关节、恢复）
- 鼓励和动机激励

**回复风格：**
- 简洁明了，避免长篇大论
- 使用emoji增加亲和力（适度使用）
- 先鼓励，再建议
- 避免医学诊断，遇到伤病建议就医

**例子：**
用户："这个动作我做不标准怎么办？"
你："没关系！很多人刚开始都会遇到这个问题💪 可以先降低难度，关注动作质量而不是数量。需要我详细讲解这个动作的要点吗？"`;

// ────────────────────────────────────────────────────────────────────────────
// 类型定义
// ────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// LLM Service
// ────────────────────────────────────────────────────────────────────────────

export class LLMService {
  /**
   * 发送聊天请求（非流式）
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    const {
      messages,
      temperature = 0.7,
      maxTokens = 500,
    } = options;

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        temperature,
        max_tokens: maxTokens,
      });

      const choice = response.choices[0];
      
      return {
        content: choice.message.content || '',
        finishReason: choice.finish_reason,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      console.error('LLM chat error:', error);
      throw new Error('Failed to get LLM response');
    }
  }

  /**
   * 发送聊天请求（流式）
   */
  async chatStream(options: ChatOptions): Promise<AsyncIterable<string>> {
    const {
      messages,
      temperature = 0.7,
      maxTokens = 500,
    } = options;

    try {
      const stream = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      return this.streamToAsyncIterable(stream);
    } catch (error) {
      console.error('LLM stream error:', error);
      throw new Error('Failed to get LLM stream response');
    }
  }

  /**
   * 转换流式响应为 AsyncIterable
   */
  private async *streamToAsyncIterable(stream: any): AsyncIterable<string> {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.chat({
        messages: [{ role: 'user', content: 'hello' }],
        maxTokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// 导出单例
export const llmService = new LLMService();
