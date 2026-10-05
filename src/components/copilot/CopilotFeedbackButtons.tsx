/**
 * CopilotFeedbackButtons - 反馈按钮组件
 */

import React, { useState } from 'react';
import { useCopilotContext } from '@/hooks/useCopilotContext';

interface CopilotFeedbackButtonsProps {
  eventData?: any;
}

export const CopilotFeedbackButtons: React.FC<CopilotFeedbackButtonsProps> = ({ eventData }) => {
  const { submitFeedback, isLoading } = useCopilotContext();
  const [submitted, setSubmitted] = useState(false);

  const feedbackOptions = [
    { key: 'too_easy' as const, emoji: '😊', label: '太轻松' },
    { key: 'just_right' as const, emoji: '💪', label: '刚刚好' },
    { key: 'too_hard' as const, emoji: '😫', label: '太难了' },
  ];

  const handleFeedback = async (feedback: 'too_easy' | 'just_right' | 'too_hard') => {
    setSubmitted(true);
    await submitFeedback(feedback, eventData);
  };

  if (submitted) {
    return (
      <div className="text-center text-sm text-gray-500 py-2">
        反馈已提交，感谢你的分享！
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-600 mb-3">今天的训练感觉怎么样？</div>
      <div className="grid grid-cols-3 gap-2">
        {feedbackOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => handleFeedback(option.key)}
            disabled={isLoading}
            className="flex flex-col items-center gap-1 p-3 rounded-lg border-2 border-gray-200 hover:border-[#7DC47A] hover:bg-[#7DC47A]/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl">{option.emoji}</span>
            <span className="text-xs font-medium text-gray-700">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
