/**
 * CopilotChatInput - 聊天输入组件
 */

import React, { useState, useRef, useEffect } from 'react';
import { useCopilotContext } from '@/hooks/useCopilotContext';

interface CopilotChatInputProps {
  onClose: () => void;
}

export const CopilotChatInput: React.FC<CopilotChatInputProps> = ({ onClose }) => {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useCopilotContext();

  useEffect(() => {
    // 自动聚焦
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await sendMessage(input.trim());
      setInput('');
      onClose();
    } catch (error) {
      console.error('Send message error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter 发送
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7DC47A] to-[#5BA558] flex items-center justify-center text-white text-xl">
              🤖
            </div>
            <div>
              <h3 className="font-bold text-gray-800">问个问题</h3>
              <p className="text-xs text-gray-500">AI 教练会尽力回答</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 输入区域 */}
        <form onSubmit={handleSubmit} className="p-4">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="例如：这个动作我做不标准怎么办？"
            className="w-full h-32 p-3 border-2 border-gray-200 rounded-lg resize-none focus:border-[#7DC47A] focus:outline-none"
            disabled={isSubmitting}
          />
          
          {/* 提示和按钮 */}
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-400">
              Ctrl+Enter 快速发送
            </span>
            <button
              type="submit"
              disabled={!input.trim() || isSubmitting}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                input.trim() && !isSubmitting
                  ? 'bg-[#7DC47A] text-white hover:bg-[#6DB569]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? '发送中...' : '发送'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
