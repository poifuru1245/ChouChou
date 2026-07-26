import { db } from "../firebase/firebaseClient.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { normalizeServiceError } from "../../services/errors.js";
import { runServiceOperation } from "../../services/serviceRuntime.js";

const DEFAULT_CACHE_MS = 15000;
const collectionCache = new Map();
const documentCache = new Map();
const sharedSubscriptions = new Map();

export async function getCollection(name, options = {}) {
  return execute("list", name, async () => {
    const maxAge = options.maxAge ?? DEFAULT_CACHE_MS;
    const cached = collectionCache.get(name);
    if (!options.force && cached && Date.now() - cached.time < maxAge) return cloneRows(cached.data);
    const snapshot = await getDocs(collection(db, name));
    const rows = snapshot.docs.map(toRow);
    collectionCache.set(name, { time: Date.now(), data: rows });
    return cloneRows(rows);
  });
}

export async function getDocument(collectionName, documentId, options = {}) {
  return execute("get", `${collectionName}/${documentId}`, async () => {
    const key = `${collectionName}/${documentId}`;
    const maxAge = options.maxAge ?? DEFAULT_CACHE_MS;
    const cached = documentCache.get(key);
    if (!options.force && cached && Date.now() - cached.time < maxAge) return cached.data ? { ...cached.data } : null;
    const snapshot = await getDoc(doc(db, collectionName, documentId));
    const data = snapshot.exists() ? toRow(snapshot) : null;
    documentCache.set(key, { time: Date.now(), data });
    return data ? { ...data } : null;
  });
}

export function subscribeCollection(name, onData, onError = console.error) {
  return subscribeShared(`collection:${name}`, () => onSnapshot(collection(db, name), (snapshot) => {
    const rows = snapshot.docs.map(toRow);
    collectionCache.set(name, { time: Date.now(), data: rows });
    publish(`collection:${name}`, rows);
  }, (error) => publishError(`collection:${name}`, normalizeServiceError(error, { resource:name, operation:"listen" }))), onData, onError);
}

export function subscribeDocument(collectionName, documentId, onData, onError = console.error) {
  const path = `${collectionName}/${documentId}`;
  return subscribeShared(`document:${path}`, () => onSnapshot(doc(db, collectionName, documentId), (snapshot) => {
    const data = snapshot.exists() ? toRow(snapshot) : null;
    documentCache.set(path, { time: Date.now(), data });
    publish(`document:${path}`, data);
  }, (error) => publishError(`document:${path}`, normalizeServiceError(error, { resource:path, operation:"listenOne" }))), onData, onError);
}

export async function addDocument(collectionName, data) {
  return execute("create", collectionName, async () => {
    const result = await addDoc(collection(db, collectionName), data);
    invalidateCollection(collectionName);
    return result.id;
  });
}

export async function updateDocument(collectionName, documentId, data) {
  return execute("update", `${collectionName}/${documentId}`, async () => {
    await updateDoc(doc(db, collectionName, documentId), data);
    invalidateCollection(collectionName);
    documentCache.delete(`${collectionName}/${documentId}`);
  });
}

export async function setDocument(collectionName, documentId, data, options) {
  return execute("upsert", `${collectionName}/${documentId}`, async () => {
    await setDoc(doc(db, collectionName, documentId), data, options);
    invalidateCollection(collectionName);
    documentCache.delete(`${collectionName}/${documentId}`);
  });
}

export async function removeDocument(collectionName, documentId) {
  return execute("delete", `${collectionName}/${documentId}`, async () => {
    await deleteDoc(doc(db, collectionName, documentId));
    invalidateCollection(collectionName);
    documentCache.delete(`${collectionName}/${documentId}`);
  });
}

// 複数コレクションの一括更新はService層だけがこの低レベルAPIを利用する。
export async function commitDocumentBatch(operations = []) {
  return execute("batch", "multiple", async () => {
    const batch = writeBatch(db);
    operations.forEach((operation) => {
      const target = doc(db, operation.collection, operation.id);
      if (operation.type === "delete") batch.delete(target);
      else if (operation.type === "set") batch.set(target, operation.data, operation.options || {});
      else batch.update(target, operation.data);
    });
    await batch.commit();
    [...new Set(operations.map((operation) => operation.collection))].forEach(invalidateCollection);
  });
}

export function invalidateCollection(name) { collectionCache.delete(name); }
export function clearFirestoreCache() { collectionCache.clear(); documentCache.clear(); }
export { increment, serverTimestamp };

function subscribeShared(key, start, onData, onError) {
  let entry = sharedSubscriptions.get(key);
  if (!entry) {
    entry = { listeners: new Set(), errors: new Set(), unsubscribe: null, lastValue: undefined };
    sharedSubscriptions.set(key, entry);
    entry.unsubscribe = start();
  }
  entry.listeners.add(onData);
  entry.errors.add(onError);
  if (entry.lastValue !== undefined) queueMicrotask(() => onData(copyValue(entry.lastValue)));
  return () => {
    entry.listeners.delete(onData);
    entry.errors.delete(onError);
    if (!entry.listeners.size) {
      entry.unsubscribe?.();
      sharedSubscriptions.delete(key);
    }
  };
}

function publish(key, value) {
  const entry = sharedSubscriptions.get(key);
  if (!entry) return;
  entry.lastValue = value;
  entry.listeners.forEach((listener) => listener(copyValue(value)));
}

function publishError(key, error) {
  const entry = sharedSubscriptions.get(key);
  if (!entry) return;
  entry.errors.forEach((listener) => listener(error));
}

function toRow(snapshot) { return { id: snapshot.id, ...snapshot.data() }; }
function cloneRows(rows) { return rows.map((row) => ({ ...row })); }
function copyValue(value) { return Array.isArray(value) ? cloneRows(value) : (value ? { ...value } : value); }
async function execute(operation, resource, action) { return runServiceOperation(operation, action, { resource }); }
