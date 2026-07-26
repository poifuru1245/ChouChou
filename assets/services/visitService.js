import { db } from "../js/firebase/firebaseClient.js";
import { createDataService } from "./dataService.js";
import { runServiceOperation } from "./serviceRuntime.js";
import {
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const VISIT_STATUSES = Object.freeze(["予約", "受付", "着席", "延長", "会計", "完了", "キャンセル", "無断キャンセル"]);
export const CAST_RELATION_TYPES = Object.freeze(["本指名", "場内", "ヘルプ", "同伴", "アフター"]);

export const visitDataService = createDataService({
  collectionName:"visits",
  normalize:normalizeVisit,
  prepare:prepareVisit,
  validate:validateVisit,
  searchableFields:["customerName", "tableName", "status", "memo", "assignedCastName"],
  defaultSort:(a, b) => `${b.visitDate}T${b.visitTime}`.localeCompare(`${a.visitDate}T${a.visitTime}`)
});

export function subscribeVisits(onData, onError) { return visitDataService.listen(onData, onError); }
export function subscribeVisit(id, onData, onError) { return visitDataService.listenOne(id, onData, onError); }
export function listVisits(options = {}) { return visitDataService.list(options); }
export function getVisit(id, options = {}) { return visitDataService.get(id, options); }
export function visitsForCustomer(visits = [], customerId = "") { return visits.filter((item) => item.customerId === customerId).sort((a, b) => `${b.visitDate}T${b.visitTime}`.localeCompare(`${a.visitDate}T${a.visitTime}`)); }

// 予約・来店履歴・席・顧客集計を1トランザクションで更新し、業務状態の食い違いを防止する。
export async function transitionReservation(reservationId, nextStatus, context = {}) {
  const status = normalizeVisitStatus(nextStatus);
  return runServiceOperation("transitionVisit", () => runTransaction(db, async (transaction) => {
    const reservationRef = doc(db, "reservations", reservationId);
    const reservationSnapshot = await transaction.get(reservationRef);
    if (!reservationSnapshot.exists()) throw new Error("reservation-not-found");
    const reservation = reservationSnapshot.data();
    const visitId = String(reservation.visitId || reservationId);
    const visitRef = doc(db, "visits", visitId);
    const visitSnapshot = await transaction.get(visitRef);
    const currentVisit = visitSnapshot.exists() ? visitSnapshot.data() : {};
    const previousTableId = String(currentVisit.tableId || reservation.tableId || "");
    const nextTableId = String(context.tableId ?? reservation.tableId ?? "");
    const refs = {};
    if (previousTableId) refs.previous = doc(db, "tables", previousTableId);
    if (nextTableId) refs.next = doc(db, "tables", nextTableId);
    const previousTable = refs.previous ? await transaction.get(refs.previous) : null;
    const nextTable = refs.next && nextTableId !== previousTableId ? await transaction.get(refs.next) : previousTable;
    if (refs.next && !nextTable?.exists()) throw new Error("table-not-found");
    if (nextTable && nextTableId !== previousTableId && ["使用中", "予約済"].includes(nextTable.data().status) && String(nextTable.data().currentVisitId || "") !== visitId) throw new Error("table-conflict");

    const customerId = cleanText(reservation.customerId, 100);
    const shouldCountVisit = status === "完了" && customerId && !reservation.visitCounted;
    const customerRef = shouldCountVisit ? doc(db, "customers", customerId) : null;
    const customerSnapshot = customerRef ? await transaction.get(customerRef) : null;

    const now = new Date().toISOString();
    const timeline = Array.isArray(currentVisit.timeline) ? [...currentVisit.timeline] : [];
    if (!timeline.length || timeline.at(-1)?.status !== status || context.forceEvent === true) {
      timeline.push({ status, at:now, note:cleanText(context.eventNote, 300) });
    }
    const castAssignments = normalizeCastAssignments(context.castAssignments ?? currentVisit.castAssignments ?? reservation.castAssignments);
    const visitDate = cleanDate(reservation.visitDate || reservation.date) || tokyoDateKey();
    const visitTime = cleanTime(reservation.visitTime || reservation.time);
    const tableName = cleanText(context.tableName ?? nextTable?.data()?.name ?? currentVisit.tableName ?? reservation.tableName, 80);
    const common = {
      visitId,
      reservationId,
      customerId,
      customerName:cleanText(reservation.customerName || reservation.name, 100),
      visitDate,
      visitTime,
      peopleCount:positiveInteger(reservation.peopleCount ?? reservation.people, 1),
      status,
      tableId:nextTableId,
      tableName,
      tableType:cleanText(context.tableType ?? reservation.tableType ?? nextTable?.data()?.type, 30),
      nominationCastId:cleanText(reservation.nominationCastId, 100),
      nominationCastName:cleanText(reservation.nominationCastName || reservation.cast1, 100),
      assignedCastId:cleanText(context.assignedCastId ?? reservation.assignedCastId, 100),
      assignedCastName:cleanText(context.assignedCastName ?? reservation.assignedCastName, 100),
      castAssignments,
      saleId:cleanText(context.saleId ?? currentVisit.saleId ?? reservation.saleId, 100),
      extensionCount:Number(currentVisit.extensionCount || 0) + (status === "延長" && currentVisit.status !== "延長" ? 1 : 0),
      memo:cleanText(context.memo ?? currentVisit.memo ?? reservation.memo, 2000),
      timeline,
      updatedAt:serverTimestamp()
    };
    if (visitSnapshot.exists()) transaction.update(visitRef, common);
    else transaction.set(visitRef, { ...common, createdAt:serverTimestamp() });

    transaction.update(reservationRef, {
      status,
      visitId,
      tableId:nextTableId,
      tableName,
      tableType:common.tableType,
      assignedCastId:common.assignedCastId,
      assignedCastName:common.assignedCastName,
      castAssignments,
      saleId:common.saleId,
      updatedAt:serverTimestamp(),
      ...(status === "完了" && !reservation.visitCounted ? { visitCounted:true, visitCountedAt:serverTimestamp() } : {})
    });

    if (refs.previous && previousTableId !== nextTableId && previousTable?.exists()) transaction.update(refs.previous, emptyTablePatch());
    if (refs.next) {
      const tableStatus = tableStatusForVisit(status);
      transaction.update(refs.next, tableStatus === "空席" || tableStatus === "清掃中" ? {
        ...emptyTablePatch(tableStatus),
        updatedAt:serverTimestamp()
      } : {
        status:tableStatus,
        currentVisitId:visitId,
        currentReservationId:reservationId,
        customerName:common.customerName,
        updatedAt:serverTimestamp()
      });
    }

    if (shouldCountVisit && customerSnapshot?.exists()) {
        const customer = customerSnapshot.data();
        const count = Math.max(0, Number(customer.visitCount) || 0);
        transaction.update(customerRef, {
          visitCount:count + 1,
          firstVisit:customer.firstVisit && customer.firstVisit <= visitDate ? customer.firstVisit : visitDate,
          lastVisit:customer.lastVisit && customer.lastVisit >= visitDate ? customer.lastVisit : visitDate,
          assignedCastId:customer.assignedCastId || common.assignedCastId || common.nominationCastId,
          updatedAt:serverTimestamp()
        });
    }
    return { visitId, reservationId, status, tableId:nextTableId };
  }), { resource:`reservations/${reservationId}` });
}

export function moveVisitToTable(visit, table, note = "席移動") {
  const visitId = String(visit?.id || visit?.visitId || "");
  const reservationId = String(visit?.reservationId || "");
  if (!visitId || !reservationId) return Promise.reject(new Error("visit-id-required"));
  return transitionReservation(reservationId, visit.status, {
    tableId:String(table?.id || table?.tableId || ""),
    tableName:String(table?.name || ""),
    tableType:String(table?.type || ""),
    eventNote:note,
    forceEvent:true
  });
}

export async function deleteReservationFlow(reservationId) {
  return runServiceOperation("deleteReservationFlow", () => runTransaction(db, async (transaction) => {
    const reservationRef = doc(db, "reservations", reservationId);
    const reservationSnapshot = await transaction.get(reservationRef);
    if (!reservationSnapshot.exists()) return { deleted:false };
    const reservation = reservationSnapshot.data();
    const visitId = String(reservation.visitId || reservationId);
    const visitRef = doc(db, "visits", visitId);
    const visitSnapshot = await transaction.get(visitRef);
    const tableId = String(visitSnapshot.data()?.tableId || reservation.tableId || "");
    const tableRef = tableId ? doc(db, "tables", tableId) : null;
    const tableSnapshot = tableRef ? await transaction.get(tableRef) : null;
    if (tableRef && tableSnapshot?.exists() && String(tableSnapshot.data().currentReservationId || "") === reservationId) transaction.update(tableRef, emptyTablePatch());
    if (visitSnapshot.exists()) transaction.delete(visitRef);
    transaction.delete(reservationRef);
    return { deleted:true, visitId, tableId };
  }), { resource:`reservations/${reservationId}` });
}

export function normalizeVisit(row = {}) {
  return {
    ...row,
    id:String(row.id || row.visitId || ""),
    visitId:String(row.visitId || row.id || ""),
    reservationId:cleanText(row.reservationId, 100),
    customerId:cleanText(row.customerId, 100),
    customerName:cleanText(row.customerName, 100),
    visitDate:cleanDate(row.visitDate || row.date),
    visitTime:cleanTime(row.visitTime || row.time),
    peopleCount:positiveInteger(row.peopleCount, 1),
    status:normalizeVisitStatus(row.status),
    tableId:cleanText(row.tableId, 100),
    tableName:cleanText(row.tableName, 80),
    tableType:cleanText(row.tableType, 30),
    nominationCastId:cleanText(row.nominationCastId, 100),
    nominationCastName:cleanText(row.nominationCastName, 100),
    assignedCastId:cleanText(row.assignedCastId, 100),
    assignedCastName:cleanText(row.assignedCastName, 100),
    castAssignments:normalizeCastAssignments(row.castAssignments),
    saleId:cleanText(row.saleId, 100),
    extensionCount:Math.max(0, Math.trunc(Number(row.extensionCount) || 0)),
    memo:cleanText(row.memo, 2000),
    timeline:Array.isArray(row.timeline) ? row.timeline.slice(-100) : []
  };
}

export function prepareVisit(input = {}) { const visit = normalizeVisit(input); return { ...visit, id:undefined, visitId:undefined }; }
export function validateVisit(input = {}) { const visit = normalizeVisit(input); return [!visit.reservationId && "予約IDが必要です。", !visit.customerName && "お客様名が必要です。"].filter(Boolean); }
export function normalizeVisitStatus(value) {
  const aliases = { "確認済":"予約", "来店":"着席", "会計済":"会計", "予約中":"予約", "新規":"受付" };
  const status = aliases[String(value || "").trim()] || String(value || "受付").trim();
  return VISIT_STATUSES.includes(status) ? status : "受付";
}
export function normalizeCastAssignments(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Map();
  value.map((row) => ({ castId:cleanText(row.castId || row.id, 100), castName:cleanText(row.castName || row.name, 100), relation:CAST_RELATION_TYPES.includes(row.relation) ? row.relation : "ヘルプ" })).filter((row) => row.castId || row.castName).forEach((row) => unique.set(`${row.castId || row.castName}:${row.relation}`, row));
  return [...unique.values()].slice(0, 20);
}
function tableStatusForVisit(status) { if (["予約", "受付"].includes(status)) return "予約済"; if (["着席", "延長", "会計"].includes(status)) return "使用中"; if (status === "完了") return "清掃中"; return "空席"; }
function emptyTablePatch(status = "空席") { return { status, currentVisitId:"", currentReservationId:"", customerName:"", updatedAt:serverTimestamp() }; }
function cleanText(value, max) { return String(value || "").trim().slice(0, max); }
function cleanDate(value) { const text = String(value || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""; }
function cleanTime(value) { const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/); return match ? `${String(Number(match[1])).padStart(2, "0")}:${match[2]}` : ""; }
function positiveInteger(value, fallback) { const number = Number(value); return Number.isInteger(number) && number > 0 ? Math.min(number, 99) : fallback; }
function tokyoDateKey() { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }
