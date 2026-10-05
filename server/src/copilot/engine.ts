/**
 * Copilot Engine - 核心引擎
 * 
 * 统一的对话管理和响应生成
 */

import { IntentRouter } from './intentRouter';
import { ContextManager } from './contextManager';
import { SessionService } from './sessionService';
import { TemplateService } from './templateService';
import { ActionsExecutor } from './actionsExecutor';
import { FeedbackHandler } from './handlers/feedbackHandler';
import { TrainingCompletedHandler } from './handlers/trainingCompletedHandler';
import {
  CopilotEvent,
  CopilotProcessResult,
  ActionExecutionResult,
  CopilotIntent,
  CopilotContext,
  CopilotResponse,
} from './types';

export class CopilotEngine {
  private intentRouter: IntentRouter;
  private contextManager: ContextManager;
  private sessionService: SessionService;
  private templateService: TemplateService;
  private actionsExecutor: ActionsExecutor;
  private handlers: Map<CopilotIntent, any>;

  constructor() {
    this.intentRouter = new IntentRouter();
    this.contextManager = new ContextManager();
    this.sessionService = new SessionService();
    this.templateService = new TemplateService();
    this.actionsExecutor = new ActionsExecutor();
    this.handlers = new Map();

    // 注册处理器
    this.registerHandlers();
  }

  /**
   * 注册意图处理器
   */
  private registerHandlers() {
    // 训练完成处理器
    this.handlers.set(
      'training_completed',
      new TrainingCompletedHandler(this.templateService, this.sessionService)
    );

    // 反馈响应处理器
    this.handlers.set(
      'feedback_response',
      new FeedbackHandler(this.templateService, this.sessionService)
    );

    // 未来可以添加更多处理器
    // this.handlers.set('plan_adjustment', new PlanAdjustmentHandler(...));
    // this.handlers.set('knowledge_query', new KnowledgeQueryHandler(...));
  }

  /**
   * 处理事件，返回 Copilot 响应
   */
  async process(
    event: CopilotEvent,
    userId?: number,
    sessionId?: string
  ): Promise<CopilotProcessResult> {
    // 1. 路由到对应的意图
    const intent = this.intentRouter.route(event);
    if (!intent) {
      return { shouldRespond: false };
    }

    // 2. 创建或恢复会话
    const session = sessionId
      ? await this.sessionService.resume(sessionId)
      : await this.sessionService.create(userId, intent, event);

    // 3. 加载上下文
    const context = await this.contextManager.load(userId, session, event);

    // 4. 获取对应的处理器
    const handler = this.handlers.get(intent);
    if (!handler) {
      console.error(`No handler registered for intent: ${intent}`);
      return { shouldRespond: false };
    }

    // 5. 生成响应
    const response = await handler.build(context);

    return {
      shouldRespond: true,
      sessionId: session.id,
      message: response.message,
      context: this.contextManager.getPublicContext(context),
    };
  }

  /**
   * 执行用户选择的动作
   */
  async executeAction(
    sessionId: string,
    messageId: number,
    actionId: string,
    params: any = {}
  ): Promise<ActionExecutionResult> {
    // 1. 获取会话
    const session = await this.sessionService.get(sessionId);

    // 2. 加载上下文（重新加载以获取最新状态）
    const context = await this.contextManager.load(
      session.userId,
      session,
      JSON.parse(session.triggerEvent)
    );

    // 3. 执行动作
    const result = await this.actionsExecutor.execute(actionId, params, context);

    // 4. 记录动作执行
    await this.sessionService.recordAction(session.id, messageId, {
      actionId,
      params,
      result,
    });

    // 5. 保存用户选择消息
    await this.sessionService.addMessage(session.id, {
      sessionId: session.id,
      role: 'user',
      content: `[执行动作: ${actionId}]`,
      messageType: 'action',
      metadata: { actionId, result },
    });

    // 6. 如果动作成功且无后续响应，标记会话完成
    if (result.success && !result.nextMessage) {
      await this.sessionService.complete(session.id);
    }

    return result;
  }

  /**
   * 获取会话历史
   */
  async getSessionHistory(sessionId: string) {
    const session = await this.sessionService.get(sessionId);
    const messages = await this.sessionService.getMessages(sessionId);

    return {
      sessionId: session.id,
      intent: session.intent,
      messages,
      status: session.status,
    };
  }
}

// 导出单例
export const copilotEngine = new CopilotEngine();
