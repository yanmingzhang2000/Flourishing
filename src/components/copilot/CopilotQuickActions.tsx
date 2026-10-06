/**
 * CopilotQuickActions - 快捷操作组件
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCopilotContext } from '@/hooks/useCopilotContext';

export const CopilotQuickActions: React.FC = () => {
  const navigate = useNavigate();
  const { clearAllMessages } = useCopilotContext();

  const actions = [
    {
      id: 'clear_history',
      label: '清空所有历史',
      icon: '🗑️',
      onClick: () => {
        if (confirm('确定要清空所有对话历史吗？此操作无法撤销。')) {
          clearAllMessages();
        }
      },
    },
  ];

  return (
    <div className="border-t border-gray-100 p-4 bg-gray-50">
      <div className="text-xs font-semibold text-gray-500 mb-3">💡 快捷操作</div>
      <div className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 bg-white rounded-lg border border-gray-200 hover:border-[#7DC47A] hover:bg-[#7DC47A]/5 transition-all text-left"
          >
            <span className="text-xl">{action.icon}</span>
            <span className="text-sm font-medium text-gray-700">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
