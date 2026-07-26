import { db } from "../js/firebase/firebaseClient.js";
import { createDataService } from "./dataService.js";
import { createBusinessAuditPayload } from "./auditService.js";
import { listSales } from "./salesService.js";
import { summarizeSales } from "./financeCalculator.js";
import { runServiceOperation } from "./serviceRuntime.js";
import { collection, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const dailyService = createDataService({ collectionName:"dailyClosings", defaultSort:{ field:"date", direction:"desc" } });
const monthlyService = createDataService({ collectionName:"monthlyClosings", defaultSort:{ field:"month", direction:"desc" } });

export function subscribeDailyClosings(onData, onError) { return dailyService.listen(onData, onError); }
export function subscribeMonthlyClosings(onData, onError) { return monthlyService.listen(onData, onError); }
export function listDailyClosings(options = {}) { return dailyService.list(options); }
export function listMonthlyClosings(options = {}) { return monthlyService.list(options); }

export async function closeDailyBusiness(date, options = {}) {
  const rows = (await listSales({ force:true })).filter((row) => row.date === date);
  return writeClosing("dailyClosings", date, { date, ...summarizeSales(rows), salesRecordIds:rows.map((row) => row.id) }, "closing.daily.close", options.actor);
}

export async function closeMonthlyBusiness(month, options = {}) {
  const rows = (await listSales({ force:true })).filter((row) => row.month === month || row.date.startsWith(month));
  return writeClosing("monthlyClosings", month, { month, ...summarizeSales(rows), salesRecordIds:rows.map((row) => row.id) }, "closing.monthly.close", options.actor);
}

export function reopenDailyClosing(date, options = {}) { return reopenClosing("dailyClosings", date, "closing.daily.reopen", options.actor); }
export function reopenMonthlyClosing(month, options = {}) { return reopenClosing("monthlyClosings", month, "closing.monthly.reopen", options.actor); }

export { summarizeSales };

async function writeClosing(collectionName, id, snapshot, action, actor = {}) {
  return runServiceOperation(action, () => runTransaction(db, async (transaction) => {
    const reference = doc(db, collectionName, id);
    const current = await transaction.get(reference);
    if (current.data()?.status === "closed") throw new Error("period-closed");
    transaction.set(reference, { ...snapshot, closingId:id, status:"closed", closedByUid:String(actor.uid || ""), closedByName:String(actor.displayName || actor.email || ""), closedAt:serverTimestamp(), updatedAt:serverTimestamp(), ...(current.exists() ? {} : { createdAt:serverTimestamp() }) }, { merge:true });
    const auditRef = doc(collection(db, "businessAuditLogs"));
    transaction.set(auditRef, createBusinessAuditPayload(action, collectionName, id, { total:snapshot.total, salesCount:snapshot.salesCount }, actor));
    return id;
  }), { resource:`${collectionName}/${id}` });
}

async function reopenClosing(collectionName, id, action, actor = {}) {
  return runServiceOperation(action, () => runTransaction(db, async (transaction) => {
    const reference = doc(db, collectionName, id);
    const current = await transaction.get(reference);
    if (!current.exists()) throw new Error("closing-not-found");
    transaction.update(reference, { status:"open", reopenedByUid:String(actor.uid || ""), reopenedByName:String(actor.displayName || actor.email || ""), reopenedAt:serverTimestamp(), updatedAt:serverTimestamp() });
    const auditRef = doc(collection(db, "businessAuditLogs"));
    transaction.set(auditRef, createBusinessAuditPayload(action, collectionName, id, { previousStatus:current.data().status }, actor));
    return id;
  }), { resource:`${collectionName}/${id}` });
}
