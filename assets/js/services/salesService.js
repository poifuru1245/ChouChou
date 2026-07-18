import {
  addDocument,
  removeDocument,
  serverTimestamp,
  subscribeCollection,
  updateDocument
} from "./firestoreService.js";

export const SALES_COLLECTION = "sales";
export const SALES_NUMBER_FIELDS = [
  "sales",
  "customerCount",
  "honmeiCount",
  "jounaiCount",
  "douhanCount",
  "extensionSales",
  "drinkSales",
  "bottleSales",
  "champagneSales",
  "otherSales"
];

export function subscribeSales(onData, onError) {
  return subscribeCollection(SALES_COLLECTION, (rows) => onData(rows.map(normalizeSalesRecord)), onError);
}

export function createSalesRecord(payload) {
  return addDocument(SALES_COLLECTION, {
    ...pickSalesFields(payload),
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });
}

export function updateSalesRecord(id, payload) {
  return updateDocument(SALES_COLLECTION, id, {
    ...pickSalesFields(payload),
    updatedAt:serverTimestamp()
  });
}

export function deleteSalesRecord(id) {
  return removeDocument(SALES_COLLECTION, id);
}

export function findDuplicateSalesRecord(rows, payload, excludedId = "") {
  return rows.find((row) => row.id !== excludedId && row.date === payload.date && row.castId === payload.castId) || null;
}

export function normalizeSalesRecord(row) {
  // Phase1以前の短いフィールド名も読み込み、既存データを壊さず移行できるようにする。
  const normalized = {
    ...row,
    date:String(row.date || "").slice(0, 10),
    castId:String(row.castId || ""),
    castName:String(row.castName || ""),
    attendance:row.attendance !== false,
    sales:toInteger(row.sales),
    customerCount:toInteger(row.customerCount),
    honmeiCount:toInteger(row.honmeiCount ?? row.honmei),
    jounaiCount:toInteger(row.jounaiCount ?? row.jounai),
    douhanCount:toInteger(row.douhanCount ?? row.douhan),
    extensionSales:toInteger(row.extensionSales ?? row.extension),
    drinkSales:toInteger(row.drinkSales ?? row.drink),
    bottleSales:toInteger(row.bottleSales ?? row.bottle),
    champagneSales:toInteger(row.champagneSales ?? row.champagne),
    otherSales:toInteger(row.otherSales),
    memo:String(row.memo || "")
  };
  return normalized;
}

function pickSalesFields(payload) {
  const record = {
    date:String(payload.date || "").slice(0, 10),
    castId:String(payload.castId || ""),
    castName:String(payload.castName || ""),
    attendance:payload.attendance !== false,
    memo:String(payload.memo || "").trim()
  };
  SALES_NUMBER_FIELDS.forEach((field) => { record[field] = toInteger(payload[field]); });
  return record;
}

function toInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}
