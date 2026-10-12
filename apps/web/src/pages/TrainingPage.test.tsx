import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localToday } from '@/lib/dates';
import { TrainingPage } from './TrainingPage';

const profilePayload = {
  success: true,
  data: {
    userId: '00000000-0000-4000-8000-000000000001',
    heightCm: 165,
    weightKg: 52,
    age: null,
    experienceLevel: 'beginner',
    targetMinutesPerSession: 20,
    targetSessionsPerWeek: 3,
    injuries: [],
    availableEquipment: ['bodyweight', 'mat_6mm'],
    updatedAt: new Date().toISOString(),
  },
};

const emptyToday = { success: true, data: { plan: null, today: null, weekProgress: null } };

const plan = {
  id: '00000000-0000-4000-8000-000000000002',
  userId: '00000000-0000-4000-8000-000000000001',
  startDate: localToday(),
  status: 'active',
  libraryVersion: 'initial-2026-03-20',
  createdAt: new Date().toISOString(),
  adjustment: {
    feedback: 'too_easy',
    variable: 'reps',
    explanation: '上次觉得轻松，本次每组次数 +2。',
  },
  days: [
    {
      date: localToday(),
      estimatedDurationMinutes: 25,
      exercises: [
        {
          exerciseId: 'fb_bodyweight_squat',
          name: '居家深蹲（基础版）',
          sets: 3,
          reps: '12-15',
          durationSeconds: null,
          restSeconds: 45,
          difficulty: 2,
          warning: '膝痛者减小深度',
          libraryVersion: 'initial-2026-03-20',
        },
      ],
    },
  ],
};

const generatePayload = {
  success: true,
  data: { plan, libraryVersion: 'initial-2026-03-20' },
};

function renderTraining() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/training']}>
        <Routes>
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/" element={<div>今日首页</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

type MockInit = { method?: string; body?: unknown };

function mockFetch(todayPayload: unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: MockInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const data =
      url.includes('/api/plans/generate') ? generatePayload
      : url.includes('/api/plans/today') ? todayPayload
      : url.includes('/api/users/me/profile') ? profilePayload
      : { success: false, error: { code: 'not_found', message: 'unexpected' } };
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TrainingPage', () => {
  it('blocks generation until at least one project and one training day are selected', async () => {
    const fetchMock = mockFetch(emptyToday);
    vi.stubGlobal('fetch', fetchMock);
    renderTraining();

    fireEvent.click(await screen.findByRole('button', { name: /生成训练计划/ }));

    expect(await screen.findByText('请至少选择一个训练目标')).toBeInTheDocument();
    expect(await screen.findByText('请至少选择一个训练日')).toBeInTheDocument();
    const postCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(postCalls).toHaveLength(0);
  });

  it('generates a plan with startDate=今天 and navigates home', async () => {
    const fetchMock = mockFetch(emptyToday);
    vi.stubGlobal('fetch', fetchMock);
    renderTraining();

    fireEvent.click(await screen.findByLabelText('拜拜肉收紧'));
    fireEvent.click(screen.getByLabelText('周一'));
    fireEvent.click(screen.getByRole('button', { name: /生成训练计划/ }));

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
      expect(postCalls).toHaveLength(1);
    });
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    const body = JSON.parse(String(postCall?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      startDate: localToday(),
      targetProjects: ['tricep_tone'],
      trainingDays: ['monday'],
      targetMinutesPerSession: 20,
    });

    expect(await screen.findByText('今日首页')).toBeInTheDocument();
  });

  it('shows the active plan card with the adjustment explanation', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ success: true, data: { plan, today: null, weekProgress: null } }),
    );
    renderTraining();

    expect(await screen.findByText(/起 7 天 · 1 个训练日/)).toBeInTheDocument();
    expect(await screen.findByText(/上次觉得轻松，本次每组次数 \+2。/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /重新生成本周计划/ })).toBeInTheDocument();
  });
});
