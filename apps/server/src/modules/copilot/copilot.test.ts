import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Mock OpenAI (must be top-level). The stream factory is swappable per
// test so we can simulate LLM outputs that VIOLATE the safety rules.
const mocks = vi.hoisted(() => ({
  streamFactory: async function* (): AsyncGenerator<unknown> {
    yield { choices: [{ delta: { content: '你好' } }] };
    yield { choices: [{ delta: { content: ',我是AI教练' } }] };
  },
  createMock: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: (...args: unknown[]) => {
          mocks.createMock(...args);
          return {
            async *[Symbol.asyncIterator]() {
              yield* mocks.streamFactory();
            },
          };
        },
      },
    };
  },
}));

function streamFromText(text: string): AsyncGenerator<unknown> {
  return (async function* () {
    // Split into chunks to mimic real streaming
    for (let i = 0; i < text.length; i += 4) {
      yield { choices: [{ delta: { content: text.slice(i, i + 4) } }] };
    }
  })();
}

const tmpDb = path.join(os.tmpdir(), `flourish-copilot-test-${process.pid}-${Date.now()}.db`);

let server: Server;
let baseUrl: string;
let closeDb: (typeof import('../../db'))['closeDb'];
let runMigrationsFn: (typeof import('../../db/migrate'))['runMigrations'];

let uniqueCounter = 0;
function uniqueEmail(): string {
  uniqueCounter += 1;
  return `copilot-${process.pid}-${Date.now()}-${uniqueCounter}@flourish.local`;
}

async function register(email: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res;
}

beforeAll(async () => {
  process.env['DATABASE_PATH'] = tmpDb;
  // The copilot module reads OPENAI_API_KEY at import time; without it the
  // route degrades to a fixed message and never calls the (mocked) LLM.
  process.env['OPENAI_API_KEY'] = 'test-key';
  ({ runMigrations: runMigrationsFn } = await import('../../db/migrate'));
  runMigrationsFn();
  ({ closeDb } = await import('../../db'));

  const { createApp } = await import('../../app');
  const app = createApp();
  server = app.listen();
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('No server address');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => {
  server.close();
  closeDb();
  if (fs.existsSync(tmpDb)) fs.unlinkSync(tmpDb);
  vi.restoreAllMocks();
});

describe('POST /api/copilot/chat', () => {
  it('requires authentication', async () => {
    const res = await fetch(`${baseUrl}/api/copilot/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns SSE stream and creates session', async () => {
    const email = uniqueEmail();
    const regRes = await register(email, 'Test123!');
    const regBody = (await regRes.json()) as { data: { token: string } };
    const token = regBody.data.token;

    const res = await fetch(`${baseUrl}/api/copilot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: '如何锻炼胸部?' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    if (!res.body) throw new Error('No response body');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    let sessionId: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      accumulated += chunk;
      // Extract sessionId from SSE data
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.sessionId) sessionId = parsed.sessionId;
          } catch {}
        }
      }
    }

    expect(accumulated).toContain('data:');
    expect(accumulated).toContain('[DONE]');
    expect(sessionId).toBeTruthy();
  });

  it('reuses existing session when sessionId provided', async () => {
    const email = uniqueEmail();
    const regRes = await register(email, 'Test123!');
    const regBody = (await regRes.json()) as { data: { token: string } };
    const token = regBody.data.token;

    // First chat creates session
    const res1 = await fetch(`${baseUrl}/api/copilot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: '测试消息1' }),
    });
    const reader1 = res1.body!.getReader();
    const decoder = new TextDecoder();
    let sessionId: string | null = null;
    while (true) {
      const { done, value } = await reader1.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line.slice(6) !== '[DONE]') {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.sessionId) sessionId = parsed.sessionId;
          } catch {}
        }
      }
    }
    expect(sessionId).toBeTruthy();

    // Second chat reuses session
    const res2 = await fetch(`${baseUrl}/api/copilot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: '测试消息2', sessionId }),
    });
    expect(res2.status).toBe(200);
  });

  async function chat(token: string, message: string, sessionId?: string) {
    const res = await fetch(`${baseUrl}/api/copilot/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(sessionId ? { message, sessionId } : { message }),
    });
    if (!res.body) throw new Error('No response body');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
    }
    // Concatenate all content payloads from SSE data lines
    let content = '';
    for (const line of accumulated.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6);
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload) as { content?: string };
        if (typeof parsed.content === 'string') content += parsed.content;
      } catch {
        // ignore non-JSON payloads
      }
    }
    return { status: res.status, accumulated, content };
  }

  async function registerWithToken(): Promise<string> {
    const email = uniqueEmail();
    const regRes = await register(email, 'Test123!');
    const regBody = (await regRes.json()) as { data: { token: string } };
    return regBody.data.token;
  }

  it('sanitizes contraindicated exercises from the LLM reply (P0 safety red line)', async () => {
    const token = await registerWithToken();
    // Shoulder injury → 椅子臂屈伸 (chair dips) is contraindicated by the
    // deterministic rule engine and must never reach the user.
    const putRes = await fetch(`${baseUrl}/api/users/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ injuries: ['肩'] }),
    });
    expect(putRes.status).toBe(200);

    mocks.streamFactory = () =>
      streamFromText('你可以做椅子臂屈伸来锻炼手臂，再配合自重深蹲效果更好。');

    const { status, content } = await chat(token, '肩不舒服还能练什么?');
    expect(status).toBe(200);
    expect(content).not.toContain('椅子臂屈伸');
    expect(content).toContain('自重深蹲');
    expect(content).toContain('安全提示');
  });

  it('strips invented (non-library) exercises from the LLM reply', async () => {
    const token = await registerWithToken();

    mocks.streamFactory = () =>
      streamFromText('建议加入硬拉和桥式抬腿来强化后链，自重深蹲也不错。');

    const { status, content } = await chat(token, '有什么动作推荐?');
    expect(status).toBe(200);
    expect(content).not.toContain('硬拉');
    expect(content).not.toContain('桥式抬腿');
    expect(content).toContain('自重深蹲');
  });

  it('injects contraindicated list and today-session context into the system prompt', async () => {
    const token = await registerWithToken();
    await fetch(`${baseUrl}/api/users/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ injuries: ['肩'] }),
    });

    mocks.createMock.mockClear();
    mocks.streamFactory = () => streamFromText('好的，收到。');

    const { status } = await chat(token, '你好');
    expect(status).toBe(200);

    expect(mocks.createMock).toHaveBeenCalled();
    const callArgs = mocks.createMock.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const systemPrompt = callArgs.messages.find((m) => m.role === 'system')?.content ?? '';
    // Safety section with rule-engine-computed contraindicated names
    expect(systemPrompt).toContain('SAFETY CONSTRAINTS');
    expect(systemPrompt).toContain('椅子臂屈伸');
    // Whitelist section restricts the model to library exercises
    expect(systemPrompt).toContain('AVAILABLE EXERCISES');
    // Records context states the empty-session truth explicitly
    expect(systemPrompt).toContain('No completed training sessions yet');
  });
});
