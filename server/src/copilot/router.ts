/**
 * Copilot API 路由
 */

import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { copilotEngine } from './engine';

const router = Router();

// 所有 Copilot 接口都需要认证（游客也可以，但需要 token）
router.use(authMiddleware);

/**
 * POST /api/copilot/process
 * 
 * 触发 Copilot 处理事件
 */
router.post('/process', async (req: AuthRequest, res: Response) => {
  try {
    const { event, sessionId } = req.body;

    if (!event || !event.type) {
      return res.status(400).json({ error: '缺少事件信息' });
    }

    const result = await copilotEngine.process(event, req.userId, sessionId);

    if (!result.shouldRespond) {
      return res.json({ shouldRespond: false });
    }

    return res.json({
      shouldRespond: true,
      sessionId: result.sessionId,
      message: result.message,
      context: result.context,
    });
  } catch (error) {
    console.error('Copilot process error:', error);
    return res.status(500).json({ error: 'Copilot 处理失败' });
  }
});

/**
 * POST /api/copilot/execute
 * 
 * 执行用户选择的动作
 */
router.post('/execute', async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, messageId, actionId, params } = req.body;

    if (!sessionId || !messageId || !actionId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await copilotEngine.executeAction(
      sessionId,
      messageId,
      actionId,
      params || {}
    );

    return res.json(result);
  } catch (error) {
    console.error('Copilot execute error:', error);
    return res.status(500).json({ 
      success: false,
      message: '动作执行失败，请稍后重试'
    });
  }
});

/**
 * GET /api/copilot/sessions/:sessionId
 * 
 * 获取会话历史
 */
router.get('/sessions/:sessionId', async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId);
    const history = await copilotEngine.getSessionHistory(sessionId);
    return res.json(history);
  } catch (error) {
    console.error('Copilot session error:', error);
    return res.status(404).json({ error: '会话不存在' });
  }
});

export default router;
