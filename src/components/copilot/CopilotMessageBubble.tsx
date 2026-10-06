/**
 * CopilotMessageBubble - 消息气泡组件
 */

import React from 'react';
import { CopilotMessage } from '@/contexts/CopilotContext';
import { useCopilotContext } from '@/hooks/useCopilotContext';

interface CopilotMessageBubbleProps {
  message: CopilotMessage;
  sessionId?: string;
}

export const CopilotMessageBubble: React.FC<CopilotMessageBubbleProps> = ({ message, sessionId }) => {
  const { executeAction, isLoading } = useCopilotContext();
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isStreaming = isAssistant && message.content === '' && isLoading;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`flex gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* 头像（仅 AI 消息） */}
        {isAssistant && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7DC47A] to-[#5BA558] flex items-center justify-center text-white flex-shrink-0">
            🤖
          </div>
        )}

        {/* 消息内容 */}
        <div className="flex flex-col">
          <div
            className={`px-4 py-2.5 rounded-2xl ${
              isUser
                ? 'bg-[#7DC47A] text-white'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {isStreaming ? (
              // 正在流式加载，显示打字动画
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : (
              <p className="text-sm whitespace-pre-line leading-relaxed">
                {message.content}
                {/* 流式响应时显示光标 */}
                {isAssistant && isLoading && message.content && (
                  <span className="inline-block w-0.5 h-4 bg-gray-600 ml-0.5 animate-pulse" />
                )}
              </p>
            )}
          </div>

          {/* 动作按钮（仅 AI 消息） */}
          {isAssistant && message.actions && message.actions.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {message.actions.map((action) => {
                const isClicked = message.clickedActionId === action.id;
                const shouldHide = message.clickedActionId && !isClicked;
                
                if (shouldHide) return null;
                
                return (
                  <button
                    key={action.id}
                    onClick={() => !message.clickedActionId && executeAction(action.handler, sessionId || 'guest', message.id)}
                    disabled={message.clickedActionId !== undefined}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isClicked
                        ? 'bg-[#7DC47A] text-white ring-2 ring-[#7DC47A] ring-offset-2'
                        : action.style === 'primary'
                        ? 'bg-[#7DC47A] text-white hover:bg-[#6DB569]'
                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300'
                    } ${message.clickedActionId ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 时间戳 */}
          {!isStreaming && (
            <span className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
