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
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DEFAULT_CACHE_MS = 15000;
const collectionCache = new Map();
const documentCache = new Map();
const sharedSubscriptions = new Map();

export async function getCollection(name, options = {}) {
  const maxAge = options.maxAge ?? DEFAULT_CACHE_MS;
  const cached = collectionCache.get(name);
  if (!options.force && cached && Date.now() - cached.time < maxAge) return cloneRows(cached.data);
  const snapshot = await getDocs(collection(db, name));
  const rows = snapshot.docs.map(toRow);
  collectionCache.set(name, { time: Date.now(), data: rows });
  return cloneRows(rows);
}

export async function getDocument(collectionName, documentId, options = {}) {
  const key = `${collectionName}/${documentId}`;
  const maxAge = options.maxAge ?? DEFAULT_CACHE_MS;
  const cached = documentCache.get(key);
  if (!options.force && cached && Date.now() - cached.time < maxAge) return cached.data ? { ...cached.data } : null;
  const snapshot = await getDoc(doc(db, collectionName, documentId));
  const data = snapshot.exists() ? toRow(snapshot) : null;
  documentCache.set(key, { time: Date.now(), data });
  return data ? { ...data } : null;
}

export function subscribeCollection(name, onData, onError = console.error) {
  return subscribeShared(`collection:${name}`, () => onSnapshot(collection(db, name), (snapshot) => {
    const rows = snapshot.docs.map(toRow);
    collectionCache.set(name, { time: Date.now(), data: rows });
    publish(`collection:${name}`, rows);
  }, (error) => publishError(`collection:${name}`, error)), onData, onError);
}

export function subscribeDocument(collectionName, documentId, onData, onError = console.error) {
  const path = `${collectionName}/${documentId}`;
  return subscribeShared(`document:${path}`, () => onSnapshot(doc(db, collectionName, documentId), (snapshot) => {
    const data = snapshot.exists() ? toRow(snapshot) : null;
    documentCache.set(path, { time: Date.now(), data });
    publish(`document:${path}`, data);
  }, (error) => publishError(`document:${path}`, error)), onData, onError);
}

export async function addDocument(collectionName, data) {
  const result = await addDoc(collection(db, collectionName), data);
  invalidateCollection(collectionName);
  return result.id;
}

export async function updateDocument(collectionName, documentId, data) {
  await updateDoc(doc(db, collectionName, documentId), data);
  invalidateCollection(collectionName);
  documentCache.delete(`${collectionName}/${documentId}`);
}

export async function setDocument(collectionName, documentId, data, options) {
  await setDoc(doc(db, collectionName, documentId), data, options);
  invalidateCollection(collectionName);
  documentCache.delete(`${collectionName}/${documentId}`);
}

export async function removeDocument(collectionName, documentId) {
  await deleteDoc(doc(db, collectionName, documentId));
  invalidateCollection(collectionName);
  documentCache.delete(`${collectionName}/${documentId}`);
}

export function invalidateCollection(name) { collectionCache.delete(name); }
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
