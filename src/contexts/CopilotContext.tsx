/**
 * Copilot Context - 全局状态管理
 */

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { copilotClient } from '@/lib/copilot/client';
import { CopilotEvent, CopilotAction } from '@/lib/copilot/types';
import { isLoggedIn } from '@/lib/api';

// ────────────────────────────────────────────────────────────────────────────
// 类型定义
// ────────────────────────────────────────────────────────────────────────────

export interface CopilotMessage {
  id: number;
  role: 'assistant' | 'user' | 'system';
  content: string;
  timestamp: string;
  actions?: CopilotAction[];
  read: boolean;
  clickedActionId?: string; // 标记哪个动作被点击
  isTest?: boolean; // 标记是否为测试消息
}

interface CopilotContextValue {
  // 状态
  isOpen: boolean;
  messages: CopilotMessage[];
  unreadCount: number;
  isLoading: boolean;

  // 操作
  open: () => void;
  close: () => void;
  toggle: () => void;
  
  // 消息
  sendMessage: (content: string) => Promise<void>;
  triggerEvent: (event: CopilotEvent) => Promise<void>;
  markAllAsRead: () => void;
  
  // 反馈快捷方式
  submitFeedback: (feedback: 'too_easy' | 'just_right' | 'too_hard', eventData?: any) => Promise<void>;
  
  // 动作执行
  executeAction: (actionId: string, sessionId: string, messageId: number) => Promise<void>;
  
  // 历史管理
  clearAllMessages: () => void;
  clearTestMessages: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Context 创建
// ────────────────────────────────────────────────────────────────────────────

export const CopilotContext = createContext<CopilotContextValue | null>(null);

// ────────────────────────────────────────────────────────────────────────────
// Provider 组件
// ────────────────────────────────────────────────────────────────────────────

export const CopilotProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // 从 localStorage 加载历史消息
  useEffect(() => {
    const loadHistory = () => {
      try {
        const history = localStorage.getItem('copilot_messages');
        if (history) {
          const parsed = JSON.parse(history);
          setMessages(parsed);
        }
      } catch (error) {
        console.error('Failed to load copilot history:', error);
      }
    };
    loadHistory();
  }, []);

  // 保存消息到 localStorage（限制最多20条）
  useEffect(() => {
    try {
      const MAX_MESSAGES = 20;
      const recentMessages = messages.slice(-MAX_MESSAGES);
      localStorage.setItem('copilot_messages', JSON.stringify(recentMessages));
      const unread = recentMessages.filter(m => !m.read && m.role === 'assistant').length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to save copilot messages:', error);
    }
  }, [messages]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  const addMessage = useCallback((message: Omit<CopilotMessage, 'timestamp'>) => {
    const newMessage: CopilotMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const triggerEvent = useCallback(async (event: CopilotEvent) => {
    const isTestEvent = event.data?.isTest === true;
    
    if (!isLoggedIn()) {
      // 游客模式：添加本地消息（带动作按钮）
      addMessage({
        id: Date.now(),
        role: 'assistant',
        content: '🎉 太棒了！你完成了今天的训练！\n\n今天的训练感觉怎么样？',
        read: false,
        isTest: isTestEvent,
        actions: [
          { id: 'feedback_too_easy', label: '😊 太轻松', handler: 'submit_feedback_too_easy', style: 'secondary' },
          { id: 'feedback_just_right', label: '💪 刚刚好', handler: 'submit_feedback_just_right', style: 'primary' },
          { id: 'feedback_too_hard', label: '😫 太难了', handler: 'submit_feedback_too_hard', style: 'secondary' },
        ],
      });
      setIsOpen(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await copilotClient.process(event, currentSessionId || undefined);
      
      if (response.shouldRespond && response.message) {
        setCurrentSessionId(response.sessionId!);
        
        addMessage({
          id: response.message.id,
          role: 'assistant',
          content: response.message.content,
          actions: response.message.actions,
          read: false,
          isTest: isTestEvent,
        });
        
        setIsOpen(true); // 自动打开侧边栏
      }
    } catch (error) {
      console.error('Copilot trigger error:', error);
      // 失败时显示本地消息（带动作按钮）
      addMessage({
        id: Date.now(),
        role: 'assistant',
        content: '🎉 太棒了！你完成了今天的训练！\n\n今天的训练感觉怎么样？',
        read: false,
        isTest: isTestEvent,
        actions: [
          { id: 'feedback_too_easy', label: '😊 太轻松', handler: 'submit_feedback_too_easy', style: 'secondary' },
          { id: 'feedback_just_right', label: '💪 刚刚好', handler: 'submit_feedback_just_right', style: 'primary' },
          { id: 'feedback_too_hard', label: '😫 太难了', handler: 'submit_feedback_too_hard', style: 'secondary' },
        ],
      });
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, addMessage]);

  const submitFeedback = useCallback(async (
    feedback: 'too_easy' | 'just_right' | 'too_hard',
    eventData?: any
  ) => {
    // 添加用户消息
    const feedbackText = 
      feedback === 'too_easy' ? '😊 太轻松' : 
      feedback === 'just_right' ? '💪 刚刚好' : 
      '😫 太难了';
    
    addMessage({
      id: Date.now(),
      role: 'user',
      content: feedbackText,
      read: true,
    });

    // 触发 Copilot 事件
    await triggerEvent({
      type: 'training_feedback_submitted',
      data: {
        feedback,
        ...eventData,
      },
    });
  }, [addMessage, triggerEvent]);

  const executeAction = useCallback(async (
    actionId: string,
    sessionId: string,
    messageId: number
  ) => {
    // 标记消息的按钮已点击
    setMessages(prev => 
      prev.map(m => 
        m.id === messageId 
          ? { ...m, clickedActionId: actionId }
          : m
      )
    );

    // 游客模式：本地处理反馈动作
    if (!isLoggedIn() || sessionId === 'guest') {
      const feedbackMap: Record<string, string> = {
        'submit_feedback_too_easy': '太轻松',
        'submit_feedback_just_right': '刚刚好',
        'submit_feedback_too_hard': '太难了',
      };

      if (actionId in feedbackMap) {
        // 添加用户消息
        addMessage({
          id: Date.now(),
          role: 'user',
          content: feedbackMap[actionId],
          read: true,
        });

        // 添加 AI 响应
        setTimeout(() => {
          let responseText = '';
          if (actionId === 'submit_feedback_just_right') {
            responseText = '太好了！继续保持这个节奏💪';
          } else if (actionId === 'submit_feedback_too_hard') {
            responseText = '我会持续关注你的训练情况。如果接下来几次也觉得吃力，我可以为你调整难度。';
          } else {
            responseText = '收到！如果接下来几次也觉得轻松，我可以为你增加挑战。';
          }

          addMessage({
            id: Date.now(),
            role: 'assistant',
            content: responseText,
            read: false,
          });
        }, 300);
      }
      return;
    }

    setIsLoading(true);
    try {
      const result = await copilotClient.executeAction(sessionId, messageId, actionId);
      
      if (result.success && result.message) {
        addMessage({
          id: Date.now(),
          role: 'assistant',
          content: result.message,
          read: false,
        });
      }
      
      if (result.nextMessage) {
        addMessage({
          id: result.nextMessage.id,
          role: 'assistant',
          content: result.nextMessage.content,
          actions: result.nextMessage.actions,
          read: false,
        });
      }
    } catch (error) {
      console.error('Execute action error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [addMessage]);

  const sendMessage = useCallback(async (content: string) => {
    // 添加用户消息
    addMessage({
      id: Date.now(),
      role: 'user',
      content,
      read: true,
    });

    // 如果未登录，显示提示
    if (!isLoggedIn()) {
      setTimeout(() => {
        addMessage({
          id: Date.now(),
          role: 'assistant',
          content: '抱歉，问答功能需要登录后使用。请先登录以获得完整的 AI 对话体验！',
          read: false,
        });
      }, 300);
      return;
    }

    setIsLoading(true);

    try {
      // 准备对话历史（最近5条）
      const recentMessages = messages
        .slice(-5)
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      // 创建一个占位消息用于流式更新
      const assistantMessageId = Date.now();
      addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        read: false,
      });

      // 使用流式 API
      let fullContent = '';
      for await (const chunk of copilotClient.chatStream(content, recentMessages)) {
        fullContent += chunk;
        // 更新消息内容
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: fullContent }
              : m
          )
        );
      }
    } catch (error) {
      console.error('Send message error:', error);
      // 添加错误提示
      addMessage({
        id: Date.now(),
        role: 'assistant',
        content: '抱歉，我现在无法回答你的问题，请稍后再试。',
        read: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, messages]);

  const markAllAsRead = useCallback(() => {
    setMessages(prev => 
      prev.map(m => ({ ...m, read: true }))
    );
  }, []);

  const clearAllMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem('copilot_messages');
  }, []);

  const clearTestMessages = useCallback(() => {
    setMessages(prev => prev.filter(m => !m.isTest));
  }, []);

  const value: CopilotContextValue = {
    isOpen,
    messages,
    unreadCount,
    isLoading,
    open,
    close,
    toggle,
    sendMessage,
    triggerEvent,
    markAllAsRead,
    submitFeedback,
    executeAction,
    clearAllMessages,
    clearTestMessages,
  };

  return (
    <CopilotContext.Provider value={value}>
      {children}
    </CopilotContext.Provider>
  );
};
