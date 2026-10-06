/**
 * Knowledge Query Handler - 知识问答处理器
 * 
 * 处理用户的健身知识问答（基于 RAG）
 */

import { llmService } from '../../llm/service';
import { searchKnowledge, formatKnowledgeContext } from '../knowledgeBase';

export class KnowledgeQueryHandler {
  /**
   * 处理知识问答
   */
  async handle(query: string, conversationHistory: Array<{ role: string; content: string }> = []): Promise<string> {
    // 1. 从知识库检索相关内容（RAG）
    const relevantKnowledge = searchKnowledge(query, 3);
    
    // 2. 构建增强提示词
    let enhancedPrompt = query;
    
    if (relevantKnowledge.length > 0) {
      const knowledgeContext = formatKnowledgeContext(relevantKnowledge);
      enhancedPrompt = `【参考知识】\n${knowledgeContext}\n\n---\n\n【用户问题】\n${query}\n\n请基于上述参考知识回答用户问题。如果参考知识中没有相关内容，可以结合你的健身专业知识回答，但要保持简洁（100字以内）。`;
    }
    
    // 3. 调用 LLM 生成回答
    const messages = [
      ...conversationHistory.slice(-5).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: enhancedPrompt,
      },
    ];
    
    const response = await llmService.chat({
      messages,
      temperature: 0.7,
      maxTokens: 300,
    });
    
    return response.content;
  }
  
  /**
   * 处理知识问答（流式）
   */
  async handleStream(
    query: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<AsyncIterable<string>> {
    // 1. 从知识库检索相关内容
    const relevantKnowledge = searchKnowledge(query, 3);
    
    // 2. 构建增强提示词
    let enhancedPrompt = query;
    
    if (relevantKnowledge.length > 0) {
      const knowledgeContext = formatKnowledgeContext(relevantKnowledge);
      enhancedPrompt = `【参考知识】\n${knowledgeContext}\n\n---\n\n【用户问题】\n${query}\n\n请基于上述参考知识回答用户问题。如果参考知识中没有相关内容，可以结合你的健身专业知识回答，但要保持简洁（100字以内）。`;
    }
    
    // 3. 调用 LLM 生成流式回答
    const messages = [
      ...conversationHistory.slice(-5).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: enhancedPrompt,
      },
    ];
    
    return llmService.chatStream({
      messages,
      temperature: 0.7,
      maxTokens: 300,
    });
  }
  
  /**
   * 检查查询是否为知识问答类型
   */
  isKnowledgeQuery(query: string): boolean {
    // 简单的启发式规则
    const questionPatterns = [
      /[?？]/,  // 包含问号
      /^(什么|如何|怎么|为什么|哪些|多久|几|能否|可以)/,  // 疑问词开头
      /吗$/,  // "吗"结尾
      /(怎么办|怎样|如何做)/,
    ];
    
    return questionPatterns.some(pattern => pattern.test(query));
  }
}
