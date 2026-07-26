import { serverTimestamp, updateDocument } from "../js/services/firestoreService.js";
import { createDataService } from "./dataService.js";

export const TABLE_TYPES = Object.freeze(["ボックス", "VIP", "カウンター"]);
export const TABLE_STATUSES = Object.freeze(["空席", "使用中", "清掃中", "予約済"]);

export const tableDataService = createDataService({
  collectionName:"tables",
  normalize:normalizeTable,
  prepare:prepareTable,
  validate:validateTable,
  searchableFields:["name", "type", "status", "customerName"],
  defaultSort:(a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "ja")
});

export function subscribeTables(onData, onError) { return tableDataService.listen(onData, onError); }
export function subscribeTable(id, onData, onError) { return tableDataService.listenOne(id, onData, onError); }
export function listTables(options = {}) { return tableDataService.list(options); }
export function getTable(id, options = {}) { return tableDataService.get(id, options); }
export function createTable(input) { return tableDataService.create(input, { idField:"tableId" }); }
export function updateTable(id, input) { return tableDataService.update(id, input, { idField:"tableId" }); }
export function deleteTable(id) { return tableDataService.remove(id); }

export function setTableStatus(id, status) {
  return updateDocument("tables", id, {
    tableId:id,
    status:normalizeTableStatus(status),
    updatedAt:serverTimestamp()
  });
}

export function normalizeTable(row = {}) {
  return {
    ...row,
    id:String(row.id || row.tableId || ""),
    tableId:String(row.tableId || row.id || ""),
    name:cleanText(row.name, 80),
    type:normalizeTableType(row.type),
    capacity:positiveInteger(row.capacity, 1, 99, 1),
    status:normalizeTableStatus(row.status),
    displayOrder:nonNegativeInteger(row.displayOrder),
    currentVisitId:cleanText(row.currentVisitId, 100),
    currentReservationId:cleanText(row.currentReservationId, 100),
    customerName:cleanText(row.customerName, 100),
    memo:cleanText(row.memo, 500)
  };
}

export function prepareTable(input = {}) {
  const table = normalizeTable(input);
  return {
    name:table.name,
    type:table.type,
    capacity:table.capacity,
    status:table.status,
    displayOrder:table.displayOrder,
    currentVisitId:table.currentVisitId,
    currentReservationId:table.currentReservationId,
    customerName:table.customerName,
    memo:table.memo
  };
}

export function validateTable(input = {}) {
  const table = normalizeTable(input);
  const errors = [];
  if (!table.name) errors.push("席名を入力してください。");
  if (input.type && !TABLE_TYPES.includes(String(input.type))) errors.push("席タイプが正しくありません。");
  if (input.status && !TABLE_STATUSES.includes(String(input.status))) errors.push("席状態が正しくありません。");
  if (!Number.isInteger(Number(input.capacity)) || Number(input.capacity) < 1 || Number(input.capacity) > 99) errors.push("定員は1〜99名で入力してください。");
  return errors;
}

export function normalizeTableType(value) { const type = String(value || "ボックス").trim(); return TABLE_TYPES.includes(type) ? type : "ボックス"; }
export function normalizeTableStatus(value) { const status = String(value || "空席").trim(); return TABLE_STATUSES.includes(status) ? status : "空席"; }
function cleanText(value, max) { return String(value || "").trim().slice(0, max); }
function nonNegativeInteger(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0; }
function positiveInteger(value, min, max, fallback) { const number = Number(value); return Number.isInteger(number) && number >= min && number <= max ? number : fallback; }
