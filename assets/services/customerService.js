import { serverTimestamp } from "../js/services/firestoreService.js";
import { createDataService } from "./dataService.js";
import { db } from "../js/firebase/firebaseClient.js";
import {
  doc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { runServiceOperation } from "./serviceRuntime.js";

export const CUSTOMER_COLLECTION = "customers";
export const CUSTOMER_RANKS = Object.freeze(["VIP", "Gold", "Silver", "Regular"]);

export const customerDataService = createDataService({
  collectionName:CUSTOMER_COLLECTION,
  normalize:normalizeCustomer,
  prepare:prepareCustomer,
  validate:validateCustomer,
  searchableFields:["name", "kana", "nickname", "phone", "lineId", "rank", "assignedCastId", "favoriteDrink", "bottleInfo"],
  defaultSort:{ field:"updatedAt", direction:"desc" }
});

export function subscribeCustomers(onData, onError) {
  return customerDataService.listen(onData, onError);
}

export async function createCustomer(input) {
  return customerDataService.create(input, { idField:"customerId" });
}

export function updateCustomer(id, input) {
  return customerDataService.update(id, input, { idField:"customerId" });
}

export function listCustomers(options = {}) { return customerDataService.list(options); }
export function pageCustomers(options = {}) { return customerDataService.page(options); }
export function getCustomer(id, options = {}) { return customerDataService.get(id, options); }
export function subscribeCustomer(id, onData, onError) { return customerDataService.listenOne(id, onData, onError); }

export function findMatchingCustomer(customers = [], input = {}) {
  const target = customerIdentity(input);
  const normalizedName = normalizeName(input.name || input.customerName);
  const contactMatch = customers.find((customer) => {
    const current = customerIdentity(customer);
    if (target.phone && current.phone === target.phone) return true;
    return Boolean(target.lineId && current.lineId === target.lineId);
  });
  if (contactMatch) return contactMatch;
  if (target.phone || target.lineId || !normalizedName) return null;
  const nameMatches = customers.filter((customer) => normalizeName(customer.name) === normalizedName);
  return nameMatches.length === 1 ? nameMatches[0] : null;
}

// 予約完了と顧客来店集計を同じtransactionで確定し、再操作による二重加算を防ぐ。
export async function completeCustomerVisit(reservationId) {
  const reservationRef = doc(db, "reservations", reservationId);
  return runServiceOperation("completeVisit", () => runTransaction(db, async (transaction) => {
    const reservationSnapshot = await transaction.get(reservationRef);
    if (!reservationSnapshot.exists()) throw new Error("reservation-not-found");
    const reservation = reservationSnapshot.data();
    const customerId = String(reservation.customerId || "");
    if (!customerId) {
      transaction.update(reservationRef, { status:"完了", updatedAt:serverTimestamp() });
      return { customerId:"", counted:false };
    }
    if (reservation.visitCounted === true) {
      transaction.update(reservationRef, { status:"完了", updatedAt:serverTimestamp() });
      return { customerId, counted:false };
    }
    const customerRef = doc(db, CUSTOMER_COLLECTION, customerId);
    const customerSnapshot = await transaction.get(customerRef);
    if (!customerSnapshot.exists()) throw new Error("customer-not-found");
    const customer = normalizeCustomer({ id:customerSnapshot.id, ...customerSnapshot.data() });
    const visitDate = cleanDate(reservation.visitDate || reservation.date) || tokyoDateKey();
    transaction.update(customerRef, {
      visitCount:customer.visitCount + 1,
      firstVisit:customer.firstVisit && customer.firstVisit <= visitDate ? customer.firstVisit : visitDate,
      lastVisit:customer.lastVisit && customer.lastVisit >= visitDate ? customer.lastVisit : visitDate,
      assignedCastId:customer.assignedCastId || String(reservation.nominationCastId || reservation.castId || ""),
      updatedAt:serverTimestamp()
    });
    transaction.update(reservationRef, {
      status:"完了",
      visitCounted:true,
      visitCountedAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
    return { customerId, counted:true };
  }), { resource:`reservations/${reservationId}` });
}

export function normalizeCustomer(row = {}) {
  return {
    ...row,
    id:String(row.id || row.customerId || ""),
    customerId:String(row.customerId || row.id || ""),
    name:cleanText(row.name, 100),
    kana:cleanText(row.kana, 100),
    nickname:cleanText(row.nickname, 100),
    phone:cleanText(row.phone, 40),
    lineId:cleanText(row.lineId, 100),
    birthday:cleanDate(row.birthday),
    occupation:cleanText(row.occupation, 100),
    memo:cleanText(row.memo, 3000),
    rank:normalizeRank(row.rank),
    firstVisit:cleanDate(row.firstVisit),
    lastVisit:cleanDate(row.lastVisit),
    visitCount:toNonNegativeInteger(row.visitCount),
    favoriteCastIds:uniqueIds(row.favoriteCastIds),
    assignedCastId:cleanText(row.assignedCastId || row.castId, 100),
    isVip:row.isVip === true || String(row.rank || "") === "VIP",
    isNg:row.isNg === true,
    favoriteDrink:cleanText(row.favoriteDrink, 500),
    bottleInfo:cleanText(row.bottleInfo, 1000),
    totalSpend:toNonNegativeNumber(row.totalSpend),
    averageSpend:toNonNegativeNumber(row.averageSpend)
  };
}

export function prepareCustomer(input = {}) {
  const customer = normalizeCustomer(input);
  return {
    name:customer.name,
    kana:customer.kana,
    nickname:customer.nickname,
    phone:customer.phone,
    lineId:customer.lineId,
    birthday:customer.birthday,
    occupation:customer.occupation,
    memo:customer.memo,
    rank:customer.rank,
    firstVisit:customer.firstVisit,
    lastVisit:customer.lastVisit,
    visitCount:customer.visitCount,
    favoriteCastIds:customer.favoriteCastIds,
    assignedCastId:customer.assignedCastId,
    isVip:customer.isVip,
    isNg:customer.isNg,
    favoriteDrink:customer.favoriteDrink,
    bottleInfo:customer.bottleInfo,
    totalSpend:customer.totalSpend,
    averageSpend:customer.averageSpend
  };
}

export function validateCustomer(input = {}) {
  const customer = normalizeCustomer(input);
  const errors = [];
  if (!customer.name) errors.push("氏名を入力してください。");
  if (!customer.phone && !customer.lineId) errors.push("電話番号またはLINE IDのどちらかを入力してください。");
  if (input.rank && !CUSTOMER_RANKS.includes(String(input.rank))) errors.push("顧客ランクが正しくありません。");
  if (customer.firstVisit && customer.lastVisit && customer.firstVisit > customer.lastVisit) errors.push("最終来店日は初回来店日以降に設定してください。");
  return errors;
}

// customerIdを優先し、Ver8.4以前の予約は電話番号・LINE IDで後方互換照合する。
export function reservationsForCustomer(reservations = [], customer = {}) {
  const target = customerIdentity(customer);
  return reservations.filter((row) => identityMatches(row, target)).sort((a, b) => historyKey(b).localeCompare(historyKey(a)));
}

// 売上データにcustomerIdが追加された場合は即連携し、旧形式の連絡先フィールドも利用する。
export function salesForCustomer(sales = [], customer = {}) {
  const target = customerIdentity(customer);
  return sales.filter((row) => identityMatches({
    customerId:row.customerId,
    phone:row.customerPhone || row.phone,
    lineId:row.customerLineId || row.lineId
  }, target)).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export function customerIdentity(value = {}) {
  return {
    customerId:String(value.customerId || value.id || "").trim(),
    phone:digits(value.phone),
    lineId:String(value.lineId || "").trim().toLowerCase()
  };
}

function identityMatches(row, target) {
  const current = customerIdentity(row);
  if (target.customerId && current.customerId === target.customerId) return true;
  if (target.phone && current.phone === target.phone) return true;
  return Boolean(target.lineId && current.lineId === target.lineId);
}

function historyKey(row) { return `${row.visitDate || row.date || ""}T${row.visitTime || row.time || ""}`; }
function normalizeRank(value) { const rank = String(value || "Regular").trim(); return CUSTOMER_RANKS.includes(rank) ? rank : "Regular"; }
function uniqueIds(value) { return [...new Set((Array.isArray(value) ? value : []).map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 100); }
function cleanText(value, max) { return String(value || "").trim().slice(0, max); }
function cleanDate(value) { const text = String(value || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ""; }
function toNonNegativeInteger(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0; }
function toNonNegativeNumber(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : 0; }
function digits(value) { return String(value || "").replace(/\D/g, ""); }
function normalizeName(value) { return String(value || "").trim().replace(/[\s　]+/g, "").toLowerCase(); }
function tokyoDateKey() { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }
