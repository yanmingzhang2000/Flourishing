/**
 * IndexedDB 封装层
 * 用于离线数据缓存和持久化
 */

const DB_NAME = 'FlourishingDB';
const DB_VERSION = 1;

// Store 名称
export const STORES = {
  PLANS: 'plans',
  RECORDS: 'records',
  PROFILE: 'profile',
  PENDING_REQUESTS: 'pending_requests',
  CACHE: 'cache',
} as const;

export interface PendingRequest {
  id: string;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

let dbInstance: IDBDatabase | null = null;

/**
 * 初始化数据库
 */
export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 计划缓存表
      if (!db.objectStoreNames.contains(STORES.PLANS)) {
        const planStore = db.createObjectStore(STORES.PLANS, { keyPath: 'id' });
        planStore.createIndex('date', 'date', { unique: false });
        planStore.createIndex('projectId', 'projectId', { unique: false });
      }

      // 训练记录缓存表
      if (!db.objectStoreNames.contains(STORES.RECORDS)) {
        const recordStore = db.createObjectStore(STORES.RECORDS, { keyPath: 'id', autoIncrement: true });
        recordStore.createIndex('date', 'date', { unique: false });
        recordStore.createIndex('synced', 'synced', { unique: false });
      }

      // 用户档案缓存表
      if (!db.objectStoreNames.contains(STORES.PROFILE)) {
        db.createObjectStore(STORES.PROFILE, { keyPath: 'userId' });
      }

      // 待重试请求队列
      if (!db.objectStoreNames.contains(STORES.PENDING_REQUESTS)) {
        const requestStore = db.createObjectStore(STORES.PENDING_REQUESTS, { keyPath: 'id' });
        requestStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // 通用缓存表
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: 'key' });
        cacheStore.createIndex('expiry', 'expiry', { unique: false });
      }
    };
  });
}

/**
 * 获取 ObjectStore
 */
function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
  if (!dbInstance) throw new Error('Database not initialized');
  const transaction = dbInstance.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

/**
 * 通用的增删改查操作
 */
export const db = {
  /**
   * 添加或更新数据
   */
  async put<T>(storeName: string, data: T): Promise<void> {
    const store = getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 批量添加或更新
   */
  async putMany<T>(storeName: string, dataArray: T[]): Promise<void> {
    const store = getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      let completed = 0;
      let hasError = false;

      dataArray.forEach(data => {
        const request = store.put(data);
        request.onsuccess = () => {
          completed++;
          if (completed === dataArray.length && !hasError) {
            resolve();
          }
        };
        request.onerror = () => {
          hasError = true;
          reject(request.error);
        };
      });
    });
  },

  /**
   * 获取单条数据
   */
  async get<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    const store = getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 获取所有数据
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    const store = getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 通过索引查询
   */
  async getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
    const store = getStore(storeName);
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 删除数据
   */
  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    const store = getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 清空整个 store
   */
  async clear(storeName: string): Promise<void> {
    const store = getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * 统计记录数
   */
  async count(storeName: string): Promise<number> {
    const store = getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
};

/**
 * 缓存相关操作
 */
export const cache = {
  /**
   * 设置缓存（带过期时间，单位：秒）
   */
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    const expiry = Date.now() + ttl * 1000;
    await db.put(STORES.CACHE, { key, value, expiry });
  },

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    const item = await db.get<{ key: string; value: T; expiry: number }>(STORES.CACHE, key);
    if (!item) return null;
    
    // 检查是否过期
    if (item.expiry < Date.now()) {
      await db.delete(STORES.CACHE, key);
      return null;
    }
    
    return item.value;
  },

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    await db.delete(STORES.CACHE, key);
  },

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<void> {
    const store = getStore(STORES.CACHE, 'readwrite');
    const index = store.index('expiry');
    const range = IDBKeyRange.upperBound(Date.now());
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  },
};

/**
 * 初始化并启动定期清理任务
 */
export async function setupIndexedDB(): Promise<void> {
  await initDB();
  
  // 每小时清理一次过期缓存
  setInterval(() => {
    cache.cleanup().catch(err => console.error('Failed to cleanup cache:', err));
  }, 60 * 60 * 1000);
}
