/**
 * useCopilotContext Hook - 封装 Context 访问
 */

import { useContext } from 'react';
import { CopilotContext } from '@/contexts/CopilotContext';

export function useCopilotContext() {
  const context = useContext(CopilotContext);
  
  if (!context) {
    throw new Error('useCopilotContext must be used within CopilotProvider');
  }
  
  return context;
}
