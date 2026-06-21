/**
 * IndexedDB 数据访问层。
 * 页面只调用这里导出的函数，不直接接触数据库事件和事务细节。
 */
import type { HistoryRecord, NewHistoryRecord } from "../types/history";

const DATABASE_NAME = "ai-code-playground";
const DATABASE_VERSION = 1;
const STORE_NAME = "run-history";
const MAX_RECORDS = 100;

// IndexedDB 是浏览器内置的异步数据库，比 localStorage 更适合保存较长的源码和 AI 结果。
export async function getHistoryRecords(): Promise<HistoryRecord[]> {
  const database = await openDatabase();
  // readonly 事务只读取数据，不会锁住写入操作。
  const records = await runRequest<HistoryRecord[]>(database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll());
  database.close();
  return records.sort((left, right) => right.createdAt - left.createdAt);
}

export async function saveHistoryRecord(record: NewHistoryRecord): Promise<HistoryRecord> {
  // 调用者不需要生成 id、时间和收藏状态，存储层在写入前统一补齐。
  const nextRecord: HistoryRecord = {
    ...record,
    id: createRecordId(),
    createdAt: Date.now(),
    favorite: false,
  };
  const database = await openDatabase();
  await runRequest(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(nextRecord));
  database.close();
  await trimOldRecords();
  return nextRecord;
}

export async function setHistoryFavorite(id: string, favorite: boolean) {
  // IndexedDB 没有局部更新语法，需要先读取完整对象，再 put 覆盖。
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const record = await runRequest<HistoryRecord | undefined>(store.get(id));
  if (record) await runRequest(store.put({ ...record, favorite }));
  database.close();
}

export async function deleteHistoryRecord(id: string) {
  // delete 使用主键 id 精确删除一条记录。
  const database = await openDatabase();
  await runRequest(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id));
  database.close();
}

export async function clearHistoryRecords() {
  // clear 会清空整个 object store，调用前由 UI 负责二次确认。
  const database = await openDatabase();
  await runRequest(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear());
  database.close();
}

function openDatabase() {
  // 打开数据库本身也是异步操作，所以返回 Promise<IDBDatabase>。
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("无法打开历史记录数据库。"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      // 首次打开或数据库版本升级时创建 object store，作用类似创建一张表。
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
  });
}

function runRequest<T = IDBValidKey>(request: IDBRequest<T>) {
  // IndexedDB 原生使用事件回调，这里包装成 Promise，方便配合 async/await。
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("历史记录操作失败。"));
  });
}

async function trimOldRecords() {
  // 限制记录数量，避免长期使用后浏览器存储无限增长。
  const records = await getHistoryRecords();
  if (records.length <= MAX_RECORDS) return;
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  // records 已按新到旧排序，slice 后得到需要淘汰的旧记录。
  records.slice(MAX_RECORDS).forEach((record) => store.delete(record.id));
  await transactionDone(transaction);
  database.close();
}

function transactionDone(transaction: IDBTransaction) {
  // 单个 request 成功不代表整笔事务已提交，这里等待 transaction.oncomplete。
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("清理旧历史记录失败。"));
    transaction.onabort = () => reject(transaction.error ?? new Error("清理旧历史记录已中止。"));
  });
}

function createRecordId() {
  // 新浏览器优先使用标准 UUID；后面的写法为旧环境提供兼容方案。
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
