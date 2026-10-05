/**
 * Feedback Handler - 反馈响应处理器
 * 
 * 处理训练反馈响应
 */

import { CopilotContext, CopilotResponse } from '../types';
import { TemplateService } from '../templateService';
import { SessionService } from '../sessionService';

export class FeedbackHandler {
  constructor(
    private templateService: TemplateService,
    private sessionService: SessionService
  ) {}

  /**
   * 构建响应
   */
  async build(context: CopilotContext): Promise<CopilotResponse> {
    // 加载反馈响应模板
    const templates = await this.templateService.loadTemplates('feedback_response');

    // 匹配最佳模板
    const template = this.templateService.match(templates, context);

    if (!template) {
      // 默认响应（理论上不应该发生，因为有兜底模板）
      const defaultMessageId = await this.sessionService.addMessage(context.sessionId, {
        sessionId: context.sessionId,
        role: 'assistant',
        content: '感谢你的反馈！',
        messageType: 'text',
        metadata: { tone: 'informative', actions: [] },
      });

      return {
        sessionId: context.sessionId,
        message: {
          id: defaultMessageId,
          role: 'assistant',
          content: '感谢你的反馈！',
          tone: 'informative',
          actions: [],
        },
        context: {},
      };
    }

    // 变量插值
    const content = this.templateService.interpolate(template.messageTemplate, context);

    // 保存消息到数据库
    const messageId = await this.sessionService.addMessage(context.sessionId, {
      sessionId: context.sessionId,
      role: 'assistant',
      content,
      messageType: 'action_prompt',
      metadata: {
        tone: template.tone,
        actions: template.actions,
        templateId: template.id,
      },
    });

    // 构建响应
    return {
      sessionId: context.sessionId,
      message: {
        id: messageId,
        role: 'assistant',
        content,
        tone: template.tone,
        actions: template.actions,
      },
      context: {
        recentFeedback: context.trainingHistory.recentFeedback,
        currentDifficulty: context.trainingHistory.currentDifficulty,
        recentTooHardCount: context.trainingHistory.recentTooHardCount,
        recentTooEasyCount: context.trainingHistory.recentTooEasyCount,
      },
    };
  }
}
