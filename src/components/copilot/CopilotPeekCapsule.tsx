/**
 * CopilotPeekCapsule - Peek 胶囊组件
 * 
 * 当 Copilot 抽屉收起时，显示最新洞察消息的摘要
 * 点击展开完整抽屉
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCopilotContext } from '@/hooks/useCopilotContext';

export const CopilotPeekCapsule: React.FC = () => {
  const { isOpen, open, latestInsight, unreadCount } = useCopilotContext();
  const [pulse, setPulse] = useState(false);

  // 有未读消息时脉动提示
  useEffect(() => {
    if (unreadCount > 0) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount]);

  // 侧边栏打开时隐藏
  if (isOpen) return null;

  // 如果有最新洞察消息，显示 peek 胶囊
  if (latestInsight) {
    return (
      <AnimatePresence>
        <motion.button
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={open}
          className={`fixed bottom-24 right-6 z-40 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-full px-4 py-3 shadow-lg flex items-center gap-2 hover:scale-105 transition-transform ${
            pulse ? 'animate-pulse' : ''
          }`}
        >
          <span className="text-sm font-medium max-w-[200px] truncate">
            {latestInsight.summary}
          </span>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          
          {/* 未读计数徽章 */}
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </motion.button>
      </AnimatePresence>
    );
  }

  // 没有洞察消息时，显示默认浮动按钮
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="fixed bottom-20 right-4 z-40"
    >
      <button
        onClick={open}
        className={`relative w-14 h-14 rounded-full bg-gradient-to-br from-[#7DC47A] to-[#5BA558] shadow-lg flex items-center justify-center text-white text-2xl hover:scale-110 transition-transform ${
          pulse ? 'animate-pulse' : ''
        }`}
        aria-label="打开 AI 教练"
      >
        🤖
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>
    </motion.div>
  );
};
