import {
  CurrentExercise,
  HistoricalPlanSnapshot,
  MonthPlanGenerationResponse,
  PlanGenerationResponse,
  PlanSnapshot,
  ProjectExercisesResponse,
  StructuredUnavailableResult,
} from './types';
import { offlineQueue, isOnline } from './offlineQueue';
import { cache } from './indexedDB';

// 生产环境下前端和后端同源，使用相对路径；开发环境指向本地后端
const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

function getToken(): string | null {
  return localStorage.getItem('token');
}

interface RequestOptions extends RequestInit {
  /** 是否使用缓存（仅 GET 请求） */
  useCache?: boolean;
  /** 缓存时间（秒），默认 3600 */
  cacheTTL?: number;
  /** 离线时是否加入重试队列（仅 POST/PUT/DELETE） */
  queueIfOffline?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { useCache = false, cacheTTL = 3600, queueIfOffline = true, ...fetchOptions } = options;
  const method = fetchOptions.method || 'GET';
  const token = getToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  
  // 合并用户提供的 headers
  if (fetchOptions.headers) {
    Object.entries(fetchOptions.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

  const fullUrl = `${BASE_URL}${path}`;

  // GET 请求且启用缓存
  if (method === 'GET' && useCache) {
    const cacheKey = `api:${path}`;
    const cached = await cache.get<T>(cacheKey);
    if (cached) {
      console.log('[API] Cache hit:', path);
      return cached;
    }
  }

  // 检查网络状态
  if (!isOnline() && method !== 'GET') {
    // 写操作且离线，加入队列
    if (queueIfOffline) {
      const requestId = await offlineQueue.addRequest(
        fullUrl,
        method,
        fetchOptions.body as string,
        headers
      );
      console.log('[API] Request queued for retry:', requestId);
      
      // 返回一个假的成功响应（前端乐观更新）
      return { queued: true, requestId } as any;
    } else {
      throw new Error('网络连接不可用');
    }
  }

  // 正常发起请求
  try {
    const res = await fetch(fullUrl, {
      ...fetchOptions,
      headers,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '请求失败' }));
      throw new Error(err.error || '请求失败');
    }

    const data = await res.json();

    // GET 请求且启用缓存，保存到缓存
    if (method === 'GET' && useCache) {
      const cacheKey = `api:${path}`;
      await cache.set(cacheKey, data, cacheTTL);
    }

    return data;
  } catch (error: any) {
    // 网络错误且是写操作，尝试加入队列
    if (queueIfOffline && method !== 'GET' && error.name === 'TypeError') {
      const requestId = await offlineQueue.addRequest(
        fullUrl,
        method,
        fetchOptions.body as string,
        headers
      );
      console.log('[API] Network error, request queued:', requestId);
      return { queued: true, requestId } as any;
    }
    
    throw error;
  }
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
  updateProfile: (data: {
    experience?: string;
    injuries?: string[];
    equipment?: string[];
    selected_projects?: string[];
    max_days_per_week?: number;
    session_max_min?: number;
    /** ISO-week day indices: 0=Mon … 6=Sun */
    training_days?: number[];
    display_name?: string;
    age?: number;
    height?: number;
    weight?: number;
    onboarding_completed?: boolean;
  }) =>
    request<{ ok: boolean }>('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// 项目实例（V2）
export const projectInstancesApi = {
  getAll: () => request<any[]>('/api/project-instances'),
  create: (projectId: string, targetWeeks: 4 | 6 | 8, startDate?: string) =>
    request<any>('/api/project-instances', {
      method: 'POST',
      body: JSON.stringify({ projectId, targetWeeks, startDate }),
    }),
  update: (id: string, data: { status?: 'active' | 'paused' | 'completed'; currentWeek?: number }) =>
    request<any>(`/api/project-instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/project-instances/${id}`, { method: 'DELETE' }),
};

// V2: 按项目生成计划（服务端 /api/projects/:id/plans/*）
export const projectPlansApi = {
  generate: (projectId: string, weekNumber?: number) =>
    request<PlanGenerationResponse>(`/api/projects/${projectId}/plans/generate`, {
      method: 'POST',
      body: JSON.stringify({ weekNumber }),
    }),
  getCurrent: (projectId: string) =>
    request<PlanSnapshot | null>(`/api/projects/${projectId}/plans/current`),
  getMonth: (projectId: string, year: number, month: number) =>
    request<HistoricalPlanSnapshot[]>(`/api/projects/${projectId}/plans/month/${year}/${month}`),
  generateMonth: (projectId: string, year: number, month: number): Promise<MonthPlanGenerationResponse> =>
    request<MonthPlanGenerationResponse>(`/api/projects/${projectId}/plans/month/${year}/${month}/generate`, {
      method: 'POST',
    }),
};

// 项目
export const projectsApi = {
  getAll: () => request<any[]>('/api/projects'),
  getById: (id: string) => request<any>(`/api/projects/${id}`),
  getExercises: (id: string) => request<ProjectExercisesResponse>(`/api/projects/${id}/exercises`),
  getExercise: (id: string) => request<CurrentExercise>(`/api/exercises/${id}`),
};

export const exercisesApi = {
  getById: (id: string) => request<CurrentExercise>(`/api/exercises/${id}`),
};

// 训练计划
export const plansApi = {
  generate: (weekNumber?: number) =>
    request<PlanGenerationResponse>('/api/plans/generate', {
      method: 'POST',
      body: JSON.stringify({ weekNumber }),
    }),
  /** V2：按指定项目列表生成计划，不改写 profile.selected_projects */
  generateForProject: (projectIds: string[], weekNumber?: number) =>
    request<PlanGenerationResponse>('/api/plans/generate', {
      method: 'POST',
      body: JSON.stringify({ projectIds, weekNumber }),
    }),
  getCurrent: () => request<PlanSnapshot | null>('/api/plans/current'),
  getByDate: (date: string) => request<PlanSnapshot | null>(`/api/plans/by-date/${date}`),
  getById: (id: number | string) => request<HistoricalPlanSnapshot>(`/api/plans/${id}`),
  getMonth: (year: number, month: number) =>
    request<HistoricalPlanSnapshot[]>(`/api/plans/month/${year}/${month}`),
  getYear: (year: number) =>
    request<HistoricalPlanSnapshot[]>(`/api/plans/year/${year}`),
  generateMonth: (year: number, month: number, projectIds?: string[]): Promise<MonthPlanGenerationResponse> =>
    request<MonthPlanGenerationResponse>(`/api/plans/month/${year}/${month}/generate`, {
      method: 'POST',
      body: JSON.stringify({ projectIds }),
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
