/**
 * Copilot Modal - Copilot 响应模态框
 */

import React from 'react';
import { CopilotResponse } from '@/lib/copilot/types';

interface CopilotModalProps {
  response: CopilotResponse;
  isProcessing?: boolean;
  onAction: (actionId: string, params?: any) => Promise<boolean>;
  onDismiss: () => void;
}

export const CopilotModal: React.FC<CopilotModalProps> = ({
  response,
  isProcessing,
  onAction,
  onDismiss,
}) => {
  const [executingAction, setExecutingAction] = React.useState<string | null>(null);

  const handleAction = async (actionId: string, params?: any) => {
    setExecutingAction(actionId);
    const success = await onAction(actionId, params);
    setExecutingAction(null);
    
    // 如果没有后续消息且成功，自动关闭
    if (success && !response.message.actions.length) {
      onDismiss();
    }
  };

  // 根据 tone 获取样式
  const getToneStyles = () => {
    switch (response.message.tone) {
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'encouraging':
      case 'celebratory':
        return 'bg-green-50 border-green-200';
      case 'informative':
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onDismiss}>
      <div 
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Copilot 头像 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#7DC47A] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xl">🤖</span>
          </div>
          <div className="font-bold text-gray-800">AI 教练</div>
        </div>

        {/* 响应消息 */}
        <div className={`rounded-xl p-4 mb-6 border-2 ${getToneStyles()}`}>
          <div className="text-gray-700 whitespace-pre-line leading-relaxed">
            {response.message.content}
          </div>
        </div>

        {/* 操作按钮 */}
        {response.message.actions.length > 0 ? (
          <div className="space-y-3">
            {response.message.actions.map((action) => {
              const isPrimary = action.style === 'primary';
              const isExecuting = executingAction === action.id;
              const isDisabled = isProcessing || executingAction !== null;

              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id, action.params)}
                  disabled={isDisabled}
                  className={`w-full py-3 rounded-lg font-medium transition-all ${
                    isPrimary
                      ? 'bg-[#7DC47A] text-white hover:bg-[#6DB569]'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isExecuting ? '处理中...' : action.label}
                </button>
              );
            })}
          </div>
        ) : (
          <button
            onClick={onDismiss}
            disabled={isProcessing}
            className="w-full py-3 bg-[#7DC47A] text-white rounded-lg font-medium hover:bg-[#6DB569] transition-all"
          >
            知道了
          </button>
        )}
      </div>
    </div>
  );
};
