/**
 * useCopilot Hook
 * 
 * React Hook 封装 Copilot 交互逻辑
 */

import { useState, useCallback } from 'react';
import { copilotClient } from '../lib/copilot/client';
import { CopilotEvent, CopilotResponse } from '../lib/copilot/types';

export function useCopilot() {
  const [currentResponse, setCurrentResponse] = useState<CopilotResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * 触发 Copilot 事件
   */
  const trigger = useCallback(async (event: CopilotEvent): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      const response = await copilotClient.process(event);
      setIsProcessing(false);

      if (response.shouldRespond && response.message) {
        setCurrentResponse({
          sessionId: response.sessionId!,
          message: response.message,
          context: response.context,
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Copilot trigger error:', error);
      setIsProcessing(false);
      return false;
    }
  }, []);

  /**
   * 执行动作
   */
  const executeAction = useCallback(async (actionId: string, params?: any): Promise<boolean> => {
    if (!currentResponse) return false;

    setIsProcessing(true);

    try {
      const result = await copilotClient.executeAction(
        currentResponse.sessionId,
        currentResponse.message.id,
        actionId,
        params
      );

      setIsProcessing(false);

      if (result.nextMessage) {
        // 有后续消息，继续显示
        setCurrentResponse({
          ...currentResponse,
          message: result.nextMessage,
        });
        return true;
      } else {
        // 没有后续消息，关闭
        setCurrentResponse(null);
        return result.success;
      }
    } catch (error) {
      console.error('Copilot execute action error:', error);
      setIsProcessing(false);
      return false;
    }
  }, [currentResponse]);

  /**
   * 关闭 Copilot 响应
   */
  const dismiss = useCallback(() => {
    setCurrentResponse(null);
  }, []);

  return {
    currentResponse,
    isProcessing,
    trigger,
    executeAction,
    dismiss,
  };
}
