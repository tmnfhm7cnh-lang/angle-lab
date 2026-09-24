/**
 * IndexedDB persistence — LOTE 3 §3.
 *
 * Deliberately a single-active-project model, not a multi-project library:
 * that matches how the app is actually used today (one photo set worked on
 * at a time, same shape as dryland-test-logger's single active dataset) and
 * keeps the quota story simple enough to reason about — see clearAll below.
 * A project browser is a LOTE 5 product concern, not a LOTE 3 one.
 *
 * Two stores:
 * - `project`  — the one serialized AnalysisProject, under the fixed key
 *   'active'. Never the source of truth on its own: it is a resume point,
 *   the same relationship dryland-test-logger has with its exported .csv.
 * - `blobs`    — original photo Blobs, keyed by `imageId` (a model-generated
 *   UUID). NOT by filename: two photos can share a filename, and a filename
 *   is itself a personal-data channel nobody decided to open (LOTE 3 audit).
 *
 * Every export here tolerates IndexedDB being unavailable or throwing
 * (private browsing, a blocked/evicted origin, an aborted transaction) by
 * resolving to null / false rather than throwing into caller code that has
 * no recovery path anyway — losing the save silently is the same failure
 * mode dryland-test-logger already accepts for its own localStorage writes.
 */

const DB_NAME = 'angle-lab-db';
const DB_VERSION = 1;
const PROJECT_STORE = 'project';
const BLOB_STORE = 'blobs';
const ACTIVE_KEY = 'active';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) db.createObjectStore(PROJECT_STORE);
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE, { keyPath: 'imageId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function runRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, fn) {
  try {
    const db = await openDb();
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = await fn(store);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
    });
    return result;
  } catch (error) {
    return { failed: true, error };
  }
}

// serializedProject is plain JSON (model.js's serialize output) — never the
// live project object, so a save can never race a caller still mutating it.
export async function saveActiveProject(serializedProject) {
  const result = await withStore(PROJECT_STORE, 'readwrite', (store) =>
    runRequest(store.put(serializedProject, ACTIVE_KEY))
  );
  return !(result && result.failed);
}

export async function loadActiveProject() {
  const result = await withStore(PROJECT_STORE, 'readonly', (store) => runRequest(store.get(ACTIVE_KEY)));
  if (result && result.failed) return null;
  return result ?? null;
}

export async function saveBlob(imageId, blob) {
  const result = await withStore(BLOB_STORE, 'readwrite', (store) => runRequest(store.put({ imageId, blob })));
  return !(result && result.failed);
}

export async function loadBlob(imageId) {
  const result = await withStore(BLOB_STORE, 'readonly', (store) => runRequest(store.get(imageId)));
  if (result && result.failed) return null;
  return result ? result.blob : null;
}

// The one release valve for storage pressure in this lote: a full reset,
// same posture as dryland-test-logger's "Borrar todo". No automatic
// eviction logic — guessing which project to drop without asking is not
// something to do with athlete photos, so a person decides, explicitly.
export async function clearAll() {
  const projectResult = await withStore(PROJECT_STORE, 'readwrite', (store) => runRequest(store.clear()));
  const blobResult = await withStore(BLOB_STORE, 'readwrite', (store) => runRequest(store.clear()));
  return !(projectResult?.failed || blobResult?.failed);
}

// Best-effort: Safari's Intelligent Tracking Prevention can evict IndexedDB
// after 7 days with no user interaction, and any browser can evict under
// storage pressure. persist() asks not to be picked for that — it is not
// guaranteed (Safari in particular grants it rarely, if ever), so this is a
// courtesy call, not something callers should branch on.
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

// Usage/quota as a fraction, for a warning banner — not for automatic
// action. 0.8 is this session's own threshold, not a spec'd browser
// constant: iOS quota is a moving share of free disk, so "80% of whatever
// that is right now" is a judgement call, flagged as such like the other
// engineering-judgement constants in this codebase (model.js,
// uncertainty.js).
export const STORAGE_WARNING_RATIO = 0.8;

export async function estimateStorageRatio() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (!quota) return null;
    return usage / quota;
  } catch {
    return null;
  }
}
