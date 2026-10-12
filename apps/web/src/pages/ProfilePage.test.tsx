import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';

const exercise = {
  exerciseId: 'fb_bodyweight_squat',
  name: '居家深蹲（基础版）',
  nameEn: 'Bodyweight Squat Basic',
  muscleGroup: { primary: ['股四头肌'], secondary: [] },
  difficulty: 2,
  equipment: ['bodyweight', 'mat_6mm'],
  function: { primary: '激活', secondary: '紧致' },
  category: 'strength',
  targetProjects: ['full_body_basic'],
  contraindications: ['knee_pain'],
  alternativeExerciseIds: [],
  restSeconds: 45,
  steps: ['双脚与肩同宽'],
  tips: ['膝盖不内扣'],
  warning: '膝痛者减小深度',
};

const profileData = {
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
};

const profilePayload = { success: true, data: profileData };
const exercisesPayload = {
  success: true,
  data: { libraryVersion: 'initial-2026-03-20', exercises: [exercise] },
};

function renderProfile() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/profile']}>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const data =
      url.includes('/api/exercises') ? exercisesPayload
      : url.includes('/api/users/me/profile') && method === 'PUT' ? profilePayload
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

describe('ProfilePage', () => {
  it('renders injury options sourced from the training-domain mapping', async () => {
    vi.stubGlobal('fetch', mockFetch());
    renderProfile();

    // Keys of INJURY_OPTION_TAG_MAP (single source of truth, SAFE-01).
    for (const option of ['肩', '肘', '腕', '腰', '膝', '颈']) {
      expect(await screen.findByLabelText(option)).toBeInTheDocument();
    }
  });

  it('blocks save with a validation error before hitting the network', async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderProfile();

    const heightInput = await screen.findByLabelText('身高（cm）');
    fireEvent.change(heightInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /保存资料/ }));

    expect(await screen.findByText('请输入数字')).toBeInTheDocument();
    const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(putCalls).toHaveLength(0);
  });

  it('saves the profile and sends the full validated payload', async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderProfile();

    fireEvent.click(await screen.findByRole('button', { name: /保存资料/ }));

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');
      expect(putCalls).toHaveLength(1);
    });
    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    const body = JSON.parse(String(putCall?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      heightCm: 165,
      weightKg: 52,
      experienceLevel: 'beginner',
      age: null,
      targetMinutesPerSession: 20,
      targetSessionsPerWeek: 3,
      injuries: [],
      availableEquipment: ['bodyweight', 'mat_6mm'],
    });

    expect(await screen.findByRole('status')).toHaveTextContent('已保存');
  });
});
