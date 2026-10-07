/**
 * CopilotHeroCard - Hero 展示态：品牌渐变大字 + 训练进度
 */

import React from 'react';

interface Props {
  weekProgress: { completed: number; target: number };
  heroMessage: string;
  onExpand: () => void;
  onCollapse: () => void;
}

export const CopilotHeroCard: React.FC<Props> = ({
  weekProgress,
  heroMessage,
  onExpand,
  onCollapse,
}) => {
  const remaining = weekProgress.target - weekProgress.completed;
  const isCompleted = remaining <= 0;

  return (
    <div
      onClick={onExpand}
      className="h-full bg-white rounded-2xl shadow-lg flex flex-col justify-center items-center p-8 cursor-pointer hover:shadow-xl transition-shadow relative sticky top-6"
    >
      {/* 右上角"收起 ›"按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation(); // 防止触发整卡 onExpand
          onCollapse();
        }}
        className="absolute top-4 right-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="收起教练寄语"
      >
        收起 ›
      </button>

      {/* 小字进度 */}
      <p className="text-sm text-gray-500 mb-4">
        本周已练 {weekProgress.completed} 次
      </p>

      {/* 大字渐变寄语 */}
      <h2
        className="text-4xl font-bold mb-6 text-center leading-tight px-4"
        style={{
          background: 'linear-gradient(135deg, #7DC47A 0%, #F59E0B 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 2px 8px rgba(125, 196, 122, 0.3))',
        }}
      >
        {heroMessage}
      </h2>

      {/* 进度 chip */}
      <div
        className={`px-4 py-2 rounded-full text-sm font-medium ${
          isCompleted
            ? 'bg-green-50 text-green-700'
            : 'bg-orange-50 text-orange-700'
        }`}
      >
        {isCompleted ? '本周达标 🎉' : `还差 ${remaining} 次达标`}
      </div>

      {/* 底部提示 */}
      <p className="text-xs text-gray-400 mt-8 flex items-center gap-1">
        展开对话
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7l10 10M17 7v10H7" />
        </svg>
      </p>
    </div>
  );
};
