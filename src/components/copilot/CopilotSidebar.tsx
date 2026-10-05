/**
 * CopilotSidebar - 侧边栏主组件
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCopilotContext } from '@/hooks/useCopilotContext';
import { CopilotMessageBubble } from './CopilotMessageBubble';
import { CopilotQuickActions } from './CopilotQuickActions';

export const CopilotSidebar: React.FC = () => {
  const { isOpen, close, messages, markAllAsRead } = useCopilotContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentSessionId] = React.useState<string | null>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // 打开侧边栏时标记所有消息为已读
      markAllAsRead();
    }
  }, [isOpen, messages, markAllAsRead]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩（移动端） */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
          
          {/* 侧边栏 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full md:w-[400px] bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7DC47A] to-[#5BA558] flex items-center justify-center text-white text-xl">
                  🤖
                </div>
                <div>
                  <h2 className="font-bold text-gray-800">AI 教练</h2>
                  <p className="text-xs text-gray-500">随时为你服务</p>
                </div>
              </div>
              <button
                onClick={close}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
                aria-label="关闭"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 消息历史 */}
            <div className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <div className="text-5xl mb-4">💬</div>
                  <p className="text-sm text-center">还没有对话记录</p>
                  <p className="text-xs text-center mt-1">完成训练后我会主动和你交流</p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <CopilotMessageBubble 
                      key={message.id} 
                      message={message}
                      sessionId={currentSessionId || undefined}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            
            {/* 快捷操作 */}
            <CopilotQuickActions />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
