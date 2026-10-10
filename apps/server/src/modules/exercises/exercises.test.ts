import { exerciseListResponseSchema } from '@flourish/contracts';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createApp();
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to bind test server');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('GET /api/exercises', () => {
  it('returns a contract-valid exercise library with mapped covers', async () => {
    const res = await fetch(`${baseUrl}/api/exercises`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.success).toBe(true);

    const parsed = exerciseListResponseSchema.parse(body.data);
    expect(parsed.libraryVersion.length).toBeGreaterThan(0);
    expect(parsed.exercises.length).toBeGreaterThanOrEqual(1);

    const withCover = parsed.exercises.filter((e) => e.media?.coverImage);
    expect(withCover.length).toBeGreaterThan(0);
    for (const exercise of withCover) {
      expect(exercise.media?.coverImage).toMatch(/^\/images\/exercises\/.+\.jpg$/);
    }
  });
});
