import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDaysIso, localToday } from '@/lib/dates';
import { CalendarPage } from './CalendarPage';

const userId = '00000000-0000-4000-8000-000000000001';
const planId = '00000000-0000-4000-8000-000000000002';

const today = localToday();
const dayAfterTomorrow = addDaysIso(today, 2);

const snapshot = {
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
  ...snapshot,
  exerciseId: 'fb_knee_pushup',
  name: '跪姿俯卧撑',
};

const planPayload = {
  success: true,
  data: {
    plan: {
      id: planId,
      userId,
      startDate: today,
      status: 'active',
      libraryVersion: 'initial-2026-03-20',
      createdAt: new Date().toISOString(),
      days: [
        {
          date: today,
          estimatedDurationMinutes: 25,
          exercises: [snapshot, snapshotB],
          recommendReason: '初学者基础全身循环',
        },
        {
          date: dayAfterTomorrow,
          estimatedDurationMinutes: 20,
          exercises: [snapshot],
        },
      ],
    },
  },
};

const emptyPlanPayload = { success: true, data: { plan: null } };

const completedRecord = {
  id: '00000000-0000-4000-8000-000000000004',
  userId,
  weekPlanId: planId,
  date: today,
  completed: true,
  durationMinutes: 25,
  feedback: 'too_hard',
  notes: '深蹲有点吃力',
  createdAt: new Date().toISOString(),
};

const recordsPayload = {
  success: true,
  data: [completedRecord],
};

const emptyRecordsPayload = { success: true, data: [] };

type Handler = (url: string, method: string) => { status?: number; payload: unknown };

function mockFetch(handler: Handler) {
  return vi.fn(async (input: RequestInfo | URL, init?: { method?: string }) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const result = handler(url, method);
    return new Response(JSON.stringify(result.payload), {
      status: result.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
}

function routeHandler(overrides: Partial<Record<string, unknown>> = {}): Handler {
  const defaults: Record<string, unknown> = {
    'GET /api/records': emptyRecordsPayload,
  };
  return (url, method) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    if (path.startsWith('/api/plans/active') && method === 'GET') {
      const payload = overrides['GET /api/plans/active'] ?? planPayload;
      return { payload };
    }
    const key = `${method} ${path}`;
    const payload = overrides[key] ?? defaults[key];
    if (payload === undefined) {
      return { status: 404, payload: { success: false, error: { code: 'not_found', message: key } } };
    }
    return { payload };
  };
}

function renderCalendar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
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

describe('CalendarPage', () => {
  it('shows empty states when there is no plan and no records', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        routeHandler({
          'GET /api/plans/active': emptyPlanPayload,
          'GET /api/records': emptyRecordsPayload,
        }),
      ),
    );
    renderCalendar();

    expect(await screen.findByText(/该日期所在周没有训练计划/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去生成计划' })).toBeInTheDocument();
    expect(screen.getByText(/还没有训练记录/)).toBeInTheDocument();
  });

  it('renders the plan week, completion badge, and selected-day detail with its record', async () => {
    vi.stubGlobal('fetch', mockFetch(routeHandler({ 'GET /api/records': recordsPayload })));
    renderCalendar();

    expect(await screen.findByText('2 个动作')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();

    // Rest day cells exist alongside training days
    expect(screen.getAllByText('休息').length).toBeGreaterThan(0);

    // Selected (today) detail shows exercises + the record summary
    expect(await screen.findByText('居家深蹲（基础版）')).toBeInTheDocument();
    expect(screen.getByText('跪姿俯卧撑')).toBeInTheDocument();
    expect(screen.getByText(/初学者基础全身循环/)).toBeInTheDocument();
    expect(screen.getByText(/时长 25 分钟/)).toBeInTheDocument();
    expect(screen.getByText(/感受 太难/)).toBeInTheDocument();
    // Notes appear both in the day detail summary and the history list.
    expect(screen.getAllByText(/深蹲有点吃力/).length).toBeGreaterThanOrEqual(1);
  });

  it('switches the selected day to a rest day detail', async () => {
    vi.stubGlobal('fetch', mockFetch(routeHandler()));
    renderCalendar();

    const restCells = await screen.findAllByRole('button', { name: /休息日/ });
    fireEvent.click(restCells[0]!);
    expect(screen.getByText('休息日，好好恢复。')).toBeInTheDocument();
  });

  it('navigates weeks via the API (date param shifts by 7 days)', async () => {
    const fetchMock = mockFetch(routeHandler({ 'GET /api/records': emptyRecordsPayload }));
    vi.stubGlobal('fetch', fetchMock);
    renderCalendar();

    await screen.findByText('2 个动作');
    fireEvent.click(screen.getByRole('button', { name: '下一周' }));

    await waitFor(() => {
      const activeCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/api/plans/active'),
      );
      expect(activeCalls.length).toBeGreaterThanOrEqual(2);
      expect(String(activeCalls[activeCalls.length - 1]?.[0])).toContain(
        `date=${addDaysIso(today, 7)}`,
      );
    });
  });

  it('lists training history with human-readable feedback labels', async () => {
    vi.stubGlobal('fetch', mockFetch(routeHandler({ 'GET /api/records': recordsPayload })));
    renderCalendar();

    expect(await screen.findByText('训练历史')).toBeInTheDocument();
    expect(screen.getAllByText(/25 分钟/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('太难')).toBeInTheDocument();
    expect(screen.getAllByText('深蹲有点吃力').length).toBeGreaterThanOrEqual(1);
  });
});
