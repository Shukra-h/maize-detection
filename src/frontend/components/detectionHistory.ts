export interface PredictionGuidance {
  title: string;
  description: string;
  treatment: string;
  prevention: string;
}

export interface DetectionHistoryRecord {
  id: string;
  createdAt: string;
  filename: string;
  imageBlob: Blob;
  prediction: string;
  confidence: number;
  all_probabilities: Record<string, number>;
  guidance?: PredictionGuidance;
}

const DB_NAME = "maize-detection-db";
const DB_VERSION = 1;
const STORE_NAME = "detection-history";

function ensureIndexedDb(): IDBFactory {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("IndexedDB is not available in this browser.");
  }

  return window.indexedDB;
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

async function openDetectionHistoryDb(): Promise<IDBDatabase> {
  const indexedDb = ensureIndexedDb();

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

export async function getDetectionHistory(): Promise<DetectionHistoryRecord[]> {
  const database = await openDetectionHistoryDb();

  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const records = await waitForRequest(store.getAll());
    await waitForTransaction(transaction);

    return [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally {
    database.close();
  }
}

export async function saveDetectionHistoryItem(item: DetectionHistoryRecord): Promise<void> {
  const database = await openDetectionHistoryDb();

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put(item);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function deleteDetectionHistoryItem(id: string): Promise<void> {
  const database = await openDetectionHistoryDb();

  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}

export async function pruneDetectionHistory(limit: number): Promise<void> {
  const database = await openDetectionHistoryDb();

  try {
    const records = await getDetectionHistory();
    const staleRecords = records.slice(limit);

    if (!staleRecords.length) {
      return;
    }

    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    staleRecords.forEach((record) => {
      store.delete(record.id);
    });

    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}
