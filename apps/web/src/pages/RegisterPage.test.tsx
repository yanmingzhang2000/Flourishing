import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/lib/auth';
import { RegisterPage } from './RegisterPage';

function renderRegister() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <RegisterPage />
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

describe('RegisterPage', () => {
  it('rejects a short password before hitting the network', async () => {
    mockFetch(async () => new Response('should not be called', { status: 500 }));
    renderRegister();

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'new@user.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    expect(await screen.findAllByText(/./, { selector: '.text-danger' })).not.toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('registers successfully and stores the token (auto-login)', async () => {
    mockFetch(async (input) => {
      const url = String(input);
      if (url.includes('/api/auth/register')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              token: 'fresh-token-456',
              user: {
                id: '00000000-0000-4000-8000-000000000002',
                email: 'new@user.com',
                displayName: null,
                createdAt: new Date().toISOString(),
              },
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/api/auth/me')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              user: {
                id: '00000000-0000-4000-8000-000000000002',
                email: 'new@user.com',
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

    renderRegister();

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'new@user.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password-123' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => expect(localStorage.getItem('flourish_token')).toBe('fresh-token-456'));
  });

  it('shows a Chinese message when the email is already taken', async () => {
    mockFetch(async () =>
      new Response(
        JSON.stringify({ success: false, error: { code: 'email_taken', message: 'taken' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    renderRegister();

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'dup@user.com' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password-123' } });
    fireEvent.click(screen.getByRole('button', { name: '注册' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('该邮箱已被注册');
  });
});
