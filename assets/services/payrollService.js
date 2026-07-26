import { db } from "../js/firebase/firebaseClient.js";
import { createDataService } from "./dataService.js";
import { createBusinessAuditPayload } from "./auditService.js";
import { assertPeriodOpen, calculateMonthlyPayroll as calculateMonthly, calculatePayrollStatement, DEFAULT_COMMISSION_RULES, normalizeCommissionRules } from "./financeCalculator.js";
import { runServiceOperation } from "./serviceRuntime.js";
import { collection, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const DEFAULT_PAYROLL_SETTINGS = DEFAULT_COMMISSION_RULES;
export { calculatePayrollStatement, normalizeCommissionRules };

const settingsService = createDataService({ collectionName:"payrollSettings" });
const commissionService = createDataService({ collectionName:"commissionRules" });
const payrollDataService = createDataService({ collectionName:"payrolls", searchableFields:["castName", "month", "status"], defaultSort:{ field:"month", direction:"desc" } });

export function calculateMonthlyPayroll(input = {}) { return calculateMonthly({ ...input, rules:input.rules || input.settings || DEFAULT_PAYROLL_SETTINGS }); }
export function subscribePayrolls(onData, onError) { return payrollDataService.listen(onData, onError); }
export function listPayrolls(options = {}) { return payrollDataService.list(options); }
export function getPayroll(id, options = {}) { return payrollDataService.get(id, options); }
export function subscribePayroll(id, onData, onError) { return payrollDataService.listenOne(id, onData, onError); }

export function subscribePayrollSettings(onData, onError) {
  const state = { settings:null, rules:null };
  const publish = () => { if (state.settings !== null && state.rules !== null) onData(normalizeCommissionRules({ ...state.settings, ...state.rules })); };
  const unsubSettings = settingsService.listenOne("default", (row) => { state.settings = row || {}; publish(); }, onError);
  const unsubRules = commissionService.listenOne("default", (row) => { state.rules = row || {}; publish(); }, onError);
  return () => { unsubSettings?.(); unsubRules?.(); };
}

export function savePayrollSettings(input, options = {}) {
  const rules = normalizeCommissionRules(input);
  return runServiceOperation("saveCommissionRules", () => runTransaction(db, async (transaction) => {
    const settingsRef = doc(db, "payrollSettings", "default");
    const commissionRef = doc(db, "commissionRules", "default");
    const auditRef = doc(collection(db, "businessAuditLogs"));
    // commissionRulesを正本としつつ、既存のキャストポータルが参照する
    // payrollSettingsにも同じ計算ルールを保存して後方互換を維持する。
    transaction.set(settingsRef, { ...rules, updatedAt:serverTimestamp() }, { merge:true });
    transaction.set(commissionRef, { ...rules, updatedAt:serverTimestamp() }, { merge:true });
    transaction.set(auditRef, createBusinessAuditPayload("commission.update", "commissionRules", "default", { salesCommissionRate:rules.salesCommissionRate }, options.actor));
    return rules;
  }), { resource:"commissionRules/default" });
}

export function savePayrollRecord(statement, adjustments = {}, options = {}) {
  const month = String(statement.month || "").slice(0, 7);
  const castId = String(statement.castId || "");
  const id = `${month}_${castId}`;
  return runServiceOperation("savePayroll", () => runTransaction(db, async (transaction) => {
    const closing = await transaction.get(doc(db, "monthlyClosings", month));
    assertPeriodOpen(null, closing.data());
    const payrollRef = doc(db, "payrolls", id);
    const previous = await transaction.get(payrollRef);
    const normalizedAdjustments = normalizeAdjustments(adjustments);
    transaction.set(payrollRef, { ...statement, ...normalizedAdjustments, payrollId:id, month, castId, status:"draft", updatedAt:serverTimestamp(), ...(previous.exists() ? {} : { createdAt:serverTimestamp() }) }, { merge:true });
    const auditRef = doc(collection(db, "businessAuditLogs"));
    transaction.set(auditRef, createBusinessAuditPayload("payroll.update", "payrolls", id, { month, castId, netPay:statement.netPay, ...normalizedAdjustments }, options.actor));
    return id;
  }), { resource:`payrolls/${id}` });
}

export function normalizeAdjustments(input = {}) { return { attendanceBonus:money(input.attendanceBonus), specialAllowance:money(input.specialAllowance), penalty:money(input.penalty), advance:money(input.advance), withholding:money(input.withholding), otherDeduction:money(input.otherDeduction), adjustmentMemo:String(input.adjustmentMemo || "").trim().slice(0, 1000) }; }
function money(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0; }
