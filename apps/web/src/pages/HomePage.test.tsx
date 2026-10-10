import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

const TODAY_DATE = new Date();
const PAD = (n: number) => String(n).padStart(2, '0');
const TODAY_ISO = `${TODAY_DATE.getFullYear()}-${PAD(TODAY_DATE.getMonth() + 1)}-${PAD(TODAY_DATE.getDate())}`;

function isoDays(offset: number): string {
  const d = new Date(TODAY_DATE);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
}

const exercise = {
  exerciseId: 'fb_bodyweight_squat',
  name: '居家深蹲（基础版）',
  nameEn: 'Bodyweight Squat Basic',
  muscleGroup: { primary: ['股四头肌'], secondary: [] },
  difficulty: 2,
  equipment: ['bodyweight'],
  function: { primary: '激活', secondary: '紧致' },
  category: 'strength',
  targetProjects: ['full_body_basic'],
  contraindications: ['knee_pain'],
  alternativeExerciseIds: [],
  restSeconds: 45,
  steps: ['双脚与肩同宽'],
  tips: ['膝盖不内扣'],
  warning: '膝痛者减小深度',
  media: { coverImage: '/images/exercises/fb_bodyweight_squat_cover.jpg', video: null },
};

const plan = {
  id: '00000000-0000-4000-8000-000000000002',
  userId: '00000000-0000-4000-8000-000000000001',
  startDate: isoDays(-5),
  status: 'active',
  libraryVersion: 'initial-2026-03-20',
  createdAt: new Date().toISOString(),
  days: [
    {
      date: TODAY_ISO,
      estimatedDurationMinutes: 25,
      recommendReason: '初学者全身基础，强度锁定难度 2。',
      exercises: [
        {
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          sets: 3,
          reps: '12-15',
          durationSeconds: null,
          restSeconds: 45,
          difficulty: 2,
          warning: exercise.warning,
          libraryVersion: 'initial-2026-03-20',
        },
      ],
    },
  ],
};

const todayPayload = {
  success: true,
  data: {
    plan,
    today: plan.days[0],
    weekProgress: {
      startDate: plan.startDate,
      scheduled: 3,
      completed: 1,
      days: [
        { date: isoDays(-1), completed: true, isToday: false },
        { date: TODAY_ISO, completed: false, isToday: true },
        { date: isoDays(1), completed: false, isToday: false },
      ],
    },
  },
};

const exercisesPayload = {
  success: true,
  data: { libraryVersion: 'initial-2026-03-20', exercises: [exercise] },
};

const emptyPayload = { success: true, data: { plan: null, today: null, weekProgress: null } };

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockFetch(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const data =
        url.includes('/api/exercises') ? exercisesPayload
        : url.includes('/api/plans/today') ? payload
        : { success: false, error: { code: 'not_found', message: 'unexpected' } };
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HomePage', () => {
  it('renders today workout card with CTA, progress and recommendation', async () => {
    mockFetch(todayPayload);
    renderHome();

    expect(await screen.findByText('开始今天的训练')).toBeInTheDocument();
    expect(await screen.findByText('居家深蹲（基础版）')).toBeInTheDocument();
    expect(await screen.findByText(/膝痛者减小深度/)).toBeInTheDocument();
    expect(await screen.findByText(/初学者全身基础/)).toBeInTheDocument();
    expect(await screen.findByText('/ 3 次')).toBeInTheDocument();
  });

  it('renders empty state when no plan exists', async () => {
    mockFetch(emptyPayload);
    renderHome();

    expect(await screen.findByText('还没有训练计划')).toBeInTheDocument();
    expect(screen.queryByText('开始今天的训练')).not.toBeInTheDocument();
  });

  it('renders error state with retry when API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    renderHome();

    expect(
      await screen.findByText('今日训练加载失败', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /重试/ }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});
