/**
 * CopilotSidebarDesktop - 桌面端推挤式侧边栏（非浮层）
 */

import React, { useEffect, useRef, useState } from 'react';
import { useCopilotContext } from '@/hooks/useCopilotContext';
import { CopilotMessageBubble } from './CopilotMessageBubble';
import { CopilotQuickActions } from './CopilotQuickActions';

export const CopilotSidebarDesktop: React.FC = () => {
  const { isOpen, close, messages, markAllAsRead, sendMessage, isLoading } = useCopilotContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  // 自动滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      markAllAsRead();
    }
  }, [messages, markAllAsRead]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    const message = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      await sendMessage(message);
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="h-full bg-white rounded-2xl shadow-lg flex flex-col overflow-hidden sticky top-6">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7DC47A] to-[#5BA558] flex items-center justify-center text-white text-xl">
            🐼
          </div>
          <div>
            <h2 className="font-bold text-gray-800">AI 教练</h2>
            <p className="text-xs text-gray-500">随时为你服务</p>
          </div>
        </div>
        <button
          onClick={close}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="收起"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <div className="text-5xl mb-3">💬</div>
            <p className="text-sm">开始对话，我会帮你规划训练</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <CopilotMessageBubble
                key={msg.id}
                message={msg}
                sessionId={undefined}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7DC47A] to-[#5BA558] flex items-center justify-center text-white flex-shrink-0">
              🐼
            </div>
            <div className="flex-1 bg-gray-100 rounded-2xl p-3 animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            </div>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="border-t border-gray-100 p-4 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="问我任何关于训练的问题..."
            rows={2}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:border-[#7DC47A] focus:ring-1 focus:ring-[#7DC47A]"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            className="self-end px-4 py-2 bg-[#7DC47A] text-white rounded-xl hover:bg-[#5BA558] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">按 Ctrl/Cmd + Enter 快速发送</p>
      </div>

      {/* 快捷操作 */}
      <CopilotQuickActions />
    </div>
  );
};
