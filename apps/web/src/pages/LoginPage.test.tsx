import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/lib/auth';
import { LoginPage } from './LoginPage';

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

beforeEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('LoginPage', () => {
  it('rejects invalid email/password before hitting the network', async () => {
    mockFetch(async () => new Response('should not be called', { status: 500 }));
    renderLogin();

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findAllByText(/./, { selector: '.text-danger' })).not.toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('logs in successfully and stores the token', async () => {
    mockFetch(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/login')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              token: 'test-token-123',
              user: {
                id: '00000000-0000-4000-8000-000000000001',
                email: 'demo@flourish.local',
                displayName: null,
                createdAt: new Date().toISOString(),
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/api/auth/me')) {
        return new Response(
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
        );
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    });

    renderLogin();

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'demo@flourish.local' },
    });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password-123' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => expect(localStorage.getItem('flourish_token')).toBe('test-token-123'));
  });

  it('shows a Chinese error message for wrong credentials (no enumeration)', async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify({ success: false, error: { code: 'invalid_credentials', message: 'bad' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    renderLogin();

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('邮箱或密码不正确');
  });
});
