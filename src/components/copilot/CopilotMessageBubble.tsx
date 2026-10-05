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
  const { executeAction } = useCopilotContext();
  const isAssistant = message.role === 'assistant';

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-3`}>
      <div className={`flex gap-2 max-w-[85%] ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* 头像 */}
        {isAssistant && (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7DC47A] to-[#5BA558] flex items-center justify-center text-white flex-shrink-0">
            🤖
          </div>
        )}

        {/* 消息内容 */}
        <div className="flex flex-col">
          <div
            className={`px-4 py-2.5 rounded-2xl ${
              isAssistant
                ? 'bg-gray-100 text-gray-800'
                : 'bg-[#7DC47A] text-white'
            }`}
          >
            <p className="text-sm whitespace-pre-line leading-relaxed">{message.content}</p>
          </div>

          {/* 动作按钮 */}
          {message.actions && message.actions.length > 0 && sessionId && (
            <div className="flex flex-col gap-2 mt-2">
              {message.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => executeAction(action.handler, sessionId, message.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    action.style === 'primary'
                      ? 'bg-[#7DC47A] text-white hover:bg-[#6DB569]'
                      : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* 时间戳 */}
          <span className={`text-xs text-gray-400 mt-1 ${isAssistant ? 'text-left' : 'text-right'}`}>
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
};
