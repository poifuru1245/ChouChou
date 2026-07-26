import { adminSession } from "./admin.js";
import { subscribeCasts } from "./services/castService.js";
import { subscribeCustomers } from "./services/customerService.js";
import { calculateSaleTotals, PAYMENT_FIELDS, SALE_CHARGE_FIELDS } from "./services/financeCalculator.js";
import { updateReservationStatus } from "./services/reservationService.js";
import { createSalesRecord, deleteSalesRecord, findDuplicateSalesRecord, SALES_COUNT_FIELDS, subscribeSales, updateSalesRecord, validateSalesRecord } from "./services/salesService.js";
import { subscribeVisits } from "./services/visitService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";

const form = document.getElementById("salesForm");
const list = document.getElementById("salesList");
const actor = adminSession.profile;
const state = { casts:[], customers:[], visits:[], sales:[], editingId:"", pendingDeleteId:"", period:"today", search:"", sort:"date-desc" };
const amountFields = [...SALE_CHARGE_FIELDS, "discount", ...PAYMENT_FIELDS, "serviceRate", "taxRate"];

initialize();
function initialize() {
  bindEvents(); resetForm();
  subscribeCasts((rows) => { state.casts = rows; renderCastOptions(); render(); }, handleError);
  subscribeCustomers((rows) => { state.customers = rows; render(); }, handleError);
  subscribeVisits((rows) => { state.visits = rows; renderVisitOptions(); }, handleError);
  subscribeSales((rows) => { state.sales = rows; render(); }, handleError);
}

function bindEvents() {
  form.addEventListener("submit", saveSale);
  form.elements.visitId.addEventListener("change", applyVisit);
  amountFields.forEach((field) => form.elements[field]?.addEventListener("input", renderCalculation));
  document.getElementById("fillCashBalance").addEventListener("click", fillCashBalance);
  document.getElementById("resetSales").addEventListener("click", resetForm);
  document.getElementById("cancelSalesEdit").addEventListener("click", resetForm);
  document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => { state.period = button.dataset.period; document.querySelectorAll("[data-period]").forEach((item) => item.classList.toggle("is-active", item === button)); render(); }));
  ["salesExactDate", "salesDateFrom", "salesDateTo", "salesCastFilter", "salesSort"].forEach((id) => document.getElementById(id)?.addEventListener("change", (event) => { if (id === "salesSort") state.sort = event.target.value; render(); }));
  document.getElementById("salesSearch").addEventListener("input", (event) => { state.search = event.target.value.trim().toLowerCase(); render(); });
  document.getElementById("salesHistoryCast").addEventListener("change", renderCastHistory);
  list.addEventListener("click", handleListAction);
  document.getElementById("cancelSalesDelete").addEventListener("click", closeDelete);
  document.getElementById("confirmSalesDelete").addEventListener("click", confirmDelete);
}

function renderVisitOptions() {
  const selected = form.elements.visitId.value;
  form.elements.visitId.innerHTML = '<option value="">来店履歴を選択</option>' + state.visits.filter((visit) => !["予約", "キャンセル", "無断キャンセル"].includes(visit.status)).map((visit) => `<option value="${escapeAttribute(visit.id)}">${escapeHtml(`${visit.visitDate} ${visit.visitTime || ""} ${visit.customerName}様 / ${visit.assignedCastName || visit.nominationCastName || "担当未設定"} / ${visit.status}`)}</option>`).join("");
  form.elements.visitId.value = selected;
}
function applyVisit() {
  const visit = state.visits.find((row) => row.id === form.elements.visitId.value); if (!visit) return;
  form.elements.date.value = visit.visitDate; form.elements.customerId.value = visit.customerId; form.elements.reservationId.value = visit.reservationId;
  form.elements.customerCount.value = visit.peopleCount || 1;
  const castId = visit.assignedCastId || visit.nominationCastId || visit.castAssignments?.[0]?.castId || "";
  if (castId) form.elements.castId.value = castId;
}

function collectPayload() {
  const values = Object.fromEntries(new FormData(form).entries());
  const cast = state.casts.find((row) => row.id === values.castId);
  const visit = state.visits.find((row) => row.id === values.visitId);
  const customer = state.customers.find((row) => row.id === values.customerId);
  const payload = { ...values, castName:cast?.name || "", customerName:customer?.name || visit?.customerName || "", customerPhone:customer?.phone || "", customerLineId:customer?.lineId || "", attendance:true };
  [...SALES_COUNT_FIELDS, ...amountFields].forEach((field) => { payload[field] = number(form.elements[field]?.value); });
  return payload;
}

function renderCalculation() {
  const totals = calculateSaleTotals(Object.fromEntries(amountFields.map((field) => [field, number(form.elements[field]?.value)])));
  setText("saleSubtotal", yen(totals.subtotal)); setText("saleServiceCharge", yen(totals.serviceCharge)); setText("saleTax", yen(totals.taxAmount)); setText("saleGrandTotal", yen(totals.total));
  const difference = document.getElementById("salePaymentDifference"); difference.textContent = `差額 ${yen(totals.paymentDifference)}`; difference.dataset.type = totals.paymentDifference === 0 ? "success" : "error";
  return totals;
}
function fillCashBalance() { const totals = renderCalculation(); const other = totals.cardPayment + totals.qrPayment + totals.accountsReceivable; form.elements.cashPayment.value = Math.max(0, totals.total - other); renderCalculation(); }

async function saveSale(event) {
  event.preventDefault(); const payload = collectPayload(); const errors = validateSalesRecord(payload);
  if (errors.length) return setMessage(errors[0], "error");
  if (findDuplicateSalesRecord(state.sales, payload, state.editingId)) return setMessage("同じ来店・キャストの売上が既にあります。", "error");
  const button = document.getElementById("saveSales"); button.disabled = true; const wasEditing = Boolean(state.editingId);
  try {
    const saleId = state.editingId ? await updateSalesRecord(state.editingId, payload, { actor }) : await createSalesRecord(payload, { actor });
    if (payload.reservationId) await updateReservationStatus(payload.reservationId, "完了", { saleId, eventNote:"売上会計を確定" });
    resetForm(); setMessage(wasEditing ? "売上を修正し監査履歴へ記録しました。" : "売上を保存しました。", "success");
  } catch (error) { console.error(error); setMessage(error.message?.includes("period-closed") ? "締め済み期間の売上は変更できません。" : "売上を保存できませんでした。", "error"); }
  finally { button.disabled = false; }
}

function render() { renderSummary(); const rows = filteredSales(); setText("salesResultCount", `${rows.length}件`); list.innerHTML = rows.length ? salesTable(rows) : '<p class="sales-empty">該当する売上はありません。</p>'; renderCastHistory(); }
function renderSummary() { const today = todayKey(); const month = today.slice(0, 7); const monthRows = state.sales.filter((row) => row.month === month || row.date.startsWith(month)); setText("salesTodayTotal", yen(sum(state.sales.filter((row) => row.date === today), "total"))); setText("salesMonthTotal", yen(sum(monthRows, "total"))); setText("salesHonmeiTotal", sum(monthRows, "honmeiCount")); setText("salesJounaiTotal", sum(monthRows, "jounaiCount")); setText("salesDouhanTotal", sum(monthRows, "douhanCount")); setText("salesCustomerTotal", sum(monthRows, "customerCount")); }
function filteredSales() { const today = todayKey(); const exact = document.getElementById("salesExactDate").value; const from = document.getElementById("salesDateFrom").value; const to = document.getElementById("salesDateTo").value; const castId = document.getElementById("salesCastFilter").value; return state.sales.filter((row) => { const period = exact ? row.date === exact : state.period === "today" ? row.date === today : state.period === "month" ? row.date.startsWith(today.slice(0, 7)) : (!from || row.date >= from) && (!to || row.date <= to); return period && (!castId || row.castId === castId) && (!state.search || `${row.customerName} ${row.castName} ${row.memo}`.toLowerCase().includes(state.search)); }).sort(compareSales); }
function compareSales(a, b) { if (state.sort === "date-asc") return a.date.localeCompare(b.date); if (state.sort === "sales-desc") return b.total - a.total; if (state.sort === "sales-asc") return a.total - b.total; if (state.sort === "cast-asc") return a.castName.localeCompare(b.castName, "ja"); return b.date.localeCompare(a.date); }
function salesTable(rows) { return `<div class="sales-table-wrap"><table class="sales-table"><thead><tr><th>営業日</th><th>顧客</th><th>キャスト</th><th>合計</th><th>決済</th><th>指名</th><th>操作</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.customerName || customerName(row.customerId))}</td><td>${escapeHtml(row.castName || castName(row.castId))}</td><td>${yen(row.total)}</td><td>${escapeHtml(row.paymentStatus)}</td><td>本${row.honmeiCount} / 場${row.jounaiCount} / 同${row.douhanCount}</td><td><div class="admin-item-actions"><a href="sale-detail.html?id=${encodeURIComponent(row.id)}">詳細</a><button data-action="edit" data-id="${escapeAttribute(row.id)}">編集</button><button data-action="delete" data-id="${escapeAttribute(row.id)}">削除</button></div></td></tr>`).join("")}</tbody></table></div>`; }

function handleListAction(event) { const button = event.target.closest("button[data-action]"); if (!button) return; const row = state.sales.find((item) => item.id === button.dataset.id); if (!row) return; if (button.dataset.action === "edit") editSale(row); else openDelete(row); }
function editSale(row) { state.editingId = row.id; ["visitId", "reservationId", "customerId", "date", "castId", "memo", ...SALES_COUNT_FIELDS, ...amountFields].forEach((field) => { if (form.elements[field]) form.elements[field].value = row[field] ?? ""; }); document.getElementById("salesFormTitle").textContent = "売上を編集"; document.getElementById("saveSales").textContent = "変更を保存"; document.getElementById("cancelSalesEdit").hidden = false; renderCalculation(); form.scrollIntoView({ behavior:"smooth" }); }
function resetForm() { state.editingId = ""; form.reset(); form.elements.date.value = todayKey(); [...SALES_COUNT_FIELDS, ...SALE_CHARGE_FIELDS, "discount", ...PAYMENT_FIELDS].forEach((field) => { if (form.elements[field]) form.elements[field].value = field === "customerCount" ? "1" : "0"; }); form.elements.serviceRate.value = "20"; form.elements.taxRate.value = "10"; document.getElementById("salesFormTitle").textContent = "営業実績を入力"; document.getElementById("saveSales").textContent = "売上を保存"; document.getElementById("cancelSalesEdit").hidden = true; renderCalculation(); }
function openDelete(row) { state.pendingDeleteId = row.id; document.getElementById("salesDeleteDescription").textContent = `${row.date} ${row.customerName}様 ${yen(row.total)}を削除します。`; document.getElementById("salesDeleteModal").hidden = false; }
function closeDelete() { state.pendingDeleteId = ""; document.getElementById("salesDeleteModal").hidden = true; }
async function confirmDelete() { try { await deleteSalesRecord(state.pendingDeleteId, { actor }); closeDelete(); setMessage("売上を削除し監査履歴へ記録しました。", "success"); } catch (error) { setMessage(error.message?.includes("period-closed") ? "締め済み期間の売上は削除できません。" : "削除できませんでした。", "error"); } }
function renderCastOptions() { const options = state.casts.map((row) => `<option value="${escapeAttribute(row.id)}">${escapeHtml(row.name || "名称未設定")}</option>`).join(""); [form.elements.castId, document.getElementById("salesCastFilter"), document.getElementById("salesHistoryCast")].forEach((select) => { const value = select.value; const label = select === form.elements.castId ? "キャストを選択" : "すべてのキャスト"; select.innerHTML = `<option value="">${label}</option>${options}`; select.value = value; }); }
function renderCastHistory() { const output = document.getElementById("salesCastHistory"); const castId = document.getElementById("salesHistoryCast").value; if (!castId) return output.innerHTML = "<p>キャストを選択してください。</p>"; const rows = state.sales.filter((row) => row.castId === castId); output.innerHTML = `<div class="sales-cast-totals"><div><span>累計売上</span><strong>${yen(sum(rows, "total"))}</strong></div><div><span>本指名</span><strong>${sum(rows, "honmeiCount")}</strong></div><div><span>場内</span><strong>${sum(rows, "jounaiCount")}</strong></div><div><span>同伴</span><strong>${sum(rows, "douhanCount")}</strong></div></div>`; }
function sum(rows, field) { return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0); }
function castName(id) { return state.casts.find((row) => row.id === id)?.name || ""; }
function customerName(id) { return state.customers.find((row) => row.id === id)?.name || ""; }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function yen(value) { return new Intl.NumberFormat("ja-JP", { style:"currency", currency:"JPY", maximumFractionDigits:0 }).format(Number(value) || 0); }
function todayKey() { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }
function setText(id, value) { document.getElementById(id).textContent = String(value); }
function setMessage(text, type = "") { const element = document.getElementById("salesMessage"); element.textContent = text; element.dataset.type = type; }
function handleError(error) { console.error(error); setMessage("データを読み込めませんでした。", "error"); }
