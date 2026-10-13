import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Mock OpenAI (must be top-level)
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          async *[Symbol.asyncIterator]() {
            yield { choices: [{ delta: { content: '你好' } }] };
            yield { choices: [{ delta: { content: ',我是AI教练' } }] };
          },
        }),
      },
    };
  },
}));

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
});
