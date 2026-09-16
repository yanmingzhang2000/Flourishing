// 生产环境下前端和后端同源，使用相对路径；开发环境指向本地后端
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || '请求失败');
  }

  return res.json();
}

// 认证
export const authApi = {
  register: (email: string, password: string) =>
    request<{ token: string; userId: number }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; userId: number }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  guest: () =>
    request<{ token: string; userId: number; isGuest: boolean }>('/api/auth/guest', {
      method: 'POST',
    }),
};

// 用户档案
export const userApi = {
  getProfile: () => request<any>('/api/user/profile'),
  updateProfile: (data: any) =>
    request<{ ok: boolean }>('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// 项目
export const projectsApi = {
  getAll: () => request<any[]>('/api/projects'),
  getById: (id: string) => request<any>(`/api/projects/${id}`),
  getExercises: (id: string) => request<any>(`/api/projects/${id}/exercises`),
};

// 训练计划
export const plansApi = {
  generate: (weekNumber?: number) =>
    request<any>('/api/plans/generate', {
      method: 'POST',
      body: JSON.stringify({ weekNumber }),
    }),
  getCurrent: () => request<any>('/api/plans/current'),
  getMonth: (year: number, month: number) => 
    request<any[]>(`/api/plans/month/${year}/${month}`),
  generateMonth: (year: number, month: number) =>
    request<any>(`/api/plans/month/${year}/${month}/generate`, {
      method: 'POST',
    }),
};

// 训练记录
export const recordsApi = {
  submit: (data: any) =>
    request<{ id: number }>('/api/records', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAll: (limit?: number) =>
    request<any[]>(`/api/records${limit ? `?limit=${limit}` : ''}`),
  getStats: () => request<any>('/api/records/stats'),
};

// token 管理
export function saveToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
