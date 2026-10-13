import { copilotChatInputSchema, type CopilotChatInput } from '@flourish/contracts';
import { getToken } from '@/lib/api';

export interface CopilotChunk {
  content?: string;
  sessionId?: string;
  error?: string;
}

/**
 * Stream chat with AI copilot via SSE.
 * Calls `onChunk` for each incremental response.
 * Returns final sessionId when stream completes.
 */
export async function streamCopilotChat(
  input: CopilotChatInput,
  onChunk: (chunk: CopilotChunk) => void,
): Promise<string | null> {
  const validated = copilotChatInputSchema.parse(input);
  const token = getToken();

  const res = await fetch('/api/copilot/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(validated),
  });

  if (!res.ok) {
    throw new Error(`Copilot API error: ${res.status}`);
  }

  if (!res.body) {
    throw new Error('No response body for streaming');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sessionId: string | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          if (payload === '[DONE]') {
            return sessionId;
          }
          try {
            const parsed = JSON.parse(payload) as CopilotChunk;
            if (parsed.sessionId) sessionId = parsed.sessionId;
            onChunk(parsed);
          } catch {
            // Ignore malformed SSE
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return sessionId;
}
