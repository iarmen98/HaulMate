const DATABASE_NAME = 'haulmate';
const STORE_NAME = 'handles';
const FOLDER_KEY = 'game-folder';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  } finally {
    database.close();
  }
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(handle, FOLDER_KEY));
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await runTransaction<unknown>('readonly', (store) => store.get(FOLDER_KEY));
    return handle instanceof FileSystemDirectoryHandle ? handle : null;
  } catch {
    return null;
  }
}

export async function forgetFolderHandle(): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(FOLDER_KEY));
}
