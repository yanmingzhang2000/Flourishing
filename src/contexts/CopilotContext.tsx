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

  // 保存消息到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem('copilot_messages', JSON.stringify(messages));
      const unread = messages.filter(m => !m.read && m.role === 'assistant').length;
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
    if (!isLoggedIn()) {
      // 游客模式：添加本地消息
      addMessage({
        id: Date.now(),
        role: 'assistant',
        content: '完成训练！继续保持💪',
        read: false,
        actions: [],
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
        });
        
        setIsOpen(true); // 自动打开侧边栏
      }
    } catch (error) {
      console.error('Copilot trigger error:', error);
      // 失败时显示本地消息
      addMessage({
        id: Date.now(),
        role: 'assistant',
        content: '完成训练！继续保持💪',
        read: false,
        actions: [],
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
    if (!isLoggedIn()) return;

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
    // 预留：用于未来的文本输入功能
    addMessage({
      id: Date.now(),
      role: 'user',
      content,
      read: true,
    });

    // TODO: 调用 LLM API
  }, [addMessage]);

  const markAllAsRead = useCallback(() => {
    setMessages(prev => 
      prev.map(m => ({ ...m, read: true }))
    );
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
  };

  return (
    <CopilotContext.Provider value={value}>
      {children}
    </CopilotContext.Provider>
  );
};
