import {
  addDocument,
  removeDocument,
  serverTimestamp,
  subscribeCollection,
  updateDocument
} from "./firestoreService.js";

export const RESERVATION_STATUSES = Object.freeze(["受付", "確認済", "来店", "会計済", "完了", "キャンセル", "無断キャンセル"]);
export const ACTIVE_RESERVATION_STATUSES = new Set(["受付", "確認済", "来店", "会計済"]);

export function subscribeReservations(onData, onError) {
  return subscribeCollection("reservations", (rows) => onData(rows.map(normalizeReservation)), onError);
}

export async function createReservation(input) {
  const data = prepareReservation(input);
  const id = await addDocument("reservations", { ...data, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
  await updateDocument("reservations", id, { reservationId:id });
  return id;
}

export function updateReservation(id, input) {
  return updateDocument("reservations", id, { ...prepareReservation(input), reservationId:id, updatedAt:serverTimestamp() });
}

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

export function updateReservationStatus(id, status) {
  return updateDocument("reservations", id, {
    reservationId:id,
    status:normalizeStatus(status),
    updatedAt:serverTimestamp()
  });
}

export function deleteReservation(id) {
  return removeDocument("reservations", id);
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
    customerName,
    phone:cleanText(row.phone, 40),
    lineId:cleanText(row.lineId, 100),
    visitDate,
    visitTime,
    peopleCount:toPositiveInteger(row.peopleCount ?? row.people, 1),
    course:cleanText(row.course, 100),
    nominationCastId:cleanText(row.nominationCastId || row.castId, 100),
    nominationCastName,
    status:normalizeStatus(row.status),
    memo:cleanText(row.memo || row.request, 1000),
    source:normalizeSource(row.source || (row.lineId ? "LINE" : "WEB"))
  };
}

export function prepareReservation(input = {}) {
  const normalized = normalizeReservation(input);
  return {
    customerName:normalized.customerName,
    phone:normalized.phone,
    lineId:normalized.lineId,
    visitDate:normalized.visitDate,
    visitTime:normalized.visitTime,
    peopleCount:normalized.peopleCount,
    course:normalized.course,
    nominationCastId:normalized.nominationCastId,
    nominationCastName:normalized.nominationCastName,
    status:normalized.status,
    memo:normalized.memo,
    source:normalized.source,
    // 既存ダッシュボードと旧画面の互換性を保つ。
    name:normalized.customerName,
    date:normalized.visitDate,
    time:normalized.visitTime,
    people:String(normalized.peopleCount),
    cast1:normalized.nominationCastName,
    request:normalized.memo
  };
}

export function reservationDateTime(item) {
  const date = cleanDate(item?.visitDate || item?.date);
  const time = cleanTime(item?.visitTime || item?.time) || "00:00";
  const parsed = new Date(`${date}T${time}:00+09:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getCustomerHistory(reservations, target) {
  const phone = digits(target?.phone);
  const lineId = String(target?.lineId || "").trim().toLowerCase();
  if (!phone && !lineId) return [];
  return reservations.filter((item) => item.id !== target.id && ((phone && digits(item.phone) === phone) || (lineId && String(item.lineId || "").trim().toLowerCase() === lineId))).sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)) || String(b.visitTime).localeCompare(String(a.visitTime)));
}

// キャスト詳細・ダッシュボードから同じ集計を再利用できる公開インターフェース。
export function getCastReservationSummary(reservations, castId, today = tokyoDateKey()) {
  const active = reservations.map(normalizeReservation).filter((item) => item.nominationCastId === castId && !["キャンセル", "無断キャンセル"].includes(item.status));
  const upcoming = active.filter((item) => `${item.visitDate}T${item.visitTime}` >= `${today}T00:00`).sort((a, b) => `${a.visitDate}T${a.visitTime}`.localeCompare(`${b.visitDate}T${b.visitTime}`));
  const todayRows = active.filter((item) => item.visitDate === today);
  return { todayCount:todayRows.length, todayPeople:todayRows.reduce((total, item) => total + item.peopleCount, 0), nextReservation:upcoming[0] || null };
}

function normalizeStatus(value) { const status = String(value || "受付").trim(); return RESERVATION_STATUSES.includes(status) ? status : "受付"; }
function normalizeSource(value) { const source = String(value || "WEB").trim().toUpperCase(); return ["WEB", "LINE", "電話", "店頭", "その他"].includes(source) ? source : "WEB"; }
function cleanText(value, max) { return String(value || "").trim().slice(0, max); }
function cleanDate(value) { const text = String(value || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""; }
function cleanTime(value) { const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/); return match ? `${String(Number(match[1])).padStart(2, "0")}:${match[2]}` : ""; }
function toPositiveInteger(value, fallback) { const number = Number(value); return Number.isInteger(number) && number > 0 ? Math.min(number, 99) : fallback; }
function digits(value) { return String(value || "").replace(/\D/g, ""); }
function tokyoDateKey() { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }
