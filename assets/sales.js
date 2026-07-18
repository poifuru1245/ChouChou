import "./admin.js";
import {
  createSalesRecord,
  deleteSalesRecord,
  findDuplicateSalesRecord,
  SALES_NUMBER_FIELDS,
  subscribeSales,
  updateSalesRecord
} from "./js/services/salesService.js";
import { subscribeCollection } from "./js/services/firestoreService.js";
import { escapeAttribute, escapeHtml } from "./js/utils/dom.js";
import { setBusy, showPageError } from "./js/ui/pageState.js";

const COUNT_FIELDS = ["customerCount", "honmeiCount", "jounaiCount", "douhanCount"];
const form = document.getElementById("salesForm");
const list = document.getElementById("salesList");
const message = document.getElementById("salesMessage");
const castSelect = form?.elements.castId;
const historySelect = document.getElementById("salesHistoryCast");
const deleteModal = document.getElementById("salesDeleteModal");
const state = { casts:[], sales:[], editingId:"", pendingDeleteId:"", period:"today", search:"", sort:"date-desc" };

if (form && list) initialize();

function initialize() {
  resetForm();
  bindEvents();
  setBusy(list, true, "売上情報を読み込み中");
  subscribeCollection("casts", handleCasts, handleLoadError);
  subscribeSales((rows) => {
    state.sales = rows.sort(compareByUpdatedAt);
    setBusy(list, false);
    render();
  }, handleLoadError);
}

function bindEvents() {
  form.addEventListener("submit", saveSale);
  document.getElementById("resetSales")?.addEventListener("click", () => { resetForm(); setMessage(""); });
  document.getElementById("cancelSalesEdit")?.addEventListener("click", resetForm);
  document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", () => setPeriod(button.dataset.period)));
  ["salesExactDate", "salesDateFrom", "salesDateTo", "salesCastFilter"].forEach((id) => document.getElementById(id)?.addEventListener("change", render));
  document.getElementById("salesSearch")?.addEventListener("input", (event) => { state.search = event.target.value.trim().toLowerCase(); render(); });
  document.getElementById("salesSort")?.addEventListener("change", (event) => { state.sort = event.target.value; render(); });
  historySelect?.addEventListener("change", renderCastHistory);
  list.addEventListener("click", handleListAction);
  document.getElementById("cancelSalesDelete")?.addEventListener("click", closeDeleteModal);
  document.getElementById("confirmSalesDelete")?.addEventListener("click", confirmDelete);
  deleteModal?.addEventListener("click", (event) => { if (event.target === deleteModal) closeDeleteModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !deleteModal?.hidden) closeDeleteModal(); });
}

function handleCasts(rows) {
  state.casts = rows.filter((cast) => cast.isPublished !== false).sort(compareCastOrder);
  renderCastOptions();
  render();
}

async function saveSale(event) {
  event.preventDefault();
  const payload = collectFormData();
  const validation = validate(payload);
  if (!validation.valid) return setMessage(validation.message, "error");
  if (findDuplicateSalesRecord(state.sales, payload, state.editingId)) return setMessage("同じ営業日・キャストの売上は既に登録されています。既存データを編集してください。", "error");

  const button = document.getElementById("saveSales");
  const wasEditing = Boolean(state.editingId);
  button.disabled = true;
  setMessage("保存中...");
  try {
    if (state.editingId) await updateSalesRecord(state.editingId, payload);
    else await createSalesRecord(payload);
    resetForm();
    setMessage(wasEditing ? "売上を更新しました。" : "売上を保存しました。", "success");
  } catch (error) {
    console.error("売上保存失敗", error);
    setMessage("保存に失敗しました。入力内容、通信状況、Firestoreの権限をご確認ください。", "error");
  } finally {
    button.disabled = false;
  }
}

function collectFormData() {
  const data = new FormData(form);
  const castId = String(data.get("castId") || "");
  const cast = state.casts.find((item) => item.id === castId);
  const payload = {
    date:String(data.get("date") || ""),
    castId,
    castName:String(cast?.name || ""),
    attendance:true,
    memo:String(data.get("memo") || "").trim()
  };
  SALES_NUMBER_FIELDS.forEach((field) => { payload[field] = parseFormNumber(data.get(field)); });
  return payload;
}

function validate(payload) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return invalid("営業日を選択してください。");
  if (!payload.castId || !state.casts.some((cast) => cast.id === payload.castId)) return invalid("キャストを選択してください。");
  for (const field of SALES_NUMBER_FIELDS) {
    if (!String(form.elements[field]?.value ?? "").trim()) return invalid(`${fieldLabel(field)}を入力してください。`);
    const max = COUNT_FIELDS.includes(field) ? 9999 : 999999999;
    if (!Number.isInteger(payload[field]) || payload[field] < 0 || payload[field] > max) return invalid(`${fieldLabel(field)}は0以上の整数で入力してください。`);
  }
  if (payload.memo.length > 500) return invalid("メモは500文字以内で入力してください。");
  return { valid:true, message:"" };
}

function handleListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const sale = state.sales.find((item) => item.id === button.dataset.id);
  if (!sale) return;
  if (button.dataset.action === "edit") editSale(sale);
  if (button.dataset.action === "delete") openDeleteModal(sale);
}

function editSale(sale) {
  state.editingId = sale.id;
  form.elements.date.value = sale.date;
  form.elements.castId.value = sale.castId;
  SALES_NUMBER_FIELDS.forEach((field) => { form.elements[field].value = sale[field]; });
  form.elements.memo.value = sale.memo;
  document.getElementById("salesFormTitle").textContent = "営業実績を編集";
  document.getElementById("saveSales").textContent = "変更を保存";
  document.getElementById("cancelSalesEdit").hidden = false;
  setMessage(`${formatDate(sale.date)} ${sale.castName || getCastName(sale.castId)}を編集中です。`);
  form.scrollIntoView({ behavior:"smooth", block:"start" });
  form.elements.sales.focus();
}

function resetForm() {
  state.editingId = "";
  form.reset();
  form.elements.date.value = getTokyoDateKey();
  SALES_NUMBER_FIELDS.filter((field) => field !== "sales").forEach((field) => { form.elements[field].value = "0"; });
  document.getElementById("salesFormTitle").textContent = "営業実績を入力";
  document.getElementById("saveSales").textContent = "売上を保存";
  document.getElementById("cancelSalesEdit").hidden = true;
}

function openDeleteModal(sale) {
  state.pendingDeleteId = sale.id;
  document.getElementById("salesDeleteDescription").textContent = `${formatDate(sale.date)} ${sale.castName || getCastName(sale.castId)}の売上データを削除します。この操作は取り消せません。`;
  deleteModal.hidden = false;
  document.body.classList.add("is-modal-open");
  document.getElementById("cancelSalesDelete").focus();
}

function closeDeleteModal() {
  state.pendingDeleteId = "";
  deleteModal.hidden = true;
  document.body.classList.remove("is-modal-open");
}

async function confirmDelete() {
  const id = state.pendingDeleteId;
  if (!id) return closeDeleteModal();
  const button = document.getElementById("confirmSalesDelete");
  button.disabled = true;
  try {
    await deleteSalesRecord(id);
    closeDeleteModal();
    if (state.editingId === id) resetForm();
    setMessage("売上を削除しました。", "success");
  } catch (error) {
    console.error("売上削除失敗", error);
    setMessage("削除に失敗しました。通信状況とFirestoreの権限をご確認ください。", "error");
  } finally {
    button.disabled = false;
  }
}

function setPeriod(period) {
  state.period = ["today", "month", "custom"].includes(period) ? period : "today";
  document.getElementById("salesExactDate").value = "";
  document.querySelectorAll("[data-period]").forEach((button) => button.classList.toggle("is-active", button.dataset.period === state.period));
  const custom = state.period === "custom";
  document.getElementById("salesDateFrom").disabled = !custom;
  document.getElementById("salesDateTo").disabled = !custom;
  render();
}

function render() {
  renderSummary();
  const visible = getFilteredSales();
  document.getElementById("salesResultCount").textContent = `${visible.length}件`;
  list.innerHTML = visible.length ? createSalesTable(visible) : '<p class="sales-empty">該当する売上データはありません。</p>';
  renderCastHistory();
}

function renderSummary() {
  const today = getTokyoDateKey();
  const monthRows = state.sales.filter((item) => item.date.startsWith(today.slice(0, 7)));
  setText("salesTodayTotal", yen(sum(state.sales.filter((item) => item.date === today), "sales")));
  setText("salesMonthTotal", yen(sum(monthRows, "sales")));
  setText("salesHonmeiTotal", sum(monthRows, "honmeiCount"));
  setText("salesJounaiTotal", sum(monthRows, "jounaiCount"));
  setText("salesDouhanTotal", sum(monthRows, "douhanCount"));
  setText("salesCustomerTotal", sum(monthRows, "customerCount"));
}

function createSalesTable(rows) {
  const body = rows.map((item) => `<tr><td><time datetime="${escapeAttribute(item.date)}">${escapeHtml(formatDate(item.date))}</time></td><td>${escapeHtml(item.castName || getCastName(item.castId))}</td><td class="is-money">${yen(item.sales)}</td><td>${item.customerCount}名</td><td>${item.honmeiCount}</td><td>${item.jounaiCount}</td><td>${item.douhanCount}</td><td><div class="admin-item-actions"><button type="button" data-action="edit" data-id="${escapeAttribute(item.id)}">編集</button><button type="button" data-action="delete" data-id="${escapeAttribute(item.id)}">削除</button></div></td></tr>`).join("");
  return `<div class="sales-table-wrap"><table class="sales-table"><thead><tr><th>営業日</th><th>キャスト</th><th>売上</th><th>来客</th><th>本指名</th><th>場内</th><th>同伴</th><th>操作</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderCastHistory() {
  const output = document.getElementById("salesCastHistory");
  const castId = historySelect.value;
  if (!castId) { output.innerHTML = "<p>キャストを選択すると、売上・指名・同伴履歴を表示します。</p>"; return; }
  const rows = state.sales.filter((item) => item.castId === castId).sort((a, b) => b.date.localeCompare(a.date));
  const castName = getCastName(castId);
  if (!rows.length) { output.innerHTML = `<p>${escapeHtml(castName)}の売上履歴はまだありません。</p>`; return; }
  output.innerHTML = `<div class="sales-cast-totals"><div><span>累計売上</span><strong>${yen(sum(rows, "sales"))}</strong></div><div><span>本指名</span><strong>${sum(rows, "honmeiCount")}</strong></div><div><span>場内</span><strong>${sum(rows, "jounaiCount")}</strong></div><div><span>同伴</span><strong>${sum(rows, "douhanCount")}</strong></div></div><div class="sales-history-table-wrap"><table class="sales-history-table"><thead><tr><th>営業日</th><th>売上</th><th>本指名</th><th>場内</th><th>同伴</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${escapeHtml(formatDate(item.date))}</td><td>${yen(item.sales)}</td><td>${item.honmeiCount}</td><td>${item.jounaiCount}</td><td>${item.douhanCount}</td></tr>`).join("")}</tbody></table></div>`;
}

function getFilteredSales() {
  const today = getTokyoDateKey();
  const exactDate = document.getElementById("salesExactDate")?.value || "";
  const from = document.getElementById("salesDateFrom")?.value || "";
  const to = document.getElementById("salesDateTo")?.value || "";
  const castId = document.getElementById("salesCastFilter")?.value || "";
  const rows = state.sales.filter((item) => {
    const periodMatch = exactDate ? item.date === exactDate : state.period === "today" ? item.date === today : state.period === "month" ? item.date.startsWith(today.slice(0, 7)) : (!from || item.date >= from) && (!to || item.date <= to);
    const castMatch = !castId || item.castId === castId;
    const searchMatch = !state.search || `${item.castName || getCastName(item.castId)} ${item.memo}`.toLowerCase().includes(state.search);
    return periodMatch && castMatch && searchMatch;
  });
  return rows.sort(compareVisibleSales);
}

function compareVisibleSales(a, b) {
  if (state.sort === "date-asc") return a.date.localeCompare(b.date) || compareByUpdatedAt(a, b);
  if (state.sort === "sales-desc") return b.sales - a.sales || b.date.localeCompare(a.date);
  if (state.sort === "sales-asc") return a.sales - b.sales || b.date.localeCompare(a.date);
  if (state.sort === "cast-asc") return (a.castName || getCastName(a.castId)).localeCompare(b.castName || getCastName(b.castId), "ja") || b.date.localeCompare(a.date);
  return b.date.localeCompare(a.date) || compareByUpdatedAt(a, b);
}

function renderCastOptions() {
  const selected = { input:castSelect.value, history:historySelect.value, filter:document.getElementById("salesCastFilter").value };
  const options = state.casts.map((cast) => `<option value="${escapeAttribute(cast.id)}">${escapeHtml(cast.name || "名称未設定")}</option>`).join("");
  castSelect.innerHTML = `<option value="">キャストを選択</option>${options}`;
  historySelect.innerHTML = `<option value="">キャストを選択</option>${options}`;
  document.getElementById("salesCastFilter").innerHTML = `<option value="">すべてのキャスト</option>${options}`;
  castSelect.value = selected.input;
  historySelect.value = selected.history;
  document.getElementById("salesCastFilter").value = selected.filter;
}

function compareByUpdatedAt(a, b) { return getTime(b.updatedAt || b.createdAt) - getTime(a.updatedAt || a.createdAt); }
function compareCastOrder(a, b) { return Number(a.displayOrder ?? 9999) - Number(b.displayOrder ?? 9999) || String(a.name || "").localeCompare(String(b.name || ""), "ja"); }
function getTime(value) { if (typeof value?.toMillis === "function") return value.toMillis(); return Date.parse(value) || 0; }
function getCastName(id) { return state.casts.find((cast) => cast.id === id)?.name || "名称未設定"; }
function sum(rows, field) { return rows.reduce((total, item) => total + safeInteger(item[field]), 0); }
function parseFormNumber(value) { const raw = String(value ?? "").trim(); return raw === "" ? Number.NaN : Number(raw); }
function safeInteger(value) { const number = Number(value); return Number.isFinite(number) ? Math.trunc(number) : 0; }
function yen(value) { return new Intl.NumberFormat("ja-JP", { style:"currency", currency:"JPY", maximumFractionDigits:0 }).format(safeInteger(value)); }
function formatDate(value) { const [year, month, day] = String(value || "").split("-"); return year && month && day ? `${year}/${month}/${day}` : value; }
function getTokyoDateKey() { return new Intl.DateTimeFormat("sv-SE", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }
function fieldLabel(field) { return ({ sales:"売上", customerCount:"来客人数", honmeiCount:"本指名", jounaiCount:"場内", douhanCount:"同伴", extensionSales:"延長売上", drinkSales:"ドリンク売上", bottleSales:"ボトル売上", champagneSales:"シャンパン売上", otherSales:"その他売上" })[field] || field; }
function invalid(text) { return { valid:false, message:text }; }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = String(value); }
function setMessage(text, type = "") { message.textContent = text; message.dataset.type = type; }
function handleLoadError(error) { console.error("売上管理データ読み込み失敗", error); setBusy(list, false); showPageError(list, "売上情報を読み込めませんでした。Firestoreの権限と通信状況をご確認ください。"); }
