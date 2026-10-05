/**
 * TrainingCompleted Handler - 训练完成处理器
 * 
 * 处理训练完成庆祝响应
 */

import { CopilotContext, CopilotResponse } from '../types';
import { TemplateService } from '../templateService';
import { SessionService } from '../sessionService';

export class TrainingCompletedHandler {
  constructor(
    private templateService: TemplateService,
    private sessionService: SessionService
  ) {}

  /**
   * 构建响应
   */
  async build(context: CopilotContext): Promise<CopilotResponse> {
    // 加载训练完成模板
    const templates = await this.templateService.loadTemplates('training_completed');

    // 匹配最佳模板
    const template = this.templateService.match(templates, context);

    if (!template) {
      // 默认响应
      const defaultMessageId = await this.sessionService.addMessage(context.sessionId, {
        sessionId: context.sessionId,
        role: 'assistant',
        content: '太棒了！你完成了今天的训练 🎉',
        messageType: 'text',
        metadata: { tone: 'celebratory', actions: [] },
      });

      return {
        sessionId: context.sessionId,
        message: {
          id: defaultMessageId,
          role: 'assistant',
          content: '太棒了！你完成了今天的训练 🎉',
          tone: 'celebratory',
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
        recentFeedback: context.trainingHistory?.recentFeedback || [],
        currentDifficulty: context.trainingHistory?.currentDifficulty || 2,
      },
    };
  }
}
