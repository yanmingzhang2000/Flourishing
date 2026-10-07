/**
 * CopilotMobileCapsule - 移动端顶部胶囊组件
 * 
 * 在移动端日历页顶部显示最新洞察消息摘要
 * 点击展开覆盖式抽屉
 */

import React from 'react';
import { useCopilotContext } from '@/hooks/useCopilotContext';

export const CopilotMobileCapsule: React.FC = () => {
  const { open, latestInsight } = useCopilotContext();

  // 如果没有洞察消息，不显示
  if (!latestInsight) return null;

  return (
    <div className="lg:hidden mb-4">
      <button
        onClick={open}
        className="w-full bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-3 flex items-center justify-between border border-green-200 hover:border-green-300 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1">
          <span className="text-lg flex-shrink-0">📊</span>
          <span className="text-sm text-gray-800 truncate">{latestInsight.summary}</span>
        </div>
        <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};
