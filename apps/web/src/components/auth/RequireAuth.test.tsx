import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/lib/auth';
import { RequireAuth } from './RequireAuth';

function renderGuarded() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div>受保护内容</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div>登录页</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('RequireAuth', () => {
  it('redirects to /login when there is no token (never renders guest-only guesswork)', async () => {
    renderGuarded();
    expect(await screen.findByText('登录页')).toBeInTheDocument();
    expect(screen.queryByText('受保护内容')).not.toBeInTheDocument();
  });

  it('renders the protected content once the session check succeeds', async () => {
    localStorage.setItem('flourish_token', 'valid-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              user: {
                id: '00000000-0000-4000-8000-000000000001',
                email: 'demo@flourish.local',
                displayName: null,
                createdAt: new Date().toISOString(),
              },
              profile: null,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    renderGuarded();
    expect(await screen.findByText('受保护内容')).toBeInTheDocument();
    expect(screen.queryByText('登录页')).not.toBeInTheDocument();
  });

  it('redirects to /login when the stored token is invalid (401)', async () => {
    localStorage.setItem('flourish_token', 'garbage-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ success: false, error: { code: 'unauthorized' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    renderGuarded();
    expect(await screen.findByText('登录页')).toBeInTheDocument();
  });
});
