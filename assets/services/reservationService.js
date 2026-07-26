import {
  serverTimestamp,
  updateDocument
} from "../js/services/firestoreService.js";
import { createDataService } from "./dataService.js";
import { deleteReservationFlow, normalizeVisitStatus, transitionReservation } from "./visitService.js";

export const RESERVATION_STATUSES = Object.freeze(["予約", "受付", "着席", "延長", "会計", "完了", "キャンセル", "無断キャンセル"]);
export const ACTIVE_RESERVATION_STATUSES = new Set(["予約", "受付", "着席", "延長", "会計"]);

export const reservationDataService = createDataService({
  collectionName:"reservations",
  normalize:normalizeReservation,
  prepare:prepareReservation,
  validate:validateReservation,
  searchableFields:["customerName", "phone", "lineId", "nominationCastName", "status", "memo"],
  defaultSort:(a, b) => `${a.visitDate}T${a.visitTime}`.localeCompare(`${b.visitDate}T${b.visitTime}`)
});

export function subscribeReservations(onData, onError) {
  return reservationDataService.listen(onData, onError);
}

export async function createReservation(input) {
  return reservationDataService.create(input, { idField:"reservationId" });
}

export function updateReservation(id, input) {
  return reservationDataService.update(id, input, { idField:"reservationId" });
}

// 旧予約画面のステータスだけを更新する用途。完全更新用のバリデーションを通さず互換値を保持する。
export function patchReservation(id, input) {
  return updateDocument("reservations", id, { ...input, reservationId:id, updatedAt:serverTimestamp() });
}

export function listReservations(options = {}) { return reservationDataService.list(options); }
export function pageReservations(options = {}) { return reservationDataService.page(options); }
export function getReservation(id, options = {}) { return reservationDataService.get(id, options); }
export function subscribeReservation(id, onData, onError) { return reservationDataService.listenOne(id, onData, onError); }

export function updateReservationSchedule(id, visitDate, visitTime) {
  return updateDocument("reservations", id, {
    reservationId:id,
    visitDate:cleanDate(visitDate),
    visitTime:cleanTime(visitTime),
    date:cleanDate(visitDate),
    time:cleanTime(visitTime),
    updatedAt:serverTimestamp()
  });
}

export function linkReservationToCustomer(id, customer = {}) {
  return updateDocument("reservations", id, {
    customerId:String(customer.customerId || customer.id || ""),
    customerName:cleanText(customer.name || customer.customerName, 100),
    phone:cleanText(customer.phone, 40),
    lineId:cleanText(customer.lineId, 100),
    updatedAt:serverTimestamp()
  });
}

export function updateReservationStatus(id, status, context = {}) {
  return transitionReservation(id, normalizeStatus(status), context);
}

export function deleteReservation(id) {
  return deleteReservationFlow(id);
}

export function normalizeReservation(row = {}) {
  const visitDate = cleanDate(row.visitDate || row.date || row.reservationDate || row.desiredDate);
  const visitTime = cleanTime(row.visitTime || row.time || row.desiredTime);
  const customerName = cleanText(row.customerName || row.name, 100);
  const nominationCastName = cleanText(row.nominationCastName || row.cast1 || row.castName, 100);
  return {
    ...row,
    id:String(row.id || row.reservationId || ""),
    reservationId:String(row.reservationId || row.id || ""),
    customerId:cleanText(row.customerId, 100),
    customerName,
    phone:cleanText(row.phone, 40),
    lineId:cleanText(row.lineId, 100),
    visitDate,
    visitTime,
    peopleCount:toPositiveInteger(row.peopleCount ?? row.people, 1),
    course:cleanText(row.course, 100),
    nominationCastId:cleanText(row.nominationCastId || row.castId, 100),
    nominationCastName,
    assignedCastId:cleanText(row.assignedCastId, 100),
    assignedCastName:cleanText(row.assignedCastName, 100),
    tableType:cleanText(row.tableType, 30),
    tableId:cleanText(row.tableId, 100),
    tableName:cleanText(row.tableName, 80),
    visitId:cleanText(row.visitId, 100),
    castAssignments:Array.isArray(row.castAssignments) ? row.castAssignments.slice(0, 20) : [],
    status:normalizeStatus(row.status),
    memo:cleanText(row.memo || row.request, 1000),
    source:normalizeSource(row.source || (row.lineId ? "LINE" : "WEB"))
  };
}

export function prepareReservation(input = {}) {
  const normalized = normalizeReservation(input);
  return {
    customerId:normalized.customerId,
    customerName:normalized.customerName,
    phone:normalized.phone,
    lineId:normalized.lineId,
    visitDate:normalized.visitDate,
    visitTime:normalized.visitTime,
    peopleCount:normalized.peopleCount,
    course:normalized.course,
    nominationCastId:normalized.nominationCastId,
    nominationCastName:normalized.nominationCastName,
    assignedCastId:normalized.assignedCastId,
    assignedCastName:normalized.assignedCastName,
    tableType:normalized.tableType,
    tableId:normalized.tableId,
    tableName:normalized.tableName,
    visitId:normalized.visitId,
    castAssignments:normalized.castAssignments,
    status:normalized.status,
    memo:normalized.memo,
    source:normalized.source,
    // Ver8.3までのダッシュボードと公開予約画面との互換性を維持する。
    name:normalized.customerName,
    date:normalized.visitDate,
    time:normalized.visitTime,
    people:String(normalized.peopleCount),
    cast1:normalized.nominationCastName,
    request:normalized.memo
  };
}

export function validateReservation(input = {}) {
  const reservation = normalizeReservation(input);
  const errors = [];
  if (!reservation.customerName) errors.push("お客様名を入力してください。");
  if (!reservation.phone && !reservation.lineId) errors.push("電話番号またはLINE IDを入力してください。");
  if (!reservation.visitDate) errors.push("来店日を選択してください。");
  if (!reservation.visitTime) errors.push("来店時間を選択してください。");
  const peopleCount = Number(input.peopleCount ?? input.people);
  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 99) errors.push("人数は1〜99名で入力してください。");
  return errors;
}

export function reservationDateTime(item) {
  const date = cleanDate(item?.visitDate || item?.date);
  const time = cleanTime(item?.visitTime || item?.time) || "00:00";
  const parsed = new Date(`${date}T${time}:00+09:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getCustomerHistory(reservations, target) {
  const customerId = String(target?.customerId || "");
  const phone = digits(target?.phone);
  const lineId = String(target?.lineId || "").trim().toLowerCase();
  if (!customerId && !phone && !lineId) return [];
  return reservations.filter((item) => item.id !== target.id && ((customerId && item.customerId === customerId) || (phone && digits(item.phone) === phone) || (lineId && String(item.lineId || "").trim().toLowerCase() === lineId))).sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)) || String(b.visitTime).localeCompare(String(a.visitTime)));
}

// キャスト詳細・ダッシュボードから同じ集計を再利用できる公開インターフェース。
export function getCastReservationSummary(reservations, castId, today = tokyoDateKey()) {
  const active = reservations.map(normalizeReservation).filter((item) => item.nominationCastId === castId && !["キャンセル", "無断キャンセル"].includes(item.status));
  const upcoming = active.filter((item) => `${item.visitDate}T${item.visitTime}` >= `${today}T00:00`).sort((a, b) => `${a.visitDate}T${a.visitTime}`.localeCompare(`${b.visitDate}T${b.visitTime}`));
  const todayRows = active.filter((item) => item.visitDate === today);
  return { todayCount:todayRows.length, todayPeople:todayRows.reduce((total, item) => total + item.peopleCount, 0), nextReservation:upcoming[0] || null };
}

function normalizeStatus(value) { return normalizeVisitStatus(value); }
function normalizeSource(value) { const source = String(value || "WEB").trim().toUpperCase(); return ["WEB", "LINE", "電話", "店頭", "その他"].includes(source) ? source : "WEB"; }
function cleanText(value, max) { return String(value || "").trim().slice(0, max); }
function cleanDate(value) { const text = String(value || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""; }
function cleanTime(value) { const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/); return match ? `${String(Number(match[1])).padStart(2, "0")}:${match[2]}` : ""; }
function toPositiveInteger(value, fallback) { const number = Number(value); return Number.isInteger(number) && number > 0 ? Math.min(number, 99) : fallback; }
function digits(value) { return String(value || "").replace(/\D/g, ""); }
function tokyoDateKey() { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }
