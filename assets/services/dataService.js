import {
  addDocument,
  getCollection,
  getDocument,
  removeDocument,
  serverTimestamp,
  setDocument,
  subscribeCollection,
  subscribeDocument,
  updateDocument
} from "../js/services/firestoreService.js";
import { compactFirestoreData, toPlainFirestoreData } from "../utils/firestoreData.js";
import { ServiceError, ValidationError, normalizeServiceError } from "./errors.js";

/**
 * @typedef {object} PageResult
 * @property {object[]} items
 * @property {number} total
 * @property {number} page
 * @property {number} pageSize
 * @property {number} pageCount
 * @property {boolean} hasPrevious
 * @property {boolean} hasNext
 */

/** @typedef {() => void} Unsubscribe */

/** @deprecated 新規コードはServiceErrorと派生型を利用する。 */
export class DataServiceError extends ServiceError {
  constructor(message, options = {}) {
    super(message, { cause:options.cause });
    this.name = "DataServiceError";
    this.code = options.code || "data/unknown";
    this.collection = options.collection || "";
    this.operation = options.operation || "";
    this.details = options.details || null;
  }
}

/**
 * 全コレクション共通のCRUD、検索、ソート、ページング、購読、例外変換を提供する。
 * @param {{collectionName:string, normalize?:Function, prepare?:Function, validate?:Function, searchableFields?:string[], defaultSort?:object|Function}} config
 * @returns {Readonly<object>} PromiseベースのデータService
 */
export function createDataService(config) {
  const collectionName = String(config.collectionName || "");
  if (!collectionName) throw new Error("collectionName is required");
  const normalize = config.normalize || ((row) => row);
  const prepare = config.prepare || ((row) => row);
  const validate = config.validate || (() => []);
  const searchableFields = config.searchableFields || [];
  const defaultSort = config.defaultSort || null;

  const normalizeRow = (row) => normalize(toPlainFirestoreData(row || {}));
  const normalizeRows = (rows) => rows.map(normalizeRow);

  async function list(options = {}) {
    return execute("list", async () => applyListOptions(normalizeRows(await getCollection(collectionName, options)), options, searchableFields, defaultSort));
  }

  async function get(id, options = {}) {
    return execute("get", async () => { const row = await getDocument(collectionName, requireId(id), options); return row ? normalizeRow(row) : null; });
  }

  async function page(options = {}) {
    return execute("page", async () => {
      const rows = normalizeRows(await getCollection(collectionName, options));
      const filtered = applyListOptions(rows, { ...options, page:1, pageSize:0 }, searchableFields, defaultSort);
      return createPage(filtered, options.page, options.pageSize || 20);
    });
  }

  async function create(input, options = {}) {
    return execute("create", async () => {
      assertValid(input, validate, collectionName);
      const payload = compactFirestoreData({ ...prepare(input), createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      const id = await addDocument(collectionName, payload);
      if (options.idField) await updateDocument(collectionName, id, { [options.idField]:id });
      return id;
    });
  }

  async function update(id, input, options = {}) {
    return execute("update", async () => {
      assertValid(input, validate, collectionName, options);
      await updateDocument(collectionName, requireId(id), compactFirestoreData({ ...prepare(input), ...(options.idField ? { [options.idField]:id } : {}), updatedAt:serverTimestamp() }));
      return id;
    });
  }

  async function upsert(id, input, options = {}) {
    return execute("upsert", async () => {
      assertValid(input, validate, collectionName, options);
      await setDocument(collectionName, requireId(id), compactFirestoreData({ ...prepare(input), ...(options.idField ? { [options.idField]:id } : {}), updatedAt:serverTimestamp() }), { merge:true });
      return id;
    });
  }

  async function remove(id) { return execute("remove", () => removeDocument(collectionName, requireId(id))); }

  function listen(onData, onError = console.error, options = {}) {
    return subscribeCollection(collectionName, (rows) => onData(applyListOptions(normalizeRows(rows), options, searchableFields, defaultSort)), (error) => onError(toServiceError(error, collectionName, "listen")));
  }

  function listenOne(id, onData, onError = console.error) {
    return subscribeDocument(collectionName, requireId(id), (row) => onData(row ? normalizeRow(row) : null), (error) => onError(toServiceError(error, collectionName, "listenOne")));
  }

  async function execute(operation, action) {
    try { return await action(); }
    catch (error) { throw normalizeServiceError(error, { resource:collectionName, operation }); }
  }

  return Object.freeze({ collectionName, list, page, get, create, update, upsert, remove, listen, listenOne, normalize:normalizeRow, query:(rows, options) => applyListOptions(normalizeRows(rows), options, searchableFields, defaultSort) });
}

export function applyListOptions(rows = [], options = {}, searchableFields = [], defaultSort = null) {
  let output = [...rows];
  if (typeof options.filter === "function") output = output.filter(options.filter);
  if (options.search) output = searchRows(output, options.search, options.searchFields || searchableFields);
  const sort = options.sort || defaultSort;
  if (sort) output.sort(typeof sort === "function" ? sort : createComparator(sort));
  return paginateRows(output, options.page, options.pageSize);
}

export function searchRows(rows, term, fields = []) {
  const query = normalizeSearch(term);
  if (!query) return [...rows];
  return rows.filter((row) => (fields.length ? fields.map((field) => valueAt(row, field)) : Object.values(row)).some((value) => normalizeSearch(value).includes(query)));
}

export function paginateRows(rows, page = 1, pageSize = 0) {
  const size = Math.max(0, Number(pageSize) || 0);
  if (!size) return [...rows];
  const current = Math.max(1, Number(page) || 1);
  return rows.slice((current - 1) * size, current * size);
}

export function createPage(rows = [], page = 1, pageSize = 20) {
  const size = Math.max(1, Number(pageSize) || 20);
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(pageCount, Math.max(1, Number(page) || 1));
  return {
    items:paginateRows(rows, current, size),
    total:rows.length,
    page:current,
    pageSize:size,
    pageCount,
    hasPrevious:current > 1,
    hasNext:current < pageCount
  };
}

export function createComparator(sort = {}) {
  const field = sort.field || "updatedAt";
  const direction = sort.direction === "asc" ? 1 : -1;
  return (a, b) => compareValues(valueAt(a, field), valueAt(b, field)) * direction;
}

export function assertValid(input, validator, collectionName = "", options = {}) {
  const result = validator(input, options);
  const errors = Array.isArray(result) ? result.filter(Boolean) : (result ? [result] : []);
  if (errors.length) throw new ValidationError(errors[0], { code:"data/validation", resource:collectionName, operation:"validate", details:errors });
}

export function toServiceError(error, collection, operation) {
  return normalizeServiceError(error, { resource:collection, operation });
}

function requireId(value) { const id = String(value || "").trim(); if (!id) throw new DataServiceError("IDが指定されていません。", { code:"data/id-required" }); return id; }
function normalizeSearch(value) { return String(value ?? "").trim().replace(/[\s　]+/g, "").toLowerCase(); }
function valueAt(row, path) { return String(path || "").split(".").reduce((value, key) => value?.[key], row); }
function compareValues(a, b) { if (a instanceof Date || b instanceof Date) return (a instanceof Date ? a.getTime() : 0) - (b instanceof Date ? b.getTime() : 0); if (typeof a === "number" && typeof b === "number") return a - b; return String(a ?? "").localeCompare(String(b ?? ""), "ja", { numeric:true }); }
