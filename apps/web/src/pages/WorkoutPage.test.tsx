import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localToday } from '@/lib/dates';
import { WorkoutPage } from './WorkoutPage';

const userId = '00000000-0000-4000-8000-000000000001';
const planId = '00000000-0000-4000-8000-000000000002';
const sessionId = '00000000-0000-4000-8000-000000000003';

const snapshotA = {
  exerciseId: 'fb_bodyweight_squat',
  name: '居家深蹲（基础版）',
  sets: 3,
  reps: '12-15',
  durationSeconds: null,
  restSeconds: 45,
  difficulty: 2,
  warning: '膝痛者减小深度',
  libraryVersion: 'initial-2026-03-20',
};

const snapshotB = {
  exerciseId: 'fb_knee_pushup',
  name: '跪姿俯卧撑',
  sets: 3,
  reps: '8-10',
  durationSeconds: null,
  restSeconds: 45,
  difficulty: 2,
  warning: '腕痛请暂停',
  libraryVersion: 'initial-2026-03-20',
};

const todayPayload = {
  success: true,
  data: {
    plan: {
      id: planId,
      userId,
      startDate: localToday(),
      status: 'active',
      libraryVersion: 'initial-2026-03-20',
      createdAt: new Date().toISOString(),
      days: [
        {
          date: localToday(),
          estimatedDurationMinutes: 25,
          exercises: [snapshotA, snapshotB],
        },
      ],
    },
    today: {
      date: localToday(),
      estimatedDurationMinutes: 25,
      exercises: [snapshotA, snapshotB],
    },
    weekProgress: null,
  },
};

const emptyToday = { success: true, data: { plan: null, today: null, weekProgress: null } };

function makeSession(
  exercises: Array<{ exerciseSnapshot: typeof snapshotA; status: string; reason?: string | null; discomfort?: unknown }>,
  status = 'in_progress',
) {
  return {
    success: true,
    data: {
      id: sessionId,
      userId,
      weekPlanId: planId,
      date: localToday(),
      status,
      exercises: exercises.map((e) => ({
        reason: null,
        discomfort: null,
        ...e,
      })),
      startedAt: new Date().toISOString(),
      completedAt: status === 'in_progress' ? null : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

const pendingSession = makeSession([
  { exerciseSnapshot: snapshotA, status: 'pending' },
  { exerciseSnapshot: snapshotB, status: 'pending' },
]);

type Handler = (url: string, method: string, body: Record<string, unknown>) => {
  status?: number;
  payload: unknown;
};

function mockFetch(handler: Handler) {
  return vi.fn(async (input: RequestInfo | URL, init?: { method?: string; body?: string }) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(init?.body ?? '{}') as Record<string, unknown>;
    } catch {
      body = {};
    }
    const result = handler(url, method, body);
    return new Response(JSON.stringify(result.payload), {
      status: result.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

function routeHandler(overrides: Partial<Record<string, unknown>> = {}): Handler {
  const defaults: Record<string, unknown> = {
    'GET /api/plans/today': todayPayload,
    'POST /api/workouts/sessions': pendingSession,
  };
  return (url, method, body) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    // Dynamic exercise action route — exerciseId comes from the URL path.
    const exerciseAction = path.match(/^\/api\/workouts\/sessions\/[^/]+\/exercises\/([^/]+)$/);
    if (exerciseAction && method === 'POST') {
      const exerciseId = decodeURIComponent(exerciseAction[1] ?? '');
      // Echo a session where the targeted exercise reflects the action.
      const exercises = (pendingSession.data.exercises as Array<Record<string, unknown>>).map(
        (e) => {
          const snap = e['exerciseSnapshot'] as { exerciseId: string };
          if (snap.exerciseId !== exerciseId) return e;
          return { ...e, status: 'completed', reason: null };
        },
      );
      return { payload: makeSession(exercises as never) };
    }
    const key = `${method} ${path}`;
    const payload = overrides[key] ?? defaults[key];
    if (payload === undefined) {
      return { status: 404, payload: { success: false, error: { code: 'not_found', message: key } } };
    }
    return { payload };
  };
}

function renderWorkout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/workout/today']}>
        <Routes>
          <Route path="/workout/today" element={<WorkoutPage />} />
          <Route path="/" element={<div>今日首页</div>} />
          <Route path="/training" element={<div>训练页</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WorkoutPage', () => {
  it('shows the empty state when there is no plan for today', async () => {
    vi.stubGlobal('fetch', mockFetch(routeHandler({ 'GET /api/plans/today': emptyToday })));
    renderWorkout();

    expect(await screen.findByText('今天没有训练安排')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去生成计划' })).toBeInTheDocument();
  });

  it('starts a session and completes one exercise via the API', async () => {
    const fetchMock = mockFetch(routeHandler());
    vi.stubGlobal('fetch', fetchMock);
    renderWorkout();

    expect(await screen.findByText('居家深蹲（基础版）')).toBeInTheDocument();
    const startCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/api/workouts/sessions'),
    );
    expect(startCalls).toHaveLength(1);
    expect(JSON.parse(String(startCalls[0]?.[1]?.body))).toMatchObject({
      weekPlanId: planId,
      date: localToday(),
    });

    fireEvent.click(await screen.findByRole('button', { name: '完成 居家深蹲（基础版）' }));

    await waitFor(() => {
      const actionCalls = fetchMock.mock.calls.filter(([url, init]) =>
        String(url).includes('/exercises/') && init?.method === 'POST',
      );
      expect(actionCalls).toHaveLength(1);
      expect(JSON.parse(String(actionCalls[0]?.[1]?.body))).toMatchObject({
        action: 'complete',
      });
    });
    expect(await screen.findByText('已完成')).toBeInTheDocument();
  });

  it('reports joint discomfort: hard-blocks later exercises and offers alternatives', async () => {
    const blockedSession = makeSession([
      {
        exerciseSnapshot: snapshotA,
        status: 'skipped',
        reason: '关节不适（膝·moderate），已停止该动作',
        discomfort: { exerciseId: snapshotA.exerciseId, bodyArea: '膝', severity: 'moderate' },
      },
      { exerciseSnapshot: snapshotB, status: 'blocked', reason: '安全重校验：命中禁忌 knee_pain' },
    ]);
    const fetchMock = mockFetch(
      routeHandler({
        'POST /api/workouts/sessions/00000000-0000-4000-8000-000000000003/joint-discomfort': {
          success: true,
          data: {
            session: blockedSession.data,
            reportedExerciseId: snapshotA.exerciseId,
            newlyBlocked: [
              { exerciseId: snapshotB.exerciseId, name: snapshotB.name, reasonTags: ['knee_pain'] },
            ],
            alternatives: [
              {
                forExerciseId: snapshotA.exerciseId,
                replacement: {
                  ...snapshotA,
                  exerciseId: 'fb_glute_bridge',
                  name: '臀桥',
                  warning: '腰部不要过伸',
                },
              },
            ],
            restAdvice: '中度不适：建议停止本次训练中的相关动作，休息 1-2 天观察，必要时就医。',
            suggestedInjuryOptions: ['膝'],
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWorkout();

    fireEvent.click(await screen.findByRole('button', { name: '关节不适 居家深蹲（基础版）' }));
    fireEvent.click(screen.getByLabelText('膝'));
    fireEvent.click(screen.getByLabelText('中度'));
    fireEvent.click(
      screen.getByRole('button', { name: /停止该动作并检查后续/ }),
    );

    // Deterministic safety result surfaces from the server.
    expect(
      await screen.findByText(/中度不适：建议停止本次训练中的相关动作/),
    ).toBeInTheDocument();
    expect(screen.getByText(/跪姿俯卧撑（原因：knee_pain）/)).toBeInTheDocument();
    expect(screen.getByText('臀桥')).toBeInTheDocument();

    // Blocked exercise can never offer a complete action.
    expect(
      screen.queryByRole('button', { name: '完成 跪姿俯卧撑' }),
    ).not.toBeInTheDocument();

    const discomfortCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/joint-discomfort'),
    );
    expect(discomfortCalls).toHaveLength(1);
    expect(JSON.parse(String(discomfortCalls[0]?.[1]?.body))).toMatchObject({
      exerciseId: snapshotA.exerciseId,
      bodyArea: '膝',
      severity: 'moderate',
    });
  });

  it('syncs suggested injury options into the profile only after user confirmation', async () => {
    const fetchMock = mockFetch(
      routeHandler({
        'GET /api/users/me/profile': {
          success: true,
          data: {
            userId,
            heightCm: 165,
            weightKg: 52,
            age: null,
            experienceLevel: 'beginner',
            targetMinutesPerSession: 25,
            targetSessionsPerWeek: 3,
            injuries: [],
            availableEquipment: ['bodyweight', 'mat_6mm'],
            updatedAt: new Date().toISOString(),
          },
        },
        'PUT /api/users/me/profile': {
          success: true,
          data: {
            userId,
            heightCm: 165,
            weightKg: 52,
            age: null,
            experienceLevel: 'beginner',
            targetMinutesPerSession: 25,
            targetSessionsPerWeek: 3,
            injuries: ['肩'],
            availableEquipment: ['bodyweight', 'mat_6mm'],
            updatedAt: new Date().toISOString(),
          },
        },
        'POST /api/workouts/sessions/00000000-0000-4000-8000-000000000003/joint-discomfort': {
          success: true,
          data: {
            session: pendingSession.data,
            reportedExerciseId: snapshotA.exerciseId,
            newlyBlocked: [],
            alternatives: [],
            restAdvice: '轻微不适：暂停该动作并放松拉伸后观察；若持续不适请降低强度。',
            suggestedInjuryOptions: ['肩'],
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWorkout();

    fireEvent.click(await screen.findByRole('button', { name: '关节不适 居家深蹲（基础版）' }));
    fireEvent.click(screen.getByLabelText('肩'));
    fireEvent.click(screen.getByRole('button', { name: /停止该动作并检查后续/ }));

    const syncButton = await screen.findByRole('button', { name: '同步到训练资料' });
    // No profile write happened before the user confirms.
    expect(
      fetchMock.mock.calls.filter(([url, init]) => init?.method === 'PUT' && String(url).includes('/profile')),
    ).toHaveLength(0);

    fireEvent.click(syncButton);
    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([url, init]) => init?.method === 'PUT' && String(url).includes('/profile'),
      );
      expect(putCalls).toHaveLength(1);
      expect(JSON.parse(String(putCalls[0]?.[1]?.body))).toMatchObject({ injuries: ['肩'] });
    });
  });

  it('requires feedback before completing and submits it with the duration', async () => {
    const completedSession = makeSession(
      [
        { exerciseSnapshot: snapshotA, status: 'completed' },
        { exerciseSnapshot: snapshotB, status: 'completed' },
      ],
      'completed',
    );
    const fetchMock = mockFetch(
      routeHandler({
        'POST /api/workouts/sessions/00000000-0000-4000-8000-000000000003/complete': {
          success: true,
          data: {
            session: completedSession.data,
            recordId: '00000000-0000-4000-8000-000000000004',
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWorkout();

    fireEvent.click(await screen.findByRole('button', { name: /完成训练并填写感受/ }));

    // Submitting without feedback is blocked client-side.
    fireEvent.click(screen.getByRole('button', { name: /保存并完成本次训练/ }));
    expect(await screen.findByText('请选择本次训练的感受')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('太难'));
    fireEvent.click(screen.getByRole('button', { name: /保存并完成本次训练/ }));

    await waitFor(() => {
      const completeCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/complete'),
      );
      expect(completeCalls).toHaveLength(1);
      expect(JSON.parse(String(completeCalls[0]?.[1]?.body))).toMatchObject({
        durationMinutes: 25,
        feedback: 'too_hard',
        notes: null,
      });
    });

    expect(await screen.findByText('本次训练已完成')).toBeInTheDocument();
  });
});
