/**
 * 离线请求队列管理
 * 当网络不可用时，将请求加入队列；网络恢复后自动重试
 */

import { db, STORES, PendingRequest } from './indexedDB';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1秒

type QueueEventType = 'online' | 'offline' | 'request-added' | 'request-completed' | 'request-failed';
type QueueListener = (event: { type: QueueEventType; data?: any }) => void;

class OfflineQueue {
  private isOnline: boolean = navigator.onLine;
  private processing: boolean = false;
  private listeners: QueueListener[] = [];

  constructor() {
    // 监听网络状态变化
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * 添加监听器
   */
  on(listener: QueueListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * 触发事件
   */
  private emit(type: QueueEventType, data?: any): void {
    this.listeners.forEach(listener => listener({ type, data }));
  }

  /**
   * 网络恢复处理
   */
  private handleOnline(): void {
    console.log('[OfflineQueue] Network online');
    this.isOnline = true;
    this.emit('online');
    this.processQueue();
  }

  /**
   * 网络断开处理
   */
  private handleOffline(): void {
    console.log('[OfflineQueue] Network offline');
    this.isOnline = false;
    this.emit('offline');
  }

  /**
   * 添加请求到队列
   */
  async addRequest(
    url: string,
    method: string,
    body?: string,
    headers?: Record<string, string>
  ): Promise<string> {
    const request: PendingRequest = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      method,
      body,
      headers,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    };

    await db.put(STORES.PENDING_REQUESTS, request);
    console.log('[OfflineQueue] Request queued:', request.id);
    this.emit('request-added', { requestId: request.id });

    // 如果在线，立即尝试处理
    if (this.isOnline) {
      this.processQueue();
    }

    return request.id;
  }

  /**
   * 处理队列中的请求
   */
  async processQueue(): Promise<void> {
    if (this.processing || !this.isOnline) return;

    this.processing = true;

    try {
      const requests = await db.getAll<PendingRequest>(STORES.PENDING_REQUESTS);
      
      // 按时间排序
      requests.sort((a, b) => a.timestamp - b.timestamp);

      for (const request of requests) {
        await this.processRequest(request);
      }
    } catch (error) {
      console.error('[OfflineQueue] Error processing queue:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * 处理单个请求
   */
  private async processRequest(request: PendingRequest): Promise<void> {
    try {
      console.log(`[OfflineQueue] Processing request ${request.id}...`);

      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.headers,
        },
        body: request.body,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 成功，从队列移除
      await db.delete(STORES.PENDING_REQUESTS, request.id);
      console.log(`[OfflineQueue] Request ${request.id} completed successfully`);
      this.emit('request-completed', { requestId: request.id });

    } catch (error) {
      console.error(`[OfflineQueue] Request ${request.id} failed:`, error);

      // 增加重试计数
      request.retryCount++;

      if (request.retryCount >= request.maxRetries) {
        // 达到最大重试次数，移除请求
        await db.delete(STORES.PENDING_REQUESTS, request.id);
        console.log(`[OfflineQueue] Request ${request.id} failed after ${request.maxRetries} retries`);
        this.emit('request-failed', { requestId: request.id, error });
      } else {
        // 更新重试计数
        await db.put(STORES.PENDING_REQUESTS, request);
        console.log(`[OfflineQueue] Request ${request.id} will retry (${request.retryCount}/${request.maxRetries})`);
        
        // 延迟后重试
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * request.retryCount));
      }
    }
  }

  /**
   * 获取队列状态
   */
  async getStatus(): Promise<{
    isOnline: boolean;
    pendingCount: number;
    requests: PendingRequest[];
  }> {
    const requests = await db.getAll<PendingRequest>(STORES.PENDING_REQUESTS);
    return {
      isOnline: this.isOnline,
      pendingCount: requests.length,
      requests,
    };
  }

  /**
   * 清空队列（慎用）
   */
  async clearQueue(): Promise<void> {
    await db.clear(STORES.PENDING_REQUESTS);
    console.log('[OfflineQueue] Queue cleared');
  }

  /**
   * 手动触发队列处理
   */
  retry(): void {
    this.processQueue();
  }
}

// 单例
export const offlineQueue = new OfflineQueue();

/**
 * 检查网络连接
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * 等待网络恢复
 */
export function waitForOnline(timeout: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    if (navigator.onLine) {
      resolve(true);
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeout);

    const handleOnline = () => {
      cleanup();
      resolve(true);
    };

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
    };

    window.addEventListener('online', handleOnline);
  });
}
