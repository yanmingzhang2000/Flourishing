/**
 * CopilotFloatingButton - 浮动按钮组件
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useCopilotContext } from '@/hooks/useCopilotContext';

export const CopilotFloatingButton: React.FC = () => {
  const { isOpen, toggle, unreadCount } = useCopilotContext();
  const [pulse, setPulse] = useState(false);

  // 有未读消息时脉动提示
  useEffect(() => {
    if (unreadCount > 0) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount]);

  // 侧边栏打开时隐藏按钮
  if (isOpen) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="fixed bottom-20 right-4 z-40"
    >
      <button
        onClick={toggle}
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
