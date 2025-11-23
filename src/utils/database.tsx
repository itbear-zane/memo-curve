// --- 1. IndexedDB Utility Layer (No external deps) ---

const DB_NAME = 'MemoCurveDB';
const DB_VERSION = 1;
const STORE_NOTES = 'notes';
const STORE_CATS = 'categories';
const STORE_SETTINGS = 'settings';

// Export constants for use in other files
export { STORE_NOTES, STORE_CATS, STORE_SETTINGS };

// 使用标准方法定义以避免TSX泛型解析错误
const dbHelper = {
    db: null as IDBDatabase | null,

    init() {
        return new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NOTES)) db.createObjectStore(STORE_NOTES, { keyPath: 'id' });
                if (!db.objectStoreNames.contains(STORE_CATS)) db.createObjectStore(STORE_CATS, { keyPath: 'id' });
                // Settings is a singleton object, we'll use a fixed key 'appSettings' or just store/put
                if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS);
            };
            request.onsuccess = (event: Event) => {
                dbHelper.db = (event.target as IDBOpenDBRequest).result;
                // Try to ask for persistent storage
                if (navigator.storage && navigator.storage.persist) {
                    navigator.storage.persist().then(granted => {
                        console.log(granted ? "Storage will not be cleared except by explicit user action" : "Storage may be cleared by the UA under storage pressure.");
                    });
                }
                resolve();
            };
            request.onerror = (e) => reject(e);
        });
    },

    async getAll<T>(storeName: string): Promise<T[]> {
        return new Promise((resolve, reject) => {
            if (!dbHelper.db) return reject('DB not init');
            const transaction = dbHelper.db.transaction([storeName], 'readonly');
            const request = transaction.objectStore(storeName).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async get<T>(storeName: string, key: string): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
            if (!dbHelper.db) return reject('DB not init');
            const transaction = dbHelper.db.transaction([storeName], 'readonly');
            const request = transaction.objectStore(storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async put(storeName: string, data: unknown, key?: string) {
        return new Promise<void>((resolve, reject) => {
            if (!dbHelper.db) return reject('DB not init');
            const transaction = dbHelper.db.transaction([storeName], 'readwrite');
            const request = key ? transaction.objectStore(storeName).put(data, key) : transaction.objectStore(storeName).put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async delete(storeName: string, key: string) {
        return new Promise<void>((resolve, reject) => {
            if (!dbHelper.db) return reject('DB not init');
            const transaction = dbHelper.db.transaction([storeName], 'readwrite');
            const request = transaction.objectStore(storeName).delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async clearStore(storeName: string) {
        return new Promise<void>((resolve, reject) => {
            if (!dbHelper.db) return reject('DB not init');
            const transaction = dbHelper.db.transaction([storeName], 'readwrite');
            const request = transaction.objectStore(storeName).clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};


export default dbHelper;