import { db } from "../js/firebase/firebaseClient.js";
import { createDataService } from "./dataService.js";
import { ValidationError } from "./errors.js";
import { assertPeriodOpen, calculateSaleTotals, PAYMENT_FIELDS, SALE_CHARGE_FIELDS, validateSaleCalculation } from "./financeCalculator.js";
import { createBusinessAuditPayload } from "./auditService.js";
import { runServiceOperation } from "./serviceRuntime.js";
import { collection, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const SALES_COLLECTION = "sales";
export const SALES_COUNT_FIELDS = Object.freeze(["customerCount", "honmeiCount", "jounaiCount", "douhanCount"]);
export const SALES_NUMBER_FIELDS = Object.freeze([...SALES_COUNT_FIELDS, ...SALE_CHARGE_FIELDS, "discount", ...PAYMENT_FIELDS]);

export const salesDataService = createDataService({ collectionName:SALES_COLLECTION, normalize:normalizeSalesRecord, prepare:prepareSalesRecord, validate:validateSalesRecord, searchableFields:["customerName", "castName", "memo", "paymentStatus"], defaultSort:{ field:"date", direction:"desc" } });

export function subscribeSales(onData, onError) { return salesDataService.listen(onData, onError); }
export function listSales(options = {}) { return salesDataService.list(options); }
export function pageSales(options = {}) { return salesDataService.page(options); }
export function getSalesRecord(id, options = {}) { return salesDataService.get(id, options); }
export function subscribeSalesRecord(id, onData, onError) { return salesDataService.listenOne(id, onData, onError); }

export function createSalesRecord(input, options = {}) {
  assertValid(input);
  const reference = doc(collection(db, SALES_COLLECTION));
  const payload = prepareSalesRecord(input);
  return runServiceOperation("createSale", () => runTransaction(db, async (transaction) => {
    await assertOpen(transaction, payload.date, payload.month);
    transaction.set(reference, { ...payload, saleId:reference.id, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
    setAudit(transaction, "sales.create", reference.id, { date:payload.date, total:payload.total, castId:payload.castId }, options.actor);
    return reference.id;
  }), { resource:`sales/${reference.id}` });
}

export function updateSalesRecord(id, input, options = {}) {
  assertValid(input);
  const reference = doc(db, SALES_COLLECTION, id);
  const payload = prepareSalesRecord(input);
  return runServiceOperation("updateSale", () => runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("sale-not-found");
    const previous = normalizeSalesRecord({ id:snapshot.id, ...snapshot.data() });
    await assertOpen(transaction, previous.date, previous.month);
    if (payload.date !== previous.date || payload.month !== previous.month) await assertOpen(transaction, payload.date, payload.month);
    transaction.update(reference, { ...payload, saleId:id, updatedAt:serverTimestamp() });
    setAudit(transaction, "sales.update", id, { date:payload.date, previousTotal:previous.total, total:payload.total, castId:payload.castId }, options.actor);
    return id;
  }), { resource:`sales/${id}` });
}

export function deleteSalesRecord(id, options = {}) {
  const reference = doc(db, SALES_COLLECTION, id);
  return runServiceOperation("deleteSale", () => runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) return false;
    const previous = normalizeSalesRecord({ id:snapshot.id, ...snapshot.data() });
    await assertOpen(transaction, previous.date, previous.month);
    transaction.delete(reference);
    setAudit(transaction, "sales.delete", id, { date:previous.date, total:previous.total, castId:previous.castId }, options.actor);
    return true;
  }), { resource:`sales/${id}` });
}

export function findDuplicateSalesRecord(rows, payload, excludedId = "") { return rows.find((row) => row.id !== excludedId && row.date === payload.date && row.castId === payload.castId && String(row.visitId || row.customerId) === String(payload.visitId || payload.customerId)) || null; }

export function normalizeSalesRecord(row = {}) {
  const legacyTotal = nonNegative(row.total ?? row.sales);
  const chargeFallback = SALE_CHARGE_FIELDS.some((field) => Number(row[field]) > 0) ? row : { ...row, otherSales:legacyTotal, serviceRate:0, taxRate:0 };
  const calculated = calculateSaleTotals(chargeFallback);
  const total = row.total == null ? calculated.total : nonNegative(row.total);
  return {
    ...row, ...calculated, id:String(row.id || row.saleId || ""), saleId:String(row.saleId || row.id || ""),
    date:dateKey(row.date), month:String(row.month || row.date || "").slice(0, 7), visitId:text(row.visitId, 100), reservationId:text(row.reservationId, 100),
    customerId:text(row.customerId, 100), customerName:text(row.customerName, 100), customerPhone:text(row.customerPhone || row.phone, 40), customerLineId:text(row.customerLineId || row.lineId, 100),
    castId:text(row.castId, 100), castName:text(row.castName, 100), attendance:row.attendance !== false,
    customerCount:integer(row.customerCount), honmeiCount:integer(row.honmeiCount ?? row.honmei), jounaiCount:integer(row.jounaiCount ?? row.jounai), douhanCount:integer(row.douhanCount ?? row.douhan),
    ...Object.fromEntries(SALE_CHARGE_FIELDS.map((field) => [field, nonNegative(chargeFallback[field])])), discount:nonNegative(row.discount),
    subtotal:row.subtotal == null ? calculated.subtotal : nonNegative(row.subtotal), serviceRate:rate(row.serviceRate, calculated.serviceRate), serviceCharge:row.serviceCharge == null ? calculated.serviceCharge : nonNegative(row.serviceCharge),
    taxRate:rate(row.taxRate, calculated.taxRate), taxAmount:row.taxAmount == null ? calculated.taxAmount : nonNegative(row.taxAmount), total, sales:total,
    ...Object.fromEntries(PAYMENT_FIELDS.map((field) => [field, nonNegative(row[field])])), paymentTotal:PAYMENT_FIELDS.reduce((sum, field) => sum + nonNegative(row[field]), 0),
    paymentStatus:text(row.paymentStatus || (nonNegative(row.accountsReceivable) ? "売掛あり" : "精算済"), 30), memo:text(row.memo, 1000)
  };
}

export function prepareSalesRecord(input = {}) {
  const row = normalizeSalesRecord(input);
  const totals = calculateSaleTotals(row);
  return {
    date:row.date, month:row.month, visitId:row.visitId, reservationId:row.reservationId, customerId:row.customerId, customerName:row.customerName,
    customerPhone:row.customerPhone, customerLineId:row.customerLineId, castId:row.castId, castName:row.castName, attendance:row.attendance,
    customerCount:row.customerCount, honmeiCount:row.honmeiCount, jounaiCount:row.jounaiCount, douhanCount:row.douhanCount,
    ...Object.fromEntries(SALE_CHARGE_FIELDS.map((field) => [field, row[field]])), discount:totals.discount, subtotal:totals.subtotal,
    serviceRate:totals.serviceRate, serviceCharge:totals.serviceCharge, taxRate:totals.taxRate, taxAmount:totals.taxAmount, total:totals.total, sales:totals.total,
    ...Object.fromEntries(PAYMENT_FIELDS.map((field) => [field, row[field]])), paymentTotal:totals.paymentTotal,
    paymentStatus:row.accountsReceivable > 0 ? "売掛あり" : "精算済", memo:row.memo
  };
}

export function validateSalesRecord(input = {}) {
  const row = normalizeSalesRecord(input); const errors = [];
  if (!row.date) errors.push("営業日を選択してください。");
  if (!row.visitId && !row.reservationId) errors.push("来店履歴を選択してください。");
  if (!row.customerId) errors.push("顧客を選択してください。");
  if (!row.castId) errors.push("担当キャストを選択してください。");
  SALES_COUNT_FIELDS.forEach((field) => { if (!Number.isInteger(Number(input[field])) || Number(input[field]) < 0) errors.push(`${field}は0以上の整数で入力してください。`); });
  errors.push(...validateSaleCalculation(input));
  return errors;
}

function assertValid(input) { const errors = validateSalesRecord(input); if (errors.length) throw new ValidationError(errors[0], { details:errors, resource:"sales" }); }
async function assertOpen(transaction, date, month) { const daily = await transaction.get(doc(db, "dailyClosings", date)); const monthly = await transaction.get(doc(db, "monthlyClosings", month)); assertPeriodOpen(daily.data(), monthly.data()); }
function setAudit(transaction, action, targetId, detail, actor = {}) { const ref = doc(collection(db, "businessAuditLogs")); transaction.set(ref, createBusinessAuditPayload(action, "sales", targetId, detail, actor)); }
function dateKey(value) { const textValue = String(value || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(textValue) ? textValue : ""; }
function text(value, max) { return String(value || "").trim().slice(0, max); }
function nonNegative(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0; }
function integer(value) { return Math.trunc(nonNegative(value)); }
function rate(value, fallback) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.min(100, number) : fallback; }
